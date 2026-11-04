<#
.SYNOPSIS
Open the awesome-dsh-plugin catalog PR for this repository on Windows PowerShell 5.1+.

.DESCRIPTION
Same submission as tools/open-market-pr.mjs, but using Invoke-RestMethod so it
goes through the system (WinINET) proxy on machines where Node's fetch cannot
reach api.github.com directly. The token is read from GITHUB_TOKEN only and is
never printed, logged or written to disk.

.PARAMETER DryRun
Print what would happen; do not create a fork, branch, file or PR.

.NOTES
Set HTTPS_PROXY (or HTTP_PROXY / ALL_PROXY) when GitHub is only reachable
through a local proxy.

exit 0 = done or an open PR already exists; 3 = repo younger than 24h; 1 = error
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# Machines that reach GitHub through a local proxy (Clash/V2Ray and friends)
# usually rely on the system proxy, which .NET honours, but a user-scoped
# HTTPS_PROXY is honoured too so the script works from a plain shell.
$proxyUrl = $env:HTTPS_PROXY
if ([string]::IsNullOrWhiteSpace($proxyUrl)) { $proxyUrl = $env:HTTP_PROXY }
if ([string]::IsNullOrWhiteSpace($proxyUrl)) { $proxyUrl = $env:ALL_PROXY }
if (-not [string]::IsNullOrWhiteSpace($proxyUrl)) {
  # WebProxy treats these as regular expressions, not wildcards.
  $bypass = @('localhost', '127\.0\.0\.1', '.*\.local')
  [System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy($proxyUrl, $true, $bypass)
  Write-Output ('proxy from environment: ' + $proxyUrl)
}

$Owner = 'Zhishulo'
$Repo = 'taptap-maker-builder'
$UpstreamOwner = 'awesome-dsh-plugin'
$UpstreamRepo = 'awesome-dsh-plugin'
$Branch = 'add-taptap-maker-builder'
$EntryPath = 'data/plugins/Zhishulo__taptap-maker-builder.yml'
$MinAgeHours = 24
$Root = Split-Path -Parent $PSScriptRoot
$ApiBase = 'https://api.github.com'
$PrTitle = 'Add taptap-maker-builder (skill): TapTap Maker project builder'

$token = $env:GITHUB_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error 'GITHUB_TOKEN is not set. Pass it in the environment; do not put it in a file.'
  exit 1
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'taptap-maker-builder-market-pr'
}

# Returns @{ Status = <int>; Data = <parsed body or $null> }. Status is 200 for any
# 2xx success, otherwise the HTTP status (404 for missing, 0 for transport errors).
function Invoke-Gh {
  param([string]$Method = 'GET', [string]$Path, $Body)
  $params = @{ Method = $Method; Uri = ($ApiBase + $Path); Headers = $headers }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    $params.ContentType = 'application/json'
  }
  try {
    $data = Invoke-RestMethod @params
    [pscustomobject]@{ Status = 200; Data = $data }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
    [pscustomobject]@{ Status = $code; Data = $null; Error = $_.Exception.Message }
  }
}

Write-Output 'token in environment: yes (not printed)'
if ($DryRun) { Write-Output 'mode: dry run - nothing will be created' }

# 1. identity
$me = Invoke-Gh -Path '/user'
if ($me.Status -ne 200) { Write-Error ('GET /user -> ' + $me.Status + ' ' + $me.Error); exit 1 }
if ($me.Data.login -ne $Owner) { Write-Error ('token belongs to ' + $me.Data.login + ', expected ' + $Owner); exit 1 }
Write-Output ('authenticated as ' + $me.Data.login)

# 2. the catalog checks repo age automatically; check it first so a too-early run changes nothing
$repoInfo = Invoke-Gh -Path ('/repos/' + $Owner + '/' + $Repo)
if ($repoInfo.Status -ne 200) { Write-Error ('GET repo -> ' + $repoInfo.Status + ' ' + $repoInfo.Error); exit 1 }
$created = [datetime]::Parse($repoInfo.Data.created_at).ToUniversalTime()
$ageHours = ((Get-Date).ToUniversalTime() - $created).TotalHours
Write-Output ('repo created_at ' + $repoInfo.Data.created_at + ' (' + [math]::Round($ageHours, 2) + 'h old)')
if ($ageHours -lt $MinAgeHours) {
  $waitMin = [math]::Ceiling(($MinAgeHours - $ageHours) * 60)
  $msg = 'NOT YET ELIGIBLE: the catalog requires a repo at least 1 day old; about ' + $waitMin + ' more minute(s).'
  if (-not $DryRun) { Write-Error $msg; exit 3 }
  Write-Output ($msg + ' (dry run continues)')
}

# 3. entry file is the single source of the submission
$entry = Get-Content -Raw -LiteralPath (Join-Path $Root 'docs/market-entry.yml')
$required = @(
  ('url: https://github.com/' + $Owner + '/' + $Repo),
  ('name: ' + $Owner + '/' + $Repo),
  'category: '
)
foreach ($must in $required) {
  if ($entry -notmatch [regex]::Escape($must)) { Write-Error ('docs/market-entry.yml is missing ' + $must); exit 1 }
}
Write-Output ('entry ready: ' + $EntryPath + ' (' + $entry.Length + ' bytes)')

# 4. fork the catalog repo when missing
$fork = Invoke-Gh -Path ('/repos/' + $Owner + '/' + $UpstreamRepo)
if ($fork.Status -eq 404) {
  if ($DryRun) {
    Write-Output ('would fork ' + $UpstreamOwner + '/' + $UpstreamRepo)
  } else {
    Write-Output 'forking catalog repo ...'
    Invoke-Gh -Method 'POST' -Path ('/repos/' + $UpstreamOwner + '/' + $UpstreamRepo + '/forks') -Body @{} | Out-Null
    $fork = Invoke-Gh -Path ('/repos/' + $Owner + '/' + $UpstreamRepo)
    $tries = 0
    while ($fork.Status -eq 404 -and $tries -lt 12) { Start-Sleep -Seconds 6; $fork = Invoke-Gh -Path ('/repos/' + $Owner + '/' + $UpstreamRepo); $tries++ }
    if ($fork.Status -eq 404) { Write-Error 'fork did not appear in time; run again in a minute'; exit 1 }
  }
}

# 5. reset the fork branch to upstream main so the PR is one file
$upstream = Invoke-Gh -Path ('/repos/' + $UpstreamOwner + '/' + $UpstreamRepo)
if ($upstream.Status -ne 200) { Write-Error ('GET upstream -> ' + $upstream.Status + ' ' + $upstream.Error); exit 1 }
$base = $upstream.Data.default_branch
$baseRef = Invoke-Gh -Path ('/repos/' + $UpstreamOwner + '/' + $UpstreamRepo + '/git/ref/heads/' + $base)
if ($baseRef.Status -ne 200) { Write-Error ('GET upstream ref -> ' + $baseRef.Status + ' ' + $baseRef.Error); exit 1 }
$baseSha = $baseRef.Data.object.sha
Write-Output ('upstream ' + $base + ' at ' + $baseSha.Substring(0, 12))

if ($DryRun) {
  Write-Output ('would set ' + $Owner + '/' + $UpstreamRepo + ' branch ' + $Branch + ' to ' + $baseSha.Substring(0, 12))
  Write-Output ('would write ' + $EntryPath + ' on that branch')
  Write-Output ('would open PR: ' + $PrTitle)
  exit 0
}

$forkRefPath = '/repos/' + $Owner + '/' + $UpstreamRepo + '/git/ref/heads/' + $Branch
$forkRef = Invoke-Gh -Path $forkRefPath
if ($forkRef.Status -eq 404) {
  $createdRef = Invoke-Gh -Method 'POST' -Path ('/repos/' + $Owner + '/' + $UpstreamRepo + '/git/refs') -Body @{ ref = ('refs/heads/' + $Branch); sha = $baseSha }
  if ($createdRef.Status -ne 200) { Write-Error ('POST git/refs -> ' + $createdRef.Status + ' ' + $createdRef.Error); exit 1 }
  Write-Output ('created fork branch ' + $Branch)
} else {
  $patched = Invoke-Gh -Method 'PATCH' -Path ('/repos/' + $Owner + '/' + $UpstreamRepo + '/git/refs/heads/' + $Branch) -Body @{ sha = $baseSha; force = $true }
  if ($patched.Status -ne 200) { Write-Error ('PATCH fork ref -> ' + $patched.Status + ' ' + $patched.Error); exit 1 }
  Write-Output ('reset fork branch ' + $Branch + ' to upstream ' + $base)
}

# 6. write the entry only when its content differs
$contentsPath = '/repos/' + $Owner + '/' + $UpstreamRepo + '/contents/' + $EntryPath
$normalized = ($entry -replace "`r`n", "`n")
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalized))
$existing = Invoke-Gh -Path ($contentsPath + '?ref=' + $Branch)
if ($existing.Status -eq 200 -and $existing.Data.content -and (($existing.Data.content -replace '\s', '') -eq ($encoded -replace '\s', ''))) {
  Write-Output 'entry already present on the branch, unchanged'
} else {
  $body = @{ message = ('Add ' + $Owner + '/' + $Repo + ' (skill)'); content = $encoded; branch = $Branch }
  if ($existing.Status -eq 200) { $body.sha = $existing.Data.sha }
  $put = Invoke-Gh -Method 'PUT' -Path $contentsPath -Body $body
  if ($put.Status -ne 200) { Write-Error ('PUT contents -> ' + $put.Status + ' ' + $put.Error); exit 1 }
  Write-Output ('wrote ' + $EntryPath + ' on ' + $Branch)
}

# 7. one PR per branch
$open = Invoke-Gh -Path ('/repos/' + $UpstreamOwner + '/' + $UpstreamRepo + '/pulls?state=open&head=' + $Owner + ':' + $Branch + '&base=' + $base)
if ($open.Status -eq 200 -and $open.Data -and @($open.Data).Count -gt 0) {
  Write-Output ('an open PR already exists: ' + @($open.Data)[0].html_url)
  exit 0
}

$prBody = Get-Content -Raw -LiteralPath (Join-Path $Root 'docs/pr-body.md')
$pr = Invoke-Gh -Method 'POST' -Path ('/repos/' + $UpstreamOwner + '/' + $UpstreamRepo + '/pulls') -Body @{
  title = $PrTitle
  head = ($Owner + ':' + $Branch)
  base = $base
  maintainer_can_modify = $true
  body = $prBody
}
if ($pr.Status -ne 200) { Write-Error ('POST pulls -> ' + $pr.Status + ' ' + $pr.Error); exit 1 }
Write-Output ('PR opened: ' + $pr.Data.html_url)
