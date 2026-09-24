---
contract: 1
overlays: [README.md, scaffolding.md]
---

# mcp-metadata-demo — local overlays for rich-domain-mcp-server

This repo is where the skill is developed and measured: one MCP server (`src/server.ts`) built in
several frozen variants ("arms"), an eval set in `evals/`, and the paper
["The Missing Layer"](https://davidgolverdingen.nl/en/the-missing-layer). It also dogfoods the
overlay mechanism: the repo-specific steps below used to live in the generic skill.

## Boundaries with other skills

- Running or scoring the eval set, comparing arms or models: the `run-eval` skill.
- Measured arms are frozen (`src/arms-frozen.test.ts`); build a new variant beside them, never edit one.

## Reference implementations

The skill's own *Reference implementation* table is this repo's; there is nothing to add here.
