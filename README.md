# taptap-maker-builder

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4B6BFB.svg)](https://github.com/deepseek-ai/deepseek-harness)

A DeepSeek Harness (dsh) skill plugin that takes a game design brief and builds it into a playable, publishable project on **TapTap Maker** (UrhoX engine + Lua): pick a creation mode, extract the five elements, write the first prompt, iterate in the official order, accept in preview / on device, then check release materials — while keeping credit and credential red lines.

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md). The skill itself is written in Chinese because the product and its docs are Chinese.

## Install

Once listed in the plugin market: **Settings → Plugins → Plugin Market**, search `taptap-maker-builder`. Before that, install from GitHub:

```sh
dsh plugin --profile <your-profile> add github:Zhishulo/taptap-maker-builder
```

Restart dsh afterwards. The skill then joins the skill catalog and loads automatically when a matching request arrives; you can also invoke it by name.

Installing the plugin does not install the environment: it ships no Maker MCP and does not sign you in to TapTap. To work in a local directory, follow the official docs (`npx -y @taptap/maker init`) and wire the MCP into your IDE.

## When it triggers

- Questions about TapTap Maker / Maker / UrhoX / credits / UI themes / the benchmark leaderboard / local MCP setup;
- A game design brief attached or pasted with a request to build it, write prompts for it, or prepare a release.

Not for: Unity / Unreal and other engines; pure art outsourcing; general programming unrelated to Maker.

## What is inside

| File | Purpose |
|---|---|
| `SKILL.md` | Skill body: product in 60 seconds, reference routing table, stages 0–6, red lines |
| `references/01`–`08` | Product overview, credits and cost, UI themes and assets, benchmark guide, brief parsing, iteration and acceptance, publish checklist, safety and credentials |
| `assets/*.md` | Four templates: brief confirmation, first prompt, four-part feedback, stage report |
| `scripts/*.py` | Three read-only checks (Python standard library only): brief completeness, project layout, publish materials. Exit 0 = pass, 1 = problems, 2 = usage error; `--json` for machine output |
| `lib/index.js` | Zero-dependency skill provider that mounts `SKILL.md` into `ctx.skills` |
| `tools/selftest.mjs` | Host-free self test: parses SKILL.md, runs `list()`/`get()`, verifies every `./` resource exists |

## Usage

```sh
python scripts/check_brief.py brief.json
node tools/selftest.mjs
```

## License

MIT. The knowledge was compiled from the official TapTap Maker docs (<https://maker.taptap.cn/llms.txt>, compiled 2026-11-03); the docs stay authoritative.
