---
name: rich-domain-mcp-server
description: >-
  Guides building and enriching rich-domain MCP servers and tools using Introspective
  Context Engineering — scaffold something simple, then run the Examine → Flag → Validate
  → Encode → Iterate loop until the tool teaches the agent the domain. Invoke when asked to
  add, build, scaffold or wire a new MCP server or backend, add or change an MCP tool,
  enrich or review tool metadata (description, inputSchema, outputSchema, .describe(),
  .meta(), summarize, alerts, RETURNS/WHEN TO USE/INTERPRETATION blocks), run a
  data-discovery session against an API (explore the data, what does this field mean,
  which fields are null, probe the API, API findings), or prepare a domain-expert
  validation session on discovered metadata (confidence markers, questions for a subject
  matter expert). Also triggers on "the agent picks the wrong tool", "the agent doesn't
  understand this field", user-feedback triage, and tool-call-log pattern analysis.
---

# rich-domain-mcp-server — build & enrich MCP servers

A well-built MCP codebase gives you transport, logging, and (optionally) auth for free. What
you actually build is **metadata**: the tool descriptions and schemas an agent reasons over at
call time. Plumbing is a day; metadata is the product.

The method is **Introspective Context Engineering**: you do not write the domain knowledge from
documentation — you *discover* it from the live data, get it confirmed by someone who knows the
business, and encode it where the agent reads it.

**Two rules drive everything:**

- **Tool descriptions and INPUT schemas are the most portable model-facing channels.** In the
  clients measured for this project (Claude Code, claude.ai, and OpenAI's Responses API), output
  schema annotations were not forwarded to the model; use them for validation and UI, and do not
  make essential interpretation depend on them unless you have verified the target client. Server
  instructions, MCP Resources, and meta-tools are also client-dependent, so do not make them the
  sole delivery path for essential guidance. Put output-reading knowledge in the **description**
  or returned data; keep output annotations **shape-only** by default.
- **Discovery beats documentation.** Vendor docs describe the happy path. Null patterns, silently
  ignored parameters, lying totals, and broken joins only show up when you interrogate real rows.

This companion repo ([mcp-metadata-demo](https://github.com/DaveGold/mcp-metadata-demo)) practices
exactly this: see [get-building-profile.ts](../../../src/tools/get-building-profile.ts) for a
worked rich-domain tool, and the paper it accompanies,
["The Missing Layer"](https://davidgolverdingen.nl/en/the-missing-layer), for the underlying
argument.

---

## The loop: EFVEI

Scaffold once. Then loop — 3–4 passes per tool is normal, and the loop never really closes, because
production telemetry keeps reopening it.

```
SCAFFOLD   ship something simple straight from the API docs
   │
   ├─► EXAMINE    interrogate the live data through the deployed tools, in a FRESH context
   │      │
   │   FLAG       tag every pattern with a confidence level + a question, while you find it
   │      │
   │   VALIDATE   a domain expert confirms or kills the uncertain ones — an afternoon, batched
   │      │
   │   ENCODE     write it back into description blocks + schema annotations → redeploy
   │      │
   │   ITERATE    telemetry (queryIntent, tool-call logs, user feedback) exposes the next gap
   │      │
   └──────┘

HARDEN     tests, docs, project agent guide — once the loop stabilises
```

Copy this checklist into your response and tick it off:

```
- [ ] S. Scaffold: client (if any) + server.ts + a simple tool + deploy
- [ ] E. Examine: directed interrogation in a FRESH context — the probe matrix
- [ ] F. Flag: every finding carries [CONFIDENCE: …  TODO: DOMAIN EXPERT — …]
- [ ] V. Validate: LOW/MEDIUM markers batched into one expert session; answers dated
- [ ] E. Encode: description blocks (interpretation here), shape-only output .meta(), transform, summarize, alerts → redeploy
- [ ] I. Iterate: back to Examine in a new context; then telemetry drives the next round
- [ ] H. Harden: unit tests, docs/<name>-api-findings.md, project agent guide
```

## Scaffold — ship something simple

Do not design the tool surface up front. Build the client (if the API needs one), one plain tool,
and deploy — everything after this is informed by data you do not have yet.

Full file-by-file wiring: **`references/scaffolding.md`**. Handler-factory contract and its
non-negotiable invariants: **`references/handlers.md`**.

Minimum to be reachable:

| File | What |
|---|---|
| `src/<name>-client.ts` | auth (if any) + token cache + `get<T>()` — skip entirely if the API is public/keyless |
| `server.ts` | `McpServer` + instructions skeleton + tool registration |
| `tools/<entity>.ts` | one simple tool |
| an entrypoint export | however your runtime wants it (Firebase Function, plain HTTP server, stdio) |

**Keep the metadata thin on purpose.** A first tool has `queryIntent`, `summaryOnly`, the domain
params you are sure of, a permissive output schema, and a one-line description ending in
`[Stub — enriching after discovery.]`. Everything richer you could write now is guesswork copied
from vendor docs — and guesswork that ships is guesswork nobody re-checks.

If your server needs auth, start behind a narrow allowlist and widen it only once the metadata is
real — a bootstrapping server with stub descriptions teaches people the wrong things about the data.

## Examine — interrogate the live data

**This is where the value is. Route to `references/discovery.md` and follow it.**

Two non-negotiables:

- **Deploy first, then examine through MCP.** The primary loop is: deploy → open a **fresh chat
  context** → let the agent call the real tools and hammer them with variations. Direct HTTP probing
  is the fallback for when the vendor docs are bad, auth is unknown, or the endpoint shape is a
  mystery — not the default.
- **Fresh context is mandatory, not hygiene.** MCP clients cache the tool catalog per chat session,
  so a redeploy is invisible in a running chat even after a reconnect. And an agent that watched you
  write the description will confirm your assumptions instead of testing them.

You are an operator, not a requester: one directed instruction at a time, read the answer, let it
choose the next question. "Examine the data" produces a summary of the first page; the first page is
never representative.

Nine dimensions, with the exact prompts, in the reference: shape · **null patterns per slice** ·
cardinality and enums · sortability and ordering · filter/operator semantics and silently-ignored
params · pagination edges and lying totals · join reliability and coverage · temporal edges and
sentinels · the failure surface.

## Flag — tag uncertainty while you find it

During examination, not after. The moment you write a finding down, it carries its confidence and
the question it raises:

```
[CONFIDENCE: HIGH|MEDIUM|LOW — <observation>. TODO: DOMAIN EXPERT — <question>]
```

**HIGH** — confirmed across many records and several slices.
**MEDIUM** — observed, but exceptions are plausible.
**LOW** — inferred from limited data, or possibly environment-specific.

Without markers, ambiguous discoveries get silently resolved with the model's best guess — which for
domain-specific knowledge is usually wrong, and invisibly so. Markers live inline in the tool (as
code comments or in the description) and in the findings doc, and they are removed as they get
answered, so what remains inline is always the open edge.

## Validate — an afternoon with someone who knows the business

The step that is easiest to skip and most expensive to skip. Roughly 90% of AI-discovered metadata
holds up under expert review; the other 10% is precisely the part that would have shipped as
confident, plausible, wrong.

**Route to `references/validation.md`** for the session protocol. The short version: batch the
markers (never drip-feed), take LOW first, and ask closed questions backed by a data sample — *"29
of 31 records in category R have no fiscal year; is that a legacy import or a real state?"* beats
*"what does this field mean?"*. Record each answer with a date in `docs/<name>-api-findings.md`,
encode it, and delete the marker.

An expert answer that contradicts the data is not a correction — it is a new finding. It usually
means config drift, an environment difference, or a process that changed without the data changing.

## Encode — write it back into the tool

Discoveries go into the tool, not into a wiki. Five layers, all of them:

1. **Description blocks** (model-visible) — canonical core RETURNS · WHEN TO USE · WHEN NOT TO USE ·
   QUERY STRATEGY · INTERPRETATION · RELATED TOOLS, plus a FEEDBACK line if you have a feedback
   mechanism, and earned blocks when justified. **Output-field interpretation lives here** — it
   cannot reach the model any other way.
2. **Input schema** (model-visible) — `.meta({ description, examples })` per param: formats, working
   example values, operators, and explicit warnings about params that misbehave
3. **Output schema** (validation + UI; not a guaranteed model channel) — `.meta()` kept
   **shape-only**: type + optional + short identity, no interpretation, no pointer
4. **`transform`** (returned data — model-visible) — derived fields that collapse flag-combinations
   into one readable label
5. **`summarize`** (returned data — model-visible) — domain aggregation + `interpretation.alerts`

**The whole shape in one place** (generic — swap `Order`/`Customer` for your own domain):

```ts
const description = `\
RETURNS: Orders with OrderId, CustomerName, OrderDate, OrderStatus (Pending/Shipped/Cancelled),
FulfillmentStatus (derived — see INTERPRETATION). Plus a summary and pagination.

WHEN TO USE:
- "What did customer X order?" / "Which orders are still unpaid?"

WHEN NOT TO USE:
- Invoice line items → use get_invoice_lines instead.

QUERY STRATEGY:
- Call summaryOnly=true first for counts by status; fetch full records only for one customer/date range.

INTERPRETATION:
- FulfillmentStatus: 'Shipped' (paid+shipped), 'AwaitingShipment' (paid, not yet shipped),
  'ShippedUnpaid' (shipped, invoice outstanding), 'AwaitingPayment' (neither).

RELATED TOOLS:
- get_customer(CustomerId) → account details, credit status.

ALERTS: flags any order unpaid more than 30 days after shipment.`;

const inputSchema = {
  customerId: z.string().regex(/^\d{6}$/).optional().meta({ description: 'Customer account number, 6 digits.' }),
  summaryOnly: z.boolean().optional().default(false).meta({ description: 'Summary + alerts only, no rows.' }),
  queryIntent: z.string().optional().meta({ description: 'The business question this call answers.' }),
};

const outputSchema = {
  recordCount: z.number().meta({ description: 'Rows in this page.' }),
  summary: z.object({ byStatus: z.record(z.string(), z.number()).meta({ description: 'Count per OrderStatus.' }) }),
  records: z.array(z.object({
    OrderId: z.string().meta({ description: 'Order number' }),
    CustomerName: z.string().nullable().meta({ description: 'Customer name' }),
    OrderStatus: z.string().meta({ description: 'Order status' }),
    FulfillmentStatus: z.string().optional().meta({ description: 'Derived fulfillment label' }),
  })).optional(),
  interpretation: z.object({ alerts: z.array(z.string()) }),
};

// Layer 2 enrichment (transform, before summarize) — collapses two flags into one readable label
function transformOrders(records: OrderRow[]): void {
  for (const row of records) {
    if (row.IsPaid && row.IsShipped) row.FulfillmentStatus = 'Shipped';
    else if (row.IsPaid) row.FulfillmentStatus = 'AwaitingShipment';
    else if (row.IsShipped) row.FulfillmentStatus = 'ShippedUnpaid';
    else row.FulfillmentStatus = 'AwaitingPayment';
  }
}

function summarizeOrders(records: OrderRow[]): SummaryResult {
  const alerts: string[] = [];
  const byStatus: Record<string, number> = {};
  for (const row of records) {
    byStatus[row.OrderStatus] = (byStatus[row.OrderStatus] ?? 0) + 1;
    if (row.FulfillmentStatus === 'ShippedUnpaid') alerts.push(`Order ${row.OrderId} shipped but unpaid.`);
  }
  return { summary: { byStatus }, interpretation: { alerts } };
}

server.registerTool(
  'get_orders',
  {
    title: 'Orders',
    description, inputSchema, outputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  createRestHandler(client, {
    toolName: 'get_orders', operationName: 'GetOrders',
    execute, transform: transformOrders, summarize: summarizeOrders, outputSchema,
  })
);
```

That's the pattern standalone — no reliance on any one codebase's files. `createRestHandler` is
illustrative of the 6-step lifecycle (permission check → execute → transform → summarize → validate
→ log); any codebase can write those 6 steps by hand without a shared factory — see
[get-building-profile.ts](../../../src/tools/get-building-profile.ts)'s `resolveBuildingProfile` +
`generateAlerts` in this same repo for exactly that: no shared handler factory, the same six
concerns written out directly.

Rules, examples and the per-tool checklist: **`references/metadata.md`**.

Then redeploy and go back to Examine — in a *new* fresh context. A description that survives a
second interrogation is a description that works.

## Iterate — let production find the next gap

The loop does not end at deploy; it changes its input from your probes to real usage. If your
handlers log tool calls anywhere (a database, structured logs, whatever you have), that log is the
next probe.

- **`queryIntent` read as a narrative.** Three calls with tightening filters and intents that drift
  from *"which orders exist for this customer"* to *"only completed ones — the previous call also
  returned open orders"* names the exact missing sentence. That fix takes minutes.
- **Call-shape patterns** — repeated calls, deep pagination, tools never selected. A pagination
  nudge that fires often is a missing `summary` dimension, not a user error. If you have a saved
  query or a dashboard over your tool-call log, run it periodically; if not, grep the log directly.
- **User-reported friction** (a `report_problem`-style tool, a feedback channel, or just users
  telling you something was confusing) — the join key, if you have a session/call ID available, is
  what links a report to the full call sequence that preceded it.

Details in **`references/validation.md`**.

## Harden — once the loop stabilises

- **Unit tests** (`vitest` or your test runner): one `<tool>.test.ts` per tool + a client test.
  Cover the shape contract, the `transform`/`summarize` logic, and each empirically-discovered quirk
  (a sentinel normalisation, a null pattern) — those are exactly what a vendor fix will silently
  change.
- **A way to manually exercise the tool** — the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
  works with any MCP server and needs no custom UI (this repo uses it: `npm run inspect`).
- **`docs/<name>-api-findings.md`**: the discovery log — evidence, open markers, vendor bugs,
  re-check agenda. Structure in `references/discovery.md`.
- **Project agent guide** (`AGENTS.md`, `CLAUDE.md`, or equivalent): server list, deploy command,
  code-organization tree, and key technical details (auth, secrets, timeout, quirks).
- **An MCP client configuration** (for example `.mcp.json` for Claude Code) for local connection;
  use the equivalent connector/configuration supported by the client you are testing.

---

## Hard rules

- **Never claim in a description what you have not observed.** "Usually populated" without a count
  is a guess. Give the number, or the confidence marker.
- **A finding without a confidence level is not a finding.** It is an assumption that has lost its
  audit trail.
- **Every response must be safe to interpret.** `interpretation.alerts` always present; an empty
  result must tell the agent *which branch it is in* — "wrong lookup, try again" vs "valid, nothing
  here". Use a tool-specific empty-result hint; never let a shared generic hint name parameters a
  tool does not have.
- **All four `annotations` explicit** — `destructiveHint` and `openWorldHint` default to `true` in
  the spec, so an omission mislabels a read-only tool.
- **Title in the source language if your domain has one, description in English** with domain terms
  glossed on first use — `Voorraadmutatie (stock mutation — inventory in/out events)`.
- **Do not make meta-tools or Resources required for core guidance.** Build the real tool and put
  essential instructions on it; use other MCP primitives only after confirming the target client
  surfaces and selects them. (`z.object({})` also breaks parameterless tools — use `{}` or omit
  `inputSchema`.)
- **Never silently sum a counter.** If aggregation semantics depend on metadata not present in the
  data response (unit, counter-vs-period), fetch it explicitly. A silent fallback is worse than a
  hard error because nobody sees it.
- **API limits are vendor config.** Fetch and cache them if the vendor exposes a limits endpoint;
  don't hardcode a constant that drifts.
- **Deploy before testing MCP tools whenever they run as a hosted function** — a local run and a
  deployed run can differ (cold starts, secrets, region).
- **A removed function export must actually be removed from production** or your next deploy step
  may abort trying to reconcile an orphaned function, depending on your hosting platform.

## Routing

| You are doing… | Open |
|---|---|
| Scaffold: wiring files, secrets, deploy, CI, project agent guide | `references/scaffolding.md` |
| Examine + Flag: interrogating an API, the probe matrix, findings doc | `references/discovery.md` |
| Validate + Iterate: expert session, telemetry, feedback triage | `references/validation.md` |
| Encode: writing/reviewing descriptions & schemas, per-tool checklist | `references/metadata.md` |
| Handler lifecycle contract, alerts, logging, output validation | `references/handlers.md` |

## Reference implementations in this repo

The generic example above is enough to apply the pattern anywhere. This skill ships inside
[mcp-metadata-demo](https://github.com/DaveGold/mcp-metadata-demo), so these are worked, tested
examples sitting right next to it:

| Pattern | File |
|---|---|
| Richest single-tool metadata (description ↔ output-schema split) | [get-building-profile.ts](../../../src/tools/get-building-profile.ts) |
| Derived-field enrichment (Layer 2) + curated alerts | `generateAlerts`/`resolveBuildingProfile` in the same file |
| Interactive / MCP App tool (renders UI, doesn't just return data) | [render-chart.ts](../../../src/tools/render-chart.ts) |
| Field-projection ("Select") as its own tested unit | [project-fields.ts](../../../src/domain/project-fields.ts), used by [get-weather-context.ts](../../../src/tools/get-weather-context.ts) |
| Deliberately ablated tier (what happens with no metadata layer) | [get-building-profile-minimal.ts](../../../src/tools/get-building-profile-minimal.ts) |

## Caveats

- **Zod 4 `.meta()` vs `.describe()`** — prefer `.meta({ description, examples })` in new code (it
  carries `examples`, which help on INPUT). `.describe()` remains equivalent for description-only
  and is perfectly fine — just without `examples`. In the clients measured for this project, INPUT
  annotations reached the model and OUTPUT annotations did not; verify that behaviour for another
  target client before relying on it.
- **Discovery findings expire.** Pre-release and beta APIs change under you; every claim in a
  description is a maintenance liability. Put a re-check section in the findings doc.

## Example requests

- "Add an MCP server for backend X" → the full loop, starting at Scaffold.
- "I want a new tool on this server for entity Y" → Scaffold (tool only) → EFVEI.
- "The agent keeps picking get_dossier when get_project was meant" → Encode: WHEN NOT TO USE +
  RELATED TOOLS in both tools (`references/metadata.md`).
- "What does this field actually mean / which fields are always empty?" → Examine + Flag
  (`references/discovery.md`), then Encode the answer into the schema.
- "Prepare the open questions for the domain expert" → Validate (`references/validation.md`).
- "Enrich these tools with what we learned last week" → Encode only.
