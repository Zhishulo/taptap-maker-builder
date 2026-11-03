#!/usr/bin/env node
/**
 * Open the awesome-dsh-plugin catalog PR for this repository.
 *
 *   GITHUB_TOKEN=<token> node tools/open-market-pr.mjs
 *   GITHUB_TOKEN=<token> node tools/open-market-pr.mjs --dry-run
 *
 * Token needs `repo` (fork branch + contents + PR). It is read from the
 * environment only and is never printed, logged or written to disk.
 *
 * Exit codes: 0 done or an open PR already exists; 3 repo younger than 24h;
 * 1 usage, auth or API error.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OWNER = 'Zhishulo'
const REPO = 'taptap-maker-builder'
const UPSTREAM_OWNER = 'awesome-dsh-plugin'
const UPSTREAM_REPO = 'awesome-dsh-plugin'
const BRANCH = 'add-taptap-maker-builder'
const ENTRY_PATH = 'data/plugins/Zhishulo__taptap-maker-builder.yml'
const MIN_AGE_MS = 24 * 60 * 60 * 1000
const PR_TITLE = 'Add taptap-maker-builder (skill): TapTap Maker project builder'
const DRY_RUN = process.argv.includes('--dry-run')

const PR_BODY = [
  '## What this adds',
  '',
  '`Zhishulo/taptap-maker-builder` — a skill plugin for **TapTap Maker** (TapTap 制造, UrhoX engine + Lua), the AI game-creation tool where you describe a game and it builds, previews and publishes it.',
  '',
  'The shipped `SKILL.md` is mounted into `ctx.skills` by a zero-dependency provider in `lib/index.js`. It covers, in Chinese because the product and all of its docs are Chinese:',
  '',
  '- choosing between the browser workspace and the local Maker MCP route;',
  '- extracting the five elements of a design brief and writing a first-round prompt for a minimal playable core loop;',
  '- iterating in the official order and checking preview and release materials;',
  '- the credit, credential and irreversible-action limits of the product.',
  '',
  'Alongside the skill body: 8 reference notes, 4 templates, and 3 read-only Python checks (brief completeness, project layout, release materials) that use only the standard library. `tools/selftest.mjs` runs 27 checks without the host: it parses the frontmatter, calls the provider `list()`/`get()`, and verifies every `./` resource referenced by the body exists.',
  '',
  'No network calls, no credentials, no install-time scripts, zero runtime dependencies. MIT.',
  '',
  'Entry: category `skill`; the plugin itself is `Zhishulo/taptap-maker-builder` (not a meta-package — it ships its own behaviour and content).',
].join('\n')

const token = (process.env.GITHUB_TOKEN ?? '').trim()
if (!token) {
  console.error('GITHUB_TOKEN is not set. Read it from the Windows credential store and pass it in the environment; do not put it in a file.')
  process.exit(1)
}

const API = 'https://api.github.com'
const HEADERS = {
  Authorization: 'Bearer ' + token,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'taptap-maker-builder-market-pr',
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (...args) => console.log(...args)

async function gh(apiPath, { method = 'GET', body } = {}) {
  const res = await fetch(API + apiPath, {
    method,
    headers: { ...HEADERS, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text.slice(0, 500) } }
  if (!res.ok) {
    const err = new Error(method + ' ' + apiPath + ' -> ' + res.status + ' ' + (data?.message ?? text.slice(0, 300)))
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

/** Like gh(), but returns null on 404 instead of throwing. */
async function ghOrNull(apiPath, init) {
  try {
    return await gh(apiPath, init)
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

function fail(message) {
  console.error('FAILED: ' + message)
  process.exit(1)
}

async function main() {
  log('token in environment: yes (not printed)')
  if (DRY_RUN) log('mode: dry run — no branches, files, PRs or forks will be created')

  // 1. Who are we, and is the token allowed to do this?
  const user = await gh('/user')
  if (user.login.toLowerCase() !== OWNER.toLowerCase()) {
    fail('token belongs to ' + user.login + ', expected ' + OWNER)
  }
  log('authenticated as ' + user.login)

  // 2. The catalog checks repo age automatically; check it here so a too-early
  //    run exits before touching the upstream repository.
  const repo = await gh('/repos/' + OWNER + '/' + REPO)
  const ageMs = Date.now() - Date.parse(repo.created_at)
  const ageHours = ageMs / 3600000
  log('repo created_at ' + repo.created_at + ' (' + ageHours.toFixed(2) + 'h old)')
  if (ageMs < MIN_AGE_MS) {
    const waitMin = Math.ceil((MIN_AGE_MS - ageMs) / 60000)
    const message = 'NOT YET ELIGIBLE: the catalog requires a repo at least 1 day old; about ' + waitMin + ' more minute(s).'
    if (!DRY_RUN) {
      console.error(message)
      process.exit(3)
    }
    log(message + ' (dry run continues without touching anything)')
  }

  // 3. The entry file is the single source of truth for the submission.
  const entry = await readFile(path.join(ROOT, 'docs', 'market-entry.yml'), 'utf8')
  for (const expected of ['url: https://github.com/' + OWNER + '/' + REPO, 'name: ' + OWNER + '/' + REPO, 'category: ']) {
    if (!entry.includes(expected)) fail('docs/market-entry.yml is missing ' + JSON.stringify(expected))
  }
  log('entry ready: ' + ENTRY_PATH + ' (' + entry.length + ' bytes)')

  // 4. Fork the catalog repo if the account does not have one yet.
  let fork = await ghOrNull('/repos/' + OWNER + '/' + UPSTREAM_REPO)
  if (!fork) {
    if (DRY_RUN) {
      log('would fork ' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO)
    } else {
      log('forking ' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + ' …')
      await gh('/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + '/forks', { method: 'POST', body: {} })
      for (let attempt = 0; attempt < 12 && !fork; attempt += 1) {
        await sleep(6000)
        fork = await ghOrNull('/repos/' + OWNER + '/' + UPSTREAM_REPO)
      }
      if (!fork) fail('fork did not appear in time; run again in a minute')
    }
  }

  // 5. Reset the fork branch to the current upstream main, so the PR is one file.
  const upstream = await gh('/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO)
  const base = upstream.default_branch
  const baseRef = await gh('/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + '/git/ref/heads/' + base)
  const baseSha = baseRef.object.sha
  log('upstream ' + base + ' at ' + baseSha.slice(0, 12))

  if (DRY_RUN) {
    log('would set ' + OWNER + '/' + UPSTREAM_REPO + ' branch ' + BRANCH + ' to ' + baseSha.slice(0, 12))
    log('would write ' + ENTRY_PATH + ' on that branch')
    log('would open PR: ' + PR_TITLE)
    return
  }

  const forkRefPath = '/repos/' + OWNER + '/' + UPSTREAM_REPO + '/git/ref/heads/' + BRANCH
  const forkRef = await ghOrNull(forkRefPath)
  if (!forkRef) {
    await gh('/repos/' + OWNER + '/' + UPSTREAM_REPO + '/git/refs', {
      method: 'POST',
      body: { ref: 'refs/heads/' + BRANCH, sha: baseSha },
    })
    log('created fork branch ' + BRANCH)
  } else {
    await gh('/repos/' + OWNER + '/' + UPSTREAM_REPO + '/git/refs/heads/' + BRANCH, {
      method: 'PATCH',
      body: { sha: baseSha, force: true },
    })
    log('reset fork branch ' + BRANCH + ' to upstream ' + base)
  }

  // 6. Write the entry, only when its content differs.
  const encoded = Buffer.from(entry, 'utf8').toString('base64')
  const contentsPath = '/repos/' + OWNER + '/' + UPSTREAM_REPO + '/contents/' + ENTRY_PATH
  const existing = await ghOrNull(contentsPath + '?ref=' + BRANCH)
  if (existing && existing.content && existing.content.replace(/\s/g, '') === encoded.replace(/\s/g, '')) {
    log('entry already present on the branch, unchanged')
  } else {
    await gh(contentsPath, {
      method: 'PUT',
      body: {
        message: 'Add ' + OWNER + '/' + REPO + ' (skill)',
        content: encoded,
        branch: BRANCH,
        ...(existing ? { sha: existing.sha } : {}),
      },
    })
    log('wrote ' + ENTRY_PATH + ' on ' + BRANCH)
  }

  // 7. One PR per branch; re-running after a fix should not open a second one.
  const open = await gh('/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + '/pulls?state=open&head=' + OWNER + ':' + BRANCH + '&base=' + base)
  if (Array.isArray(open) && open.length > 0) {
    log('an open PR already exists: ' + open[0].html_url)
    return
  }

  const pr = await gh('/repos/' + UPSTREAM_OWNER + '/' + UPSTREAM_REPO + '/pulls', {
    method: 'POST',
    body: { title: PR_TITLE, head: OWNER + ':' + BRANCH, base, body: PR_BODY, maintainer_can_modify: true },
  })
  log('PR opened: ' + pr.html_url)
}

main().catch((error) => {
  const status = error?.status ? ' [HTTP ' + error.status + ']' : ''
  console.error('FAILED' + status + ': ' + (error?.message ?? String(error)))
  process.exit(1)
})
