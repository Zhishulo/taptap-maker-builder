/**
 * taptap-maker-builder — DSH 技能提供者：把本包自带的 SKILL.md 挂到 ctx.skills。
 *
 * 为什么需要这一层：market 的收录要求是「能用 dsh plugin add 装上的包」——包里必须在
 * package.json 声明 dsh.bundle 并在包根放一份 cordis.patch.yml。而技能正文只是一份
 * SKILL.md，它要进入会话的技能目录就需要一个 provider；本文件就是那层很薄的接线。
 *
 * 三条刻意的性质：
 *   · 不复制技能正文 —— 候选与正文都在调用时从 SKILL.md 现读，改正文不必动本文件，
 *     也不会出现「描述与正文两份、各自漂移」。
 *   · 零依赖 —— 只 import node: 内置模块。技能里的三个 Python 校验脚本留在 scripts/，
 *     由使用者的本机 Python 跑，与本插件无关。
 *   · 资源基准指向包根 —— 正文里写的 ./references/01-product-overview.md、
 *     ./scripts/check_brief.py 因此能按 SKILL.md 所在目录解析。
 *
 * DSH 0.2.1 起注册表在 registerProvider 的 create 里传入 { signal, invalidate }：
 * 这里用 invalidate() 接住 SKILL.md 的改动，老宿主不传 control 时静默退化成「重启后生效」。
 *
 * @module taptap-maker-builder
 */

import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** 包根（lib/ 的上一级）。SKILL.md、references/、scripts/、assets/ 都在那里。 */
const ROOT_URL = new URL('..', import.meta.url)
/** 包根路径：fileURLToPath 会留一个尾分隔符，去掉它，让等值比较不必依赖末尾字符。 */
const ROOT_PATH = fileURLToPath(ROOT_URL).replace(/[\\/]+$/, '')
const SKILL_URL = new URL('SKILL.md', ROOT_URL)
const SKILL_PATH = fileURLToPath(SKILL_URL)

/** 编辑器保存常常连发好几个事件，合并成一次目录失效。 */
const WATCH_DEBOUNCE_MS = 150

/** provider 名，在 ctx.skills 注册表里唯一。 */
const PROVIDER_NAME = 'taptap-maker-builder'

/**
 * bundled 档的秩（DSH 里 BUNDLED_SKILL_RANK = 600；本地 provider 的其余档位：
 * project 100/200、custom 300、user-dsh 400、user-agents 500）。秩只在同名技能上起作用，
 * 低秩胜出——装了本插件的机器若同时在 ~/.agents/skills/taptap-maker-builder 放了一份
 * 本地特化版（user-agents = 500），本地那份仍然优先。这是刻意的：插件不该覆盖用户自己的版本。
 */
const RANK = 600

/**
 * 读 SKILL.md 的 YAML frontmatter。只认本技能用得到的键，因此不需要 YAML 依赖。
 *
 * @param {string} text - SKILL.md 全文。
 * @returns {{fm: Record<string, string>, body: string}} frontmatter 键值表与去掉它的正文。
 */
export function parseFrontmatter(text) {
  // 去掉可选的 BOM 并把 CRLF 归一为 LF：编辑器编码与 Windows 检出不该改变解析结果。
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!src.startsWith('---')) return { fm: {}, body: text }
  const end = src.indexOf('\n---', 3)
  if (end === -1) return { fm: {}, body: text }
  const fm = {}
  for (const line of src.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return { fm, body: src.slice(end + 4).trimStart() }
}

/** 技能名必须匹配 DSH 的 kebab-case 语法，否则注册表会拒收这个候选。 */
export function isSkillName(name) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(name))
}

/** frontmatter 的调用开关：省略即两处都开。 */
function invocationOf(fm) {
  return {
    modelInvocable: String(fm['disable-model-invocation'] ?? '').toLowerCase() !== 'true',
    userInvocable: String(fm['user-invocable'] ?? '').toLowerCase() !== 'false',
  }
}

/**
 * 读候选：每次调用都重读 SKILL.md，所以正文改完立刻生效。
 *
 * 读失败不吞 —— 让 list() 拒绝比返回空数组诚实：注册表会把拒绝记成一次不完整的观测并保留
 * 上一次的好目录，而返回空数组等于告诉模型「这个技能被删了」。
 *
 * @returns {Promise<object[]>} 本包只提供一条技能，因此是长度为 1 的数组。
 */
export async function list() {
  const { fm } = parseFrontmatter(await readFile(SKILL_URL, 'utf8'))
  if (!isSkillName(fm.name)) {
    throw new Error('SKILL.md 的 frontmatter name 不是 kebab-case：' + JSON.stringify(fm.name))
  }
  if (!fm.description) throw new Error('SKILL.md 的 frontmatter 缺少 description')
  return [
    {
      name: fm.name,
      description: fm.description,
      invocation: invocationOf(fm),
      provider: PROVIDER_NAME,
      source: 'bundled',
      // 资源基准指向包根：正文里写的 ./references/xxx.md 因此可解析。
      resourceBase: { kind: 'directory', path: ROOT_PATH },
      rank: RANK,
      // DSH 0.2.1 起摘要会保留 path：给宿主/子代理一个能直接打开的技能文件位置。
      path: SKILL_PATH,
      locator: SKILL_URL,
      hint: fm['argument-hint'],
    },
  ]
}

/**
 * 读正文：frontmatter 已剥离，返回的就是指令正文。
 *
 * @param {object} candidate - list() 给出的候选。
 * @returns {Promise<object>} 完整技能定义。
 */
export async function get(candidate) {
  const { fm, body } = parseFrontmatter(await readFile(SKILL_URL, 'utf8'))
  // 正文里的 name 与候选不一致说明两次读之间文件被换过 —— 抛出去让注册表重新发现，
  // 而不是交出一份名不副实的定义。
  if (fm.name !== candidate.name) {
    throw new Error('SKILL.md 的 name 已变为 ' + JSON.stringify(fm.name) + '，与候选 ' + JSON.stringify(candidate.name) + ' 不符')
  }
  return {
    name: candidate.name,
    description: fm.description || candidate.description,
    invocation: candidate.invocation,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: candidate.resourceBase,
    path: SKILL_PATH,
    content: body,
  }
}

/** 本 provider 的实例（无内部状态：不缓存正文，全部现读）。 */
export const provider = { name: PROVIDER_NAME, list, get }

/** Cordis 插件名（与 cordis.patch.yml 的 id 一致）。 */
export const name = PROVIDER_NAME
/** 本插件依赖的服务：技能注册表。 */
export const inject = ['skills']

/**
 * 监听 SKILL.md，改动后让注册表重读目录。
 *
 * 监听目录而不是文件：编辑器「写临时文件再改名」的保存方式会让文件级 watcher 直接失效。
 * 只认 SKILL.md 这一个文件名（根目录下还有 references/、scripts/、assets/，它们改了与技能目录无关）。
 *
 * @param {{invalidate?: Function, signal?: AbortSignal}} control - 注册表给的 control。
 * @param {{logger?: {warn?: Function}}} ctx - 仅用于告警。
 * @returns {() => void} 停止监听（幂等）。
 */
function watchSkillFile(control, ctx) {
  if (typeof control?.invalidate !== 'function') return () => {}
  let timer
  let closed = false
  let watcher
  try {
    watcher = watch(fileURLToPath(ROOT_URL), { persistent: false }, (_event, filename) => {
      if (closed || (filename !== null && filename !== 'SKILL.md')) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        if (!closed) control.invalidate()
      }, WATCH_DEBOUNCE_MS)
    })
  } catch (error) {
    ctx?.logger?.warn?.('taptap-maker-builder: SKILL.md 监听未启动，改 SKILL.md 后需重启才刷新技能目录：' + error.message)
    return () => {}
  }
  const stop = () => {
    if (closed) return
    closed = true
    if (timer !== undefined) clearTimeout(timer)
    watcher.close()
  }
  watcher.on('error', (error) => {
    if (closed) return
    ctx?.logger?.warn?.('taptap-maker-builder: SKILL.md 监听已停用，改 SKILL.md 后需重启才刷新技能目录：' + error.message)
    stop()
  })
  control.signal?.addEventListener?.('abort', stop, { once: true })
  return stop
}

/**
 * 挂载：把本 provider 注册到 ctx.skills。
 *
 * @param {{skills: {registerProvider: Function}, effect?: Function, logger?: object}} ctx - Cordis 上下文。
 * @returns {void}
 */
export function apply(ctx) {
  ctx.skills.registerProvider((control) => {
    const stop = watchSkillFile(control, ctx)
    if (typeof ctx.effect === 'function') {
      ctx.effect(function* () {
        yield () => stop()
      }, 'taptap-maker-builder skill watcher')
    }
    return provider
  })
}
