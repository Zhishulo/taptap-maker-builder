## What this adds

`Zhishulo/taptap-maker-builder` — a skill plugin for **TapTap Maker** (TapTap 制造, UrhoX engine + Lua), the AI game-creation tool where you describe a game and it builds, previews and publishes it.

The shipped `SKILL.md` is mounted into `ctx.skills` by a zero-dependency provider in `lib/index.js`. It covers, in Chinese because the product and all of its docs are Chinese:

- choosing between the browser workspace and the local Maker MCP route;
- extracting the five elements of a design brief and writing a first-round prompt for a minimal playable core loop;
- iterating in the official order, then checking preview and release materials;
- the credit, credential and irreversible-action limits of the product.

Alongside the skill body: 8 reference notes, 4 templates, and 3 read-only Python checks (brief completeness, project layout, release materials) that use only the standard library. `tools/selftest.mjs` runs 27 checks without the host: it parses the frontmatter, calls the provider `list()`/`get()`, and verifies every `./` resource referenced by the body exists.

No network calls, no credentials, no install-time scripts, zero runtime dependencies. MIT.

Entry: category `skill`. The plugin ships its own behaviour and content; it is not a meta-package.
