---
name: mcp-compat-check
description: >-
  Checks in about a minute whether an MCP server's metadata survives the clients it will run in
  (Claude Code, claude.ai, Cowork, ChatGPT Chat and Work, Codex): reads tools/list and the server
  instructions over HTTP or stdio, and scores each tool against each client's measured limits on
  descriptions, server instructions, input schemas and output schemas. Invoke when asked to check,
  health-check, lint or score an MCP server, to ask "will this server work in ChatGPT / Codex /
  claude.ai", "why does the agent ignore my description or parameter docs", or to compare public
  servers. Hands fixes to the rich-domain-mcp-server skill.
metadata:
  version: 1.0.0
---

Read and follow the canonical project skill at
[`.codex/skills/mcp-compat-check/SKILL.md`](../../../.codex/skills/mcp-compat-check/SKILL.md).
It is a byte-identical copy of `.claude/skills/mcp-compat-check/`; `src/skill-copies.test.ts`
keeps the two in sync.
