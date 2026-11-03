# 01 产品速览：TapTap 制造是什么、怎么接入

> 整理日期：2026-11-03。来源：<https://maker.taptap.cn/llms.txt> 及其链接的 overview、getting-started、local-development、collaborators、skills 等文档。产品迭代快，功能与命令以在线文档为准。

## 目录

- [一句话定位](#一句话定位)
- [能做什么、不做什么](#能做什么不做什么)
- [两种创作方式](#两种创作方式)
- [怎么选：决策表](#怎么选决策表)
- [浏览器工作区要点](#浏览器工作区要点)
- [本地开发模式：安装与初始化](#本地开发模式安装与初始化)
- [本地项目目录长什么样](#本地项目目录长什么样)
- [本地 Runtime 与 Maker MCP 能力](#本地-runtime-与-maker-mcp-能力)
- [协作者模式](#协作者模式)
- [制造 Skills](#制造-skills)
- [文档索引与阅读顺序](#文档索引与阅读顺序)
- [常见误区](#常见误区)

## 一句话定位

TapTap 制造（TapTap Maker）是面向游戏爱好者的 AI 游戏创作工具：用户用自然语言描述想法，平台完成方案设计、代码实现、素材制作、预览迭代与发布准备。slogan 是「对话即创作，完成即发布」。

底层运行 **UrhoX 引擎**、用 **Lua** 脚本；内置 Astroon（宇宙卡通）、BrawlForge（竞技卡通）、PixelForge（像素风）三套 UI 主题。

## 能做什么、不做什么

能做：

- 从一句想法到可玩 demo：生成项目、写 Lua 脚本、搭场景与 UI、生成图片/音频/视频素材、构建预览、准备发布物料。
- 浏览器里直接做：项目、对话、预览、发布在同一页面，手机上可扫码试玩。
- 本地目录里做：通过 Maker MCP 把项目绑到本地，用 Codex / Cursor / Claude Code 等 Agent 开发，再用 Maker 构建、预览、发布。

不能做（至少不要承诺）：

- 不替代商业引擎的完整能力（复杂 3D、主机级渲染、大型联网后端都超出范围）。
- 不保证一次生成可发布品质，仍需按阶段迭代与实机验收。
- 不提供「无积分成本」的无限生成；AI 对话与素材生成消耗积分。

## 两种创作方式

| 维度 | 浏览器工作区 | 本地开发模式（Maker MCP） |
|---|---|---|
| 入口 | maker.taptap.cn 网页 | 本地目录 + Codex / Cursor / Claude Code |
| 布局 | 项目、对话、预览、发布同一页面；桌面端左对话右预览，移动端底部 Tab | 本地编辑器写代码，Maker 负责构建、预览、发布 |
| 适合 | 快速试玩、纯对话创作、手机分享 | 已有代码/素材、要用本地 Agent、要接 Git 与本地检查 |
| 素材与脚本 | 平台内管理 | 文件在本地目录，改完由 Maker 构建 |
| 预览 | 网页预览 + 分享链接/二维码 | 本地 Runtime 预览 + 远端构建验证 |
| 积分 | 对话与生成消耗积分 | 同样消耗（本地不等于免费，云端能力照常计费） |

两种方式共用同一套项目、主题、素材规范与发布流程；差别在「代码和素材放在哪、用什么编辑器」。

## 怎么选：决策表

| 情形 | 建议 |
|---|---|
| 第一次做、想最快看到画面 | 浏览器工作区 |
| 已有本地代码或素材，或团队用 Git | 本地 MCP |
| 要用 Codex / Cursor / Claude Code 的工程能力（多文件、重构、测试） | 本地 MCP |
| 只想快速给别人试玩 | 浏览器工作区 + 分享二维码 |
| 需要频繁改配置、看目录结构 | 本地 MCP |

拿不准时：先用浏览器工作区验证玩法，确定方向后再迁到本地做工程化。

## 浏览器工作区要点

- 项目、对话、预览、发布在同一页面；桌面端左侧对话、右侧预览，移动端底部 Tab。
- 对话里可以指定主题、画面方向、素材风格；「工具配置」可设默认图片/视频模型与质量（需先开启「启用工具配置」）。
- 预览支持设备模拟（PC / 手机 / 平板与分辨率），可生成分享链接与二维码（单个分享链接最多 100 人访问）。
- 发布面板负责物料核对与正式发布；发布面板操作本身不消耗创作积分。

## 本地开发模式：安装与初始化

前置：本机有 Node.js 与 npx；已登录 TapTap 制造账号；有一个可用项目（或新建）。

~~~bash
# 只写三家客户端的 MCP 配置（已有项目、只想接 IDE 时用）
npx -y @taptap/maker install --ide codex,cursor,claude

# 完整初始化：登录 → 选择或创建 Maker 项目 → 绑定本地目录 → 拉取项目
npx -y @taptap/maker init
~~~

要点：

- `init` 默认会同时写入 Codex、Cursor、Claude Code 的 MCP 配置，所以通常不必再单独执行 `install`。
- `init` 会把项目拉到**当前目录**：先确认目录为空，或用户明确同意与现有内容合并；不要在有用户文件的目录里贸然执行。
- 初始化后若目录里已有 `assets/`、`scripts/`，先读结构再动手，避免覆盖在用资源。
- 之后在 IDE 里让 Agent 用 Maker MCP 的工具：检查项目、构建并打开预览、生成素材、发布前检查等；工具名随版本变化，以实际连接到的为准。

更新组件（引擎文档、Lua 类型声明、系统 Skill、urhox-libs 会一起更新）：

> 更新当前项目的 Maker MCP 和 AI DevKit，然后告诉我实际使用的版本。

- 生产用 `pd/stable` 通道，开发/试验用 `rnd/latest`；不要在生产项目上随意切到 latest。

## 本地项目目录长什么样

典型结构（随项目变化，以实际为准）：

~~~text
<项目根>/
  assets/            # 资源根目录，新文件会被运行时补 .meta 并打进构建
    image/
    sprites/
    audio/
    video/
  scripts/           # Lua 脚本
  .project/          # 项目配置（如 settings.json、resources.json）
~~~

纪律：

- 中间产物（抽帧、临时图、待选 BGM）不要放 `assets/`，放项目外的 `sucai/` 之类的临时目录，并加 `.gitignore`；只有成品才进 `assets/`。
- 不擅自移动、重命名、删除用户已有资源；要改先说明影响。
- 构建产物与 `.meta` 由平台维护，不要手写伪造。
- Maker 运行时会提交并推送整个工作区：任何凭证、密钥都不能落在项目目录里。

## 本地 Runtime 与 Maker MCP 能力

- 本地 Runtime 提供 Windows / macOS 版本，客户端游戏可以直接本地预览；服务端脚本或配置改动仍需远端构建验证。
- Maker MCP 常见能力：检查/初始化项目、构建并打开预览、生成美术素材并写入资源目录、发布前检查广告配置（确认后同步）、按 TapID / 游戏 UID / 论坛帖子 ID 查询线上反馈。
- 本地开发不代表免费：素材生成等云端能力照常消耗积分，具体以页面显示为准。

## 协作者模式

- 项目归属人凭对方的开发者 TapID 添加协作者；对方须先登录过 Maker。
- 最多 5 名协作者（不含归属人）；协作者的消耗由归属人承担。
- 协作者只能看到自己创建的对话；不能发布、管理成员或转移所有权。
- 多人改同一文件可能 Git 冲突：先按功能分范围，提交前让 AI 检查工作区与最近变更。

## 制造 Skills

- Maker 里也可以安装「制造 Skills」：把可复用知识和工作流（Markdown 指令、JSON 配置、脚本、参考图）挂到项目里。
- 可浏览、安装、更新、卸载；单个 Skill 可下载为 ZIP（单文件夹全部文件 ≤2MB）。
- 同类 Skill 不要装太多，规则容易冲突；安装前检查是否含账号密钥等私有信息。

## 文档索引与阅读顺序

官方建议的阅读顺序：创建第一个游戏 → 用 AI 对话开发 → 积分规则 → 预览调试与发布 → 运行环境与数据 → UI 主题 → 素材 / 制造 Skills / 本地开发 → 协作者模式。

| 想查什么 | 文档 | Markdown 直取 |
|---|---|---|
| 产品全貌 | overview | <https://maker.taptap.cn/docs/overview.md> |
| 第一个游戏 | getting-started | <https://maker.taptap.cn/docs/getting-started.md> |
| 对话开发与需求写法 | ai-creation | <https://maker.taptap.cn/docs/ai-creation.md> |
| 积分 | credits | <https://maker.taptap.cn/docs/credits.md> |
| 预览与发布 | preview-publish | <https://maker.taptap.cn/docs/preview-publish.md> |
| 运行环境与存档 | runtime-data | <https://maker.taptap.cn/docs/runtime-data.md> |
| 素材 | assets | <https://maker.taptap.cn/docs/assets.md> |
| UI 主题 | ui-themes | <https://maker.taptap.cn/docs/ui-themes.md> |
| 制造 Skills | skills | <https://maker.taptap.cn/docs/skills.md> |
| 本地开发 | local-development | <https://maker.taptap.cn/docs/local-development.md> |
| 协作者 | collaborators | <https://maker.taptap.cn/docs/collaborators.md> |
| Benchmark | benchmark | <https://maker.taptap.cn/docs/benchmark.md> |
| 制造研究所 | institute | <https://maker.taptap.cn/docs/institute.md> |

## 常见误区

- 「本地开发就不用花积分」：错，云端生成照常计费。
- 「init 只是装配置」：它会登录并拉取项目，可能改动当前目录。
- 「MCP 工具名固定」：随版本变化，以实际连接到的工具列表为准。
- 「协作者能发布」：不能，发布权在归属人。
- 「素材随便放 assets/」：所有新文件都会进构建，中间产物要放外面。
