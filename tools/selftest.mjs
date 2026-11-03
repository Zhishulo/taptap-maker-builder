#!/usr/bin/env node
/**
 * 自测：不依赖宿主，直接读 SKILL.md、跑一遍 provider 的 list()/get()，
 * 并核对正文里用 ./ 引用的每一个文件都真实存在且非空。
 *
 *   node tools/selftest.mjs
 *
 * 退出码 0 = 全部通过；1 = 有断言失败（错误信息写清哪一条）。
 */
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { list, get, parseFrontmatter, isSkillName, provider, name } from '../lib/index.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const failures = []
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures.push(label + (detail ? ' — ' + detail : ''))
    console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''))
  }
}

console.log('taptap-maker-builder selftest')
console.log('  root: ' + root)

// 1. 插件导出
check('export const name', name === 'taptap-maker-builder', 'got ' + JSON.stringify(name))
check('provider.name', provider.name === 'taptap-maker-builder')

// 2. 候选
const candidates = await list()
check('list() 返回 1 条候选', candidates.length === 1, 'got ' + candidates.length)
const cand = candidates[0]
check('技能名是 kebab-case', isSkillName(cand.name), JSON.stringify(cand.name))
check('技能名与包名一致', cand.name === 'taptap-maker-builder', cand.name)
check('描述非空', typeof cand.description === 'string' && cand.description.length > 20)
check('描述覆盖「问答」触发', /询问|问题/.test(cand.description))
check('描述覆盖「搭项目」触发', /策划案/.test(cand.description))
check('resourceBase 指向包根', cand.resourceBase?.kind === 'directory' && cand.resourceBase.path === root)
check('path 指向 SKILL.md', cand.path === join(root, 'SKILL.md'))

// 3. 正文
const def = await get(cand)
check('get() 正文非空', typeof def.content === 'string' && def.content.length > 2000, 'len=' + def.content?.length)
check('正文不含 frontmatter', !def.content.startsWith('---'))
check('正文保留了 Markdown 标题', /^#\s/m.test(def.content))

// 4. 正文引用的 ./ 文件都存在
const raw = await readFile(join(root, 'SKILL.md'), 'utf8')
const { fm } = parseFrontmatter(raw)
check('frontmatter 有 name', fm.name === 'taptap-maker-builder', fm.name)
check('frontmatter 有 description', typeof fm.description === 'string' && fm.description.length > 100)
const refs = [...new Set([...raw.matchAll(/\.\/((?:references|scripts|assets)\/[A-Za-z0-9._\-\/]+)/g)].map((m) => m[1]))]
check('正文至少引用 10 个资源文件', refs.length >= 10, 'got ' + refs.length)
const found = []
for (const rel of refs.sort()) {
  let ok = false
  try {
    const s = await stat(join(root, rel))
    ok = s.isFile() && s.size > 0
  } catch { ok = false }
  if (ok) found.push(rel)
  check('资源存在且非空: ' + rel, ok)
}

// 5. 计数
check('references/ 至少 8 篇', found.filter((r) => r.startsWith('references/')).length >= 8)
check('scripts/ 至少 3 个', found.filter((r) => r.startsWith('scripts/')).length >= 3)
check('assets/ 至少 4 个模板', found.filter((r) => r.startsWith('assets/')).length >= 4)

console.log('')
if (failures.length) {
  console.error('FAILED ' + failures.length + ' check(s):')
  for (const f of failures) console.error('  - ' + f)
  process.exitCode = 1
} else {
  console.log('PASS — ' + (refs.length + 12) + ' checks')
}
