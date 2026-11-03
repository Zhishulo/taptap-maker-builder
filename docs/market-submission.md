# 提交到 DSH 插件市场（收录 PR）

这份文档记录本仓库如何进入 DeepSeek Harness 插件市场，以及为什么投稿 PR 不发给 `dsh-market/dsh-market`。

## 目标仓库

`dsh-market/dsh-market` 的 README 写得很清楚：**它是市场应用本身，不是目录**。目录在 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，`data/plugins/` 下每个插件一个 YAML，README 由脚本生成。

所以一次投稿 = 一个 PR = 新增一个文件 `data/plugins/Zhishulo__taptap-maker-builder.yml`。

## 条目文件

仓库里的 [`docs/market-entry.yml`](./market-entry.yml) 就是提交内容（单一来源，脚本直接读它，避免两边漂移）：

```yaml
url: https://github.com/Zhishulo/taptap-maker-builder
name: Zhishulo/taptap-maker-builder
category: skill
description:
  en: 'Skill for building a game design brief into a playable, publishable TapTap Maker project: it picks the browser workspace or local MCP route, extracts the five elements of the brief, writes a first-round prompt for a minimal core loop, iterates in the official order, checks preview and release materials, and keeps credit, credential and irreversible-action limits in view. Includes eight reference notes on the product, credits, themes and asset limits, the leaderboard, brief parsing, iteration, publishing and safety, four templates, and three read-only Python checks for brief completeness, project layout and release materials.'
  zh: '把一份游戏策划案在 TapTap 制造（UrhoX 引擎 + Lua）上落成可玩、可发布的项目：先用浏览器工作区还是本地 MCP、拆解策划案五要素、写最小可玩的首轮需求、按官方顺序迭代、核对预览与发布物料，并守住积分、凭证与不可逆动作的红线。含 8 篇参考（产品、积分、主题与素材、排行榜、需求拆解、迭代验收、发布、安全）、4 个模板、3 个只读 Python 校验脚本（五要素完整性、项目目录、发布物料）。'
```

## 收录要求与自查

| 要求 | 本仓库 |
|---|---|
| `package.json` 声明 `dsh.bundle`，仓库根有 `cordis.patch.yml` | 有：`"bundle": { "patch": "./cordis.patch.yml" }` |
| 真实可用的代码，不是占位/纯 README 仓库 | `lib/index.js` 把 `SKILL.md` 挂进 `ctx.skills`；三个校验脚本有实测用例；`tools/selftest.mjs` 27 项检查 |
| 仓库创建满 1 天 | CI 自动检查；脚本会在 PR 前复核，未满 1 天直接退出 |
| 仓库带 `dsh-plugin` topic | 仓库创建后通过 API 设置 |
| 描述属实、不带营销词、不以 `: ` 出现未加引号 | 逐条对得上代码；`description.en` 已加单引号 |
| 分类贴合 | `skill`——本包本质是一个技能 + 三个校验脚本，与 `7starsseeker/dsh-fact-check` 同类 |
| 不是纯聚合包 | 自带行为：挂载技能、随包发 16 个内容文件，不是依赖清单 |

## 提 PR

仓库创建满 24 小时后运行（token 从环境变量读，不进仓库）：

```sh
$env:GITHUB_TOKEN = (从 Windows 凭据管理器取，别打印)
node tools/open-market-pr.mjs            # 真提 PR
node tools/open-market-pr.mjs --dry-run  # 只打印将要做的事
```

脚本会依次：验证 token 身份 → 复核仓库年龄 → 确保 `Zhishulo/awesome-dsh-plugin` fork 存在 → 把 fork 分支 `add-taptap-maker-builder` 重置到上游 `main` → 写条目文件 → 开 PR（已存在同 head 的开放 PR 时跳过并给出链接）。

退出码：`0` 成功或已存在；`3` 仓库未满 1 天（等一会儿再跑）；`1` 出错。

## PR 说明草稿

标题：`Add tapap-maker-builder (skill): TapTap Maker project builder`

正文：说明这是一个技能类插件、挂载随包 `SKILL.md`、含三个只读校验脚本与自测、无网络与凭据行为、MIT、知识整理日期与官方文档链接。脚本 `tools/open-market-pr.mjs` 里已经内置了这段正文，不用手写。
