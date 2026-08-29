# Encode — writing discoveries back into the tool

The fourth step of the EFVEI loop: everything Examine found and Validate confirmed becomes tool
metadata here, or it may as well not exist.

Tool descriptions and input-schema annotations are the primary model-facing channels for this
method. In the clients measured for this project (Claude Code, claude.ai, and OpenAI's Responses
API), output-schema annotations were not forwarded to the model, although they still did real work
for *validation* (`outputValidator.safeParse`) and *UI rendering*. Server instructions, Resources,
and meta-tools are client-dependent too. Therefore, put the guidance an agent must have to choose,
call, and read a tool in its **description** or input schema — or, for output values, in the
**returned data itself** (source-side joins + derived fields, §4). Do not rely on output annotations
as the only source of interpretation unless you have verified delivery in the target client.

---

## 1. Tool description — the blocks the agent needs

Written in English, domain terms kept in the source language with an English gloss (e.g.
`Voorraadmutatie (stock mutation — inventory in/out events)`). The agent reads it once and reasons with it repeatedly — but
it now pays a per-call token cost, so every block must carry decision-relevant knowledge.

**Blocks are EARNED, not templated.** A block exists because the agent *fails* without it and its
content does not fit an existing block. Default to folding new knowledge into an existing block; open
a NEW block only when the content is (a) decision-relevant (the agent picks or uses the tool wrong
without it), (b) genuinely does not fit any block below, and (c) substantial enough for its own
heading — a single line belongs as a bullet, not a block.

**Canonical core** — reach for these first, in this order:

```
RETURNS:
<What comes back, in business terms. Name the key fields that drive tool selection, AND the
field-value knowledge the agent needs to READ the output — glossaries, derivations, caveats.
Do not tell the agent to "see outputSchema" unless the target client demonstrably exposes it. Include
real, counted volumes; flag any vendor number known to be a lie.>

WHEN TO USE:
- <The question this tool answers, phrased the way a user would ask it.>

WHEN NOT TO USE:
- <Adjacent question> → use <other_tool> instead.
- <A path the API cannot serve, plus the workaround that does work.>

QUERY STRATEGY:
- <summaryOnly first, then drill down. Page sizes. Cursor/paging rules. What NOT to walk.
  Fold pagination / large-dataset / analytical-query guidance in HERE — not as separate blocks.>

INTERPRETATION:
- <Cross-field rules AND the field-value knowledge needed to read output: type→field-group
  mappings, conditional population, derivations, code meanings, multi-tool lookup chains. This is
  where output-field interpretation has a reliable home when output annotations are not delivered.>

RELATED TOOLS:
- <tool_name>(<join key>) — <what it adds>. Fold routing / cross-reference / prerequisite in here.
```

**Conventions** (server-wide behaviour, not tool knowledge):

```
FEEDBACK: one line, only if you have a feedback mechanism — e.g. "call report_problem(server=\"<name>\")".
  Skip this line entirely if your server has no such mechanism; don't invent one just to fill it.
ALERTS: include ONLY when the tool actually emits interpretation.alerts. A tool that never emits one
has NO ALERTS block — an empty/example ALERTS block is dead text.
```

**Earned blocks** — open one only when the test above passes. Seen in practice and justified:

- **DATA HORIZON & SCOPE** — why a query returns 0 rows (retention window, coverage limit). Not
  "when not to use" (the tool is right, the data is absent) and not query strategy — a distinct,
  high-value caveat. (e.g. a bookings connector that only exposes the last 10 years.)
- **PRIVACY** — sensitive/regulated-data handling (health data, financial records). Compliance-critical,
  must be prominent, does not fold cleanly into INTERPRETATION. (e.g. an HR or medical-records server.)

**Two grammars.** The core above is for **read/query** tools. Two variants:

- **Write/action tools** (e.g. a ticket- or record-writing tool): WHEN TO USE / WHEN NOT TO USE /
  RETURNS(effects) and an **AUTH** note where gating applies; batch / overwrite-guard as bullets, not
  blocks. No QUERY STRATEGY / INTERPRETATION / ALERTS.
- **App/render tools** (a chart/table/game-rendering tool): WHEN TO USE / RETURNS(what renders) /
  **INPUT (data shape)**; field-type / layout details as bullets under INPUT. No QUERY STRATEGY /
  INTERPRETATION / RELATED TOOLS. (This repo's [render-chart.ts](../../../../src/tools/render-chart.ts)
  is a worked example.)

Block-by-block, what breaks without it:

| Block | Without it |
|---|---|
| RETURNS | Agent can't tell whether this tool has the data it needs — or how to read a field |
| WHEN TO USE | Picks the wrong tool, or misses this one entirely |
| WHEN NOT TO USE | Tries this tool for queries that belong elsewhere — name the right tool |
| QUERY STRATEGY | Pulls full records where a summary would do; walks pagination pointlessly |
| INTERPRETATION | Returns raw numbers without conclusions; misreads codes / derived fields |
| RELATED TOOLS | Stops after the first call instead of chaining |

**Hygiene rules**

- **Put output-field interpretation in the description, not only in output `.meta()`.** In the
  clients measured for this project, output annotations did not reach the model. A field's values,
  caveats, derivation and null-meaning that the agent needs → RETURNS or INTERPRETATION; keep the
  output `.meta()` shape-only (§3) unless the target client proves a different contract.
- **No duplication WITHIN the description.** RETURNS is a terse field inventory; INTERPRETATION holds
  the knowledge — do not explain the same field in both. When a fact goes into INTERPRETATION, trim
  the RETURNS entry to a pointer.
- **Avoid duplication between INTERPRETATION and INPUT `.meta()` when the target client exposes input
  annotations.** An input param fully documented on itself does not also belong in INTERPRETATION.
  This does not apply to OUTPUT fields unless their annotations have been verified as model-visible.
- **No code tables inline.** If a code field has a companion description field, join it (§4 layer 1)
  and say so; if it doesn't, get one.
- **Warnings belong where the mistake is made.** A misbehaving *input* parameter is documented on the
  parameter (model-visible). Output-reading warnings go in the description.

**Deduplication pass — run EVERY time a description is authored or changed.** Once the full
description is written or edited, read it end-to-end and check each fact appears **once**:
- No field explained in both RETURNS and INTERPRETATION — RETURNS is the terse inventory,
  INTERPRETATION holds the knowledge; when a fact lands in INTERPRETATION, trim the RETURNS entry to
  a pointer.
- No INPUT-parameter fact repeated in INTERPRETATION when input `.meta()` reaches the target model.
- Do not make the description depend on a model opening the output schema.
- Fold overlapping bullets across blocks (e.g. pagination guidance scattered between QUERY STRATEGY
  and a stray block) into their single canonical home.
Do this as a distinct final step — not while drafting — because duplication creeps in during editing
and drifts apart on the next change.

## 2. Input schema

```ts
export const inputSchema = {
  customerId: z.string().regex(/^\d{6}$/).optional().meta({
    description: 'Customer account number, 6 digits. Known working: 100234 (large account, 400+ orders).',
    examples: ['100234'],
  }),
  summaryOnly: z.boolean().optional().default(false).meta({
    description: 'If true, returns summary + alerts without the row payload.',
  }),
  queryIntent: z.string().optional().meta({
    description: 'One sentence about the business question you are answering. Used for observability.',
  }),
};
```

- **`queryIntent` and `summaryOnly` on every query tool.** `queryIntent` is the observability join
  between a tool call and the user's actual question; `summaryOnly` is what stops agents paginating
  to hand-aggregate.
- **`.meta({ description, examples })`** in new code (Zod 4 — `examples` reaches the JSON Schema).
  `.describe()` is equivalent for description-only and works fine too — match whatever convention
  the rest of your codebase already uses.
- **Working example values, not placeholders.** `'100234'` beats `'a customer ID'`.
- **Formats explicit** — date format including the time component, boolean spelling, regex.
- **Document misbehaving parameters on the parameter**: *"DO NOT PASS in pre-release: empirically
  zeroes out the result set."* An agent that reads this once never wastes a call on it.
- **Defaults save a round trip** — `.default()` wherever a sane default exists.

**If your codebase has a shared factory that builds this from field metadata** (e.g. a
`createConnectorInputSchema(FIELDS)`-style helper — see `references/scaffolding.md`), it can
generate `filters[]` (with an operator reference inline), `orderBy`/`orderDirection`, `skip`/`take`,
`summaryOnly`, `queryIntent`, `select` (server-side projection — a token saver across many rows,
overhead on single lookups — see [project-fields.ts](../../../../src/domain/project-fields.ts) for a
worked, standalone version of this pattern), and one `include<Group>` flag per opt-in field group
kept out of the default response. You only supply the field list:

```ts
const FIELDS = [
  { name: 'CustomerName', type: 'string', filterable: false },  // returned, not filterable
  { name: 'OrderDate', type: 'date' },
  { name: 'ShippingWeightKg', type: 'number', optInGroup: 'logisticsDetails' },
] as const satisfies readonly (FieldMeta & { name: keyof OrderRow })[];
```

The `satisfies` clause is what makes field names compile-time-checked against the row type. Keep it —
and even without a generator factory, hand-writing `inputSchema` still benefits from a `FIELDS`-style
array as the single source of truth for filter/select/row-type field names.

## 3. Output schema — shape-only by default (validation + UI; not a guaranteed model channel)

The output schema validates the payload (`outputValidator.safeParse`) and drives UI rendering. In
the clients measured for this project, its annotations were not model-visible, so keep them
**shape-only** by default: type + `.optional()`/`.nullable()` + a short field identity. Put domain
knowledge in the description (§1) and returned data (§4) unless the target client has a verified,
different delivery contract.

The standard envelope:

```ts
export const outputSchema = {
  recordCount: z.number().meta({ description: 'Rows in this page.' }),
  summary: z.object({ /* domain aggregation the agent would otherwise paginate for */ }),
  records: z.array(z.object({ /* one SHAPE-ONLY .meta() per field */ })).optional()
    .meta({ description: 'Omitted when summaryOnly=true.' }),
  interpretation: z.object({
    alerts: z.array(z.string()).meta({ description: 'Attention points; empty if normal.' }),
  }),
};
```

**Shape-only = a short field identity and nothing the type does not already give:** a few words
naming the field, optionally a bare unit or format token. Optionality/nullability is already carried
by `.optional()`/`.nullable()`, so do NOT explain WHEN or WHY a field is null. No value legends, no
value *meanings*, no derivations, no glossaries, no "use this for…", and **no pointer to the
description** — the default convention is to put output interpretation in the description, where it
is a more reliable delivery channel:

```ts
// identity + type; the "null when cancelled" MEANING lives in the description, not here
CustomerName: z.string().nullable().meta({ description: 'Customer name' }),
// enum field — name it; Pending=awaiting stock / Shipped=dispatched / Cancelled=voided belongs
// in the description, not here
OrderStatus: z.string().meta({ description: 'Order status' }),
// derived field — name it, no mapping
FulfillmentStatus: z.string().optional().meta({ description: 'Derived fulfillment label' }),
```

The knowledge that USED to be crammed here — the null-*meaning*, the join key, the value *semantics*,
the sentinel rule — now lives in the **description** (RETURNS / INTERPRETATION), where the target
model can rely on it, or in the **row itself** via §4. **Identify-before-removing:** before trimming a field's
annotation, confirm every fact it carried is in the description; a mechanical strip loses knowledge.
Keep the type + `.optional()`/`.nullable()` EXACTLY — validation stays byte-identical; only the
describe text is trimmed.

`summary` is not decoration — it is the alternative to pagination, and (unlike the schema annotations)
it IS model-visible, because it is *returned data*. Every dimension an agent would otherwise walk pages
to compute (`byMonth`, `byEmployee`, `totalHours`, `distinctSuppliers`) belongs there. Its `.meta()`
stays shape-only too; the "which question it answers" guidance goes in QUERY STRATEGY.

## 4. Two-layer enrichment — make the data self-documenting

**Layer 1 — source-side description joins.** Configure the source (a GetConnector, a SQL view, an
API include-param) to return `XxxLabel`/`XxxName` next to every `XxxCode`. The agent reads
`CategoryName: "Express shipping"` from the row instead of consulting a mapping table — this alone
can remove thousands of tokens of code-legend tables from a description. Add the join field to the
field list with `filterable: false`, to the output schema, and to the row interface.

**Layer 2 — server-side derived fields.** For interpretations that don't fit a join, compute them in
`transform`, before `summarize`:

```ts
function transformOrders(records: OrderRow[]): void {
  for (const row of records) {
    if (row.IsPaid && row.IsShipped) row.FulfillmentStatus = 'Shipped';
    else if (row.IsPaid) row.FulfillmentStatus = 'AwaitingShipment';
    else if (row.IsShipped) row.FulfillmentStatus = 'ShippedUnpaid';
    else row.FulfillmentStatus = 'AwaitingPayment';
  }
}
```

(A fuller worked version of this pattern, in this same repo: `generateAlerts` in
[get-building-profile.ts](../../../../src/tools/get-building-profile.ts) derives a
warmtepomp-suitability indication and several other advisory fields from raw BAG/EP-Online values.)

One readable label from a closed enum replaces ~200 tokens of boolean-combination prose and is read
correctly every time. Mark derived fields in the row interface as computed by the MCP server, not
returned by the API.

**Enriched summary keys.** Aggregate on `"code: description"` so the agent never needs a lookup:
`{ "P1: High priority": 12 }`.

## 5. Alerts and empty results

`summarize` returns `{ summary, interpretation: { alerts } }`. The handler appends any feedback
reminder and, when `records.length === 0`, the empty-result hint. Get both right:

- **An empty response must keep the agent in the same reasoning branch as a full one.** If 0 rows
  means "wrong ID, try again", say that. If 0 rows is a legitimate upstream state (the caller knows
  the asset but nothing is monitored on it), say *that* — otherwise the agent retries forever and
  concludes the tool is broken.
- **Set the empty-result hint per tool.** A shared generic hint that names `companyId, ean, meterId`
  becomes actively misleading on a tool whose parameter is `assetId`.
- **Volume claims must include the zero case.** "30K–60K variables per building" is true for the
  happy path and sends agents hunting on the cases where the answer is legitimately 0.
- **Alerts carry domain warnings**, not chatter: a threshold breach, an unapproved record, a summary
  computed over a capped scan, a counter that was skipped rather than summed.

## 6. Registration

```ts
server.registerTool(
  'get_<entity>',
  {
    title: 'Orders',                                              // UI-facing
    description,                                                  // agent reasoning
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  createRestHandler(client, { toolName: 'get_<entity>', operationName: 'Get<Entity>', execute, transform, summarize, outputSchema, emptyResultHint })
);
```

(`createRestHandler` here is illustrative of a shared handler factory — see `references/handlers.md`
for the exact 6-step lifecycle contract; any codebase can implement the same steps by hand without a
shared factory, as [get-building-profile.ts](../../../../src/tools/get-building-profile.ts) does.)

All four annotations explicit — `destructiveHint` and `openWorldHint` default to `true`, so an
omission labels a read-only tool as destructive and open-world.

---

## Per-tool checklist

- [ ] Row interface with a doc comment per field, derived fields marked as computed
- [ ] Description: canonical core blocks (earned blocks only when justified), English structure,
      domain terms glossed; no `outputSchema` reference, no RETURNS↔INTERPRETATION duplication
- [ ] Deduplication pass run after the description was written/changed — each fact appears once (see §1)
- [ ] RETURNS carries counted volumes; any vendor total known to be unreliable is flagged
- [ ] WHEN NOT TO USE names the correct alternative tool, and the workaround for unsupported paths
- [ ] Input: `queryIntent`, `summaryOnly`, `.meta()` on every param with format + working examples
- [ ] Misbehaving/ignored parameters documented on the parameter itself
- [ ] Output: SHAPE-ONLY `.meta()` by default (type/optional + short identity, no pointer); the null-meaning, join key, value semantics and sentinel rule live in the DESCRIPTION, not only here
- [ ] `summary` covers the dimensions an agent would otherwise paginate for
- [ ] `interpretation.alerts` present in the output schema
- [ ] An empty-result hint distinguishes "wrong lookup" from "valid but empty"
- [ ] `transform` for derived fields / sentinel normalisation; `summarize` for aggregation + alerts
- [ ] All four `annotations` explicit
- [ ] Registered in `server.ts`; a permission/RBAC entry if your server has that layer and this tool is restricted
- [ ] Open questions carry `[CONFIDENCE: … TODO: DOMAIN EXPERT — …]` markers
- [ ] Unit test covers the shape contract and each discovered quirk

## Server instructions (`server.ts`)

Client-dependent — read by some clients (e.g. Claude Code, Claude Desktop), not guaranteed
elsewhere. Put cross-tool rules here and never rely on them alone:

```
FEEDBACK: … (only if you have a feedback mechanism; name it and how to call it)
DOMAIN CONTEXT: <what this source is, who/what it covers>
TOOL SELECTION / NAVIGATION: <entry-point tool → which IDs feed which tools>
KNOWN DATA: <counted volumes, key entities, naming conventions>
KNOWN DATA QUALITY ISSUES: <unreliable fields, broken cross-refs>
CROSS-REFERENCE: <how this links to your other MCP servers' data, if you have more than one>
UNITS: <distance, duration, currency conventions>
```

## Anti-patterns

| Anti-pattern | Why |
|---|---|
| A meta-tool (`get_query_guide`, `get_data_dictionary`) | Built and tested: agents rarely call them |
| MCP Resources for essential reference content | Client-dependent; do not make core guidance rely on them without testing |
| Code tables inline in a description | Tokens + drift. Join the description field instead |
| Output-field interpretation only in output `.meta()` | In the measured clients the model did not receive output annotations. Put essential interpretation in the description |
| Pointing to `outputSchema` from a description | Do not assume the model can open it. Inline the essential content |
| Verbose output `.meta()` prose | Usually dead weight when annotations are validation/UI only. Keep it shape-only by default |
| Same field explained in both RETURNS and INTERPRETATION | Duplication within the description that drifts apart |
| Repeating an INPUT param's `.meta()` in INTERPRETATION | When input annotations are model-visible, duplication drifts |
| `z.object({})` for a parameterless tool | SDK error — use `{}` or omit `inputSchema` |
| "Nullable" without the condition | The agent still can't tell when to expect a value |
| Volume claims that skip the 0 case | Agents retry forever on legitimately empty results |
| A generic shared empty-result hint | Names parameters that some tools don't have |
