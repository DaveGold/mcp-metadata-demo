---
name: rich-domain-mcp-server
description: >-
  Guides building a NEW rich-domain MCP server or tool, and auditing an EXISTING one up to a
  measured reference, using Introspective Context Engineering: discover the domain from live
  data, name fields so they cannot be misread, deliver guidance where the model actually receives
  it (description head, input schema, response — not the output schema, not past char 2,048),
  compute determinate verdicts, record provenance per rule, and measure the result. Invoke when
  asked to add, build, scaffold or wire an MCP server or tool; review, audit, enrich or fix tool
  metadata (descriptions, inputSchema, outputSchema, field names, alerts, interpretation,
  summaries); run a data-discovery session against an API (what does this field mean, which
  fields are null, probe the API); decide where discovered knowledge should be written down;
  prepare a domain-expert validation session; or measure a metadata change with an eval. Also
  triggers on "the agent picks the wrong tool", "the agent misreads this field", "the agent
  ignores the description", user-feedback triage, and tool-call-log pattern analysis.
metadata:
  version: 1.1.1
---

Read and follow the canonical project skill at
[`.codex/skills/rich-domain-mcp-server/SKILL.md`](../../../.codex/skills/rich-domain-mcp-server/SKILL.md).
It is a byte-identical copy of `.claude/skills/rich-domain-mcp-server/`; `src/skill-copies.test.ts`
keeps the two in sync.
