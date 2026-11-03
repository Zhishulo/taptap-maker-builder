# taptap-maker-builder

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4B6BFB.svg)](https://github.com/deepseek-ai/deepseek-harness)

DeepSeek Harness（dsh）技能插件：把一份游戏策划案在 **TapTap 制造（TapTap Maker，UrhoX 引擎 + Lua）** 上落成可玩、可发布的项目——定创作方式、拆五要素、写首轮需求、按官方顺序迭代、预览实机验收、核对发布物料，并守住积分与凭证红线。

它同时回答「TapTap 制造是什么、怎么选方式、积分怎么扣、主题怎么挑、排行榜怎么读」这类问题。

## 装法

市场收录后可在 **设置 → 插件 → 插件市场** 搜 `taptap-maker-builder` 一键安装；在收录之前直接从 GitHub 装：

```sh
dsh plugin --profile <your-profile> add github:Zhishulo/taptap-maker-builder
```

装完重启 dsh。技能随即出现在技能目录里，模型在匹配的场景会自动加载；也可以手动点名：

```text
/taptap-maker-builder 帮我看看这份策划案怎么在 Maker 上落地
```

> 装插件不等于装环境：本包不含 Maker MCP、也不代你登录 TapTap 账号。要在本地目录里用 Maker，仍按官方文档执行 `npx -y @taptap/maker init` 并在 IDE 里接入 MCP。

## 什么时候会触发

- 问 TapTap 制造 / Maker / UrhoX / 制造研究所 / 排行榜 / 积分 / UI 主题 / 本地 MCP 怎么接；
- 上传或粘贴游戏策划案，要求「搭一个」「做成能玩的」「按这个做」；
- 要写 Maker 对话需求、判断积分消耗、核对发布物料、排查预览或实机问题。

不适用：Unity / Unreal 等其它引擎；纯美术外包；与 Maker 无关的通用编程。

## 内容

| 文件 | 作用 |
|---|---|
| `SKILL.md` | 技能正文（226 行）：60 秒产品速览、references 路由表、阶段 0–6 总览、红线 |
| `references/01-product-overview.md` | 产品定位、两种创作方式对比、MCP 安装与初始化、项目目录、本地 Runtime、协作规则 |
| `references/02-credits-and-cost.md` | 五类积分、消耗顺序、成本控制、结果未知（uncertain）的处理 |
| `references/03-ui-themes-and-assets.md` | Astroon / BrawlForge / PixelForge 三套主题、素材规格与上限、AI 生图提示 |
| `references/04-benchmark-guide.md` | L0/L1/L2 判分、各维度含义与误读、95% 置信区间怎么读 |
| `references/05-brief-parsing-and-first-prompt.md` | 五要素提取表、追问上限与问法、首轮需求好/坏对照 |
| `references/06-iteration-and-acceptance.md` | 四段式需求写法、官方推进顺序、预览五项 / 发布前六项 / 数据六条 |
| `references/07-publish-checklist.md` | 物料清单与规格、测试版二维码同步、分享页 |
| `references/08-safety-and-credentials.md` | 时效、凭证、不可逆动作、原子写、范围与版权 |
| `assets/brief-confirmation-template.md` | 策划案理解确认单 |
| `assets/first-prompt-template.md` | 首轮需求模板 |
| `assets/feedback-four-part-template.md` | 四段式反馈模板 |
| `assets/stage-report-template.md` | 阶段报告模板 |
| `scripts/check_brief.py` | 五要素完整性检查（缺项 / 模糊词 / 首轮范围） |
| `scripts/check_project_layout.py` | 本地项目目录核对（必需文件、体积上限、命名与层级） |
| `scripts/check_publish_materials.py` | 发布物料核对（尺寸方向、截图数量、文案字数、视频） |

三个脚本都是纯标准库 Python、只读，退出码 0 = 通过，1 = 有问题，2 = 用法或文件错误；加 `--json` 可机读。

```sh
python scripts/check_brief.py brief.json
python scripts/check_project_layout.py --root ~/projects/my-maker-game
python scripts/check_publish_materials.py materials.json
```

## 它怎么推进（阶段 0–6，每段都有确认门）

| 阶段 | 做什么 | 交付物 |
|---|---|---|
| 0 接入 | 定创作方式；本地模式确认 MCP、项目绑定与现有目录 | 接入确认 + 目录核对结果 |
| 1 解析 | 结构化提取五要素，缺失一次性追问（≤4 问） | 策划案理解确认单 |
| 2 首轮需求 | 只做最小可玩核心循环，确认主题与横竖屏 | 首轮需求文本 |
| 3 迭代 | 最小可玩 → 阻断 → 节奏数值手感 → 素材音效引导物料 | 每轮四段式需求 + 验证结果 |
| 4 预览实机 | 五项验收 + 真机测试二维码 | 验收记录、问题清单 |
| 5 发布 | 物料逐项核对，版本一致后发布 | 发布物料核对单 |
| 6 成本与安全 | 全程守住积分与凭证红线 | — |

用户没确认就停在原地问一句——这是本技能的硬规则，不是建议。

## 红线（技能会主动执行）

- **在线文档优先**：先读 <https://maker.taptap.cn/llms.txt>；技能知识有整理日期（2026-11-03），冲突以在线为准；文档没写的功能、参数、模型名、价格、上限，一律不编。
- **不擅自花钱**：未经明确要求不调用消耗积分的生成工具；高消耗前说明影响并等确认；不自动替换模型或通道；结果未知标 uncertain、先查状态而不是盲目重投。
- **凭证与不可逆动作**：不回显、不代写凭证，凭证不进项目文件或 Git；删除素材、替换模型、正式发布等动作先说明后果。
- **范围**：只在策划案范围内搭项目；新增系统先征得同意；不擅自移动、删除用户文件。

## 开发

```sh
node tools/selftest.mjs
```

自测不依赖宿主：读 `SKILL.md`、跑 provider 的 `list()`/`get()`、核对正文用 `./` 引用的每个资源都真实存在。

## 许可

MIT。技能内容整理自 TapTap 制造官方文档（<https://maker.taptap.cn/llms.txt>），事实与链接以官方为准。
