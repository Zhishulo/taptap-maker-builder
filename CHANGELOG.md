# Changelog

## Unreleased

- `tools/open-market-pr.ps1`：支持 `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`；修正 WebProxy 绕过列表写法（`*.local` 会被当作非法正则，改为 `.*\.local`）。
- `tools/open-market-pr.ps1`：请求加 60 秒超时，传输层失败（状态 0）自动重试两次；之前无超时，代理抖动时脚本会无限挂起。

## 0.1.0 — 2026-11-03

- 首个版本：技能正文 `SKILL.md`（226 行）+ 8 篇 references + 4 个模板 + 3 个 Python 校验脚本。
- 技能插件外壳：`package.json` 声明 `dsh.bundle`、`cordis.patch.yml`、零依赖 provider `lib/index.js`，把包自带的 `SKILL.md` 挂进 `ctx.skills`。
- `tools/selftest.mjs`：不依赖宿主，校验 frontmatter、provider、正文引用资源是否齐全。