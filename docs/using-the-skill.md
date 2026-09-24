# Using the skill in your own repo

The skill is meant to be copied into other repos **unchanged**, so that a later sync is a copy,
not a merge. Your own knowledge — platform and deploy wiring, auth, vendor quirks, conventions,
telemetry, your own reference implementations, your own evidence — goes in overlays that the
skill reads at fixed points.

1. **Copy the skill folder** — `.claude/skills/rich-domain-mcp-server/`, and the `.codex/` copy
   if you use Codex — and record the commit or tag you took. Pin a tag (`skill-v1.0.0`, …) rather
   than `main`.
2. **Create `.skill-local/rich-domain-mcp-server/` at your repo root**, starting from the skill's
   [`local-template/`](../.claude/skills/rich-domain-mcp-server/local-template/README.md). One
   overlay per document, same file name; `README.md` overlays `SKILL.md` and is read first. Keep
   only the files you fill, and list them in the README's front matter.
3. **Add a state-based trigger** to your always-loaded project guide (`CLAUDE.md`, `AGENTS.md`),
   outside any block a tool regenerates: "invoke `rich-domain-mcp-server` before creating or
   editing anything under `<servers dir>`".
4. **Check after every sync:**

   ```bash
   node .claude/skills/rich-domain-mcp-server/check-overlays.mjs
   ```

The contract — which documents take an overlay, the version, and what a major bump means — is in
[`overlays.json`](../.claude/skills/rich-domain-mcp-server/overlays.json) and in the skill's
*Local overlays* section. An overlay may tighten any rule; it may relax a rule that carries an
evidence tag only with a local evidence row that points at a reproducible artifact.

This repo dogfoods it: its own overlays are in
[`.skill-local/rich-domain-mcp-server/`](../.skill-local/rich-domain-mcp-server/README.md).
