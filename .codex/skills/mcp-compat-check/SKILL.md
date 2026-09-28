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

# mcp-compat-check — does the metadata reach the model on every client?

A server can ship perfect metadata and still not deliver it, because each client cuts or drops
different surfaces. This check compares what a server ships with what each client delivered when
it was measured (2026-09-27; evidence: `rich-domain-mcp-server` → `references/evidence.md`, tag
HD). It is static: no model and no tool calls, so it runs in seconds and gives the same answer
every time.

## Run it

```bash
node .claude/skills/mcp-compat-check/check.mjs https://example.com/mcp
node .claude/skills/mcp-compat-check/check.mjs --header "Authorization: Bearer $TOKEN" https://example.com/mcp
node .claude/skills/mcp-compat-check/check.mjs --stdio -- node dist/stdio.js
node .claude/skills/mcp-compat-check/check.mjs --json https://example.com/mcp   # for CI or diffing
```

Never put a token in the command yourself: ask the user to export it as an environment variable,
and pass the variable.

## What it checks, per client column

| surface | Claude only (Code, claude.ai, Cowork) | ChatGPT / Codex only | all clients |
|---|---|---|---|
| tool description | ≤ 2,048 (Claude Code cuts there) | no cut measured | ≤ 2,048 |
| server instructions | ≤ 2,048, and nothing required (claude.ai chat gets none) | ≤ 512, and nothing required (Work gets none) | ≤ 512, nothing required |
| input schema | whole | ≤ 5,000 serialized, or every describe is dropped | ≤ 5,000 |
| output schema | never delivered: meaning there is review-only | delivered on Codex and Work | review-only |

It also flags: guidance that lives mostly in the server instructions, tools with a first sentence
too short to be found by clients that load tools by search, missing annotations, and the size of
`tools/list`, which is re-sent every turn.

## Reading the report

- 🔴 **red**: part of the metadata does not reach the model on that client. The number of lost
  characters or dropped describes is in the finding.
- 🟡 **amber**: review. Output-schema describes are not delivered on the Claude clients; they are
  fine if the same meaning travels in the field names or the response, which a static check
  cannot see. Server instructions within budget are amber too, because some clients deliver none.
- 🟢 **green**: within every measured limit for that client.

Start with the "Start here" list. For each fix, use the `rich-domain-mcp-server` skill: its
*Budgets by target client* table has the rule and its evidence, and its REQUIRED guidance-tool
pattern holds detail that does not fit a budget.

## Limits

- One day's client versions. Re-measure before relying on a number: the quote probe and the Codex
  request trace are in `rich-domain-mcp-server` → `references/delivery.md`.
- It does not call tools, so it cannot see the response, where most meaning should live.
- A green report means the metadata arrives. It says nothing about whether the metadata is right.
