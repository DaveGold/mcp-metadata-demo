# Encode — writing discoveries back into the tool

> **Local overlay:** REQUIRED — if `<repo-root>/.skill-local/rich-domain-mcp-server/metadata.md` exists, read it
> before the rest of this file (SKILL.md → *Local overlays*).

The fourth step of the EFVEI loop: everything Examine found and Validate confirmed becomes tool
metadata here. **Where** each piece goes is decided by what reaches the model — read
[`delivery.md`](delivery.md) first. The short version for Claude Code:

| surface | delivered | use it for |
|---|---|---|
| field names | always | what each value is |
| description | first 2,048 chars | what the tool is/is not, input conventions, record-independent rules |
| input schema | yes | formats, examples, valid names, misbehaving params |
| output schema | **no** | validation and UI only |
| response | yes, < ~25k tokens | interpretation of THIS record, computed verdicts, constants, the data a rule needs |

Tags like `[Q7]` resolve in [`evidence.md`](evidence.md).

---

## 0. Field names — the metadata that is always delivered

A name is read in every response on every host, before any prose. Get it right before writing a
sentence about it.

**A good name says:** *what* (the quantity) + *scope* (per what, over what) + *provenance*
(register / calculated / measured / derived) where it is not obvious + *unit*.

```
oppervlakte_m2                        → oppervlakte_bag_verblijfsobject_m2      (scope)
berekend_energieverbruik_kwh_m2       → energieverbruik_berekend_niet_gemeten_kwh_m2  (reads as metered [N2])
temperatuuroverschrijding             → temperatuuroverschrijding_indicator_eenheidloos (unit invented [N5])
gasNormalizationFactor                → fullYearGasNormalizationFactor          (only valid for a full year [Q12])
```

Rules:

- **No name may imply a quantity it is not.** A readable wrong name overrides the prose beside
  it [N2]; an opaque code is confidently misread to its nearest plausible meaning, never treated
  as unknown [N3]; letters that look like the answer to a common question make a magnet [N4].
- **Every numeric field names its unit — or says it has none.** A unitless readable name gets a
  unit invented for it, and the invented unit usually makes the value look negligible [N5].
- **Calculated values say so in the name** when a measured value of the same kind exists in the
  domain (energy use, emissions, temperatures).
- **Keep established domain and register terms.** Users and experts search in them, and field
  names leak from the user's own words — sonnet produced the exact `select` names 8/10 by
  camel-casing the question [N7]. Rename for a *reason* the audit found, not for style [N8].
- **If the API is not yours, rename in `transform`** and keep a mapping table in source with a
  reason and provenance per rename (`{ upstream, name, reason, provenance }`). The mapping is
  where the next maintainer learns why the name differs from the vendor docs.
- **Which names need help? Six risk classes, then a probe.** Across the eval set every misread
  field fell in one of: (1) the name implies another quantity, (2) no or ambiguous unit, (3) scope
  ambiguity (per unit vs building vs zone), (4) calculated vs measured, (5) null on a decision
  field, (6) a derived value needing a constant the payload lacks. Fields outside all six (address,
  ids, dates) rarely need anything. Confirm with the field-reading probe
  (`discovery.md`) instead of an eval per field, and record the fields you deliberately leave
  unexplained with a reason (in this repo: `UNCOVERED_BY_DESIGN`).
- Keep names identical across the tools of one server (`latitude`/`longitude` in the input of
  one tool should match what another tool returns, or the RELATED TOOLS chain breaks).

## 1. Tool description — 2,048 characters, most important first

The description is truncated at 2,048 characters on Claude Code, and re-sent on every request
[Q7]. It is also paid for on every turn, relevant or not [Q5]. Treat it as a budget:

- **Hard limit 2,048; working ceiling ~1,800**, enforced by a test on `.length`, so an edit
  cannot silently push a rule past the cut.
- **Order by what must be known before the first call.** Anything that interprets returned
  values can wait for the response.
- **Pin load-bearing sentences to offsets** in the test (`indexOf('NO metered') < 400`).

A structure that fits the budget:

```
1. WHAT IT IS — one or two sentences, including what it is NOT
   ("Registered facts + calculated label figures. This server has NO metered consumption data.")
   The refusal must be possible before any call.
2. READ `interpretation` FIRST — one line telling the model the response carries the record's
   computed values and reading rules, and to quote computed values rather than recompute.
3. RULES THAT HOLD FOR EVERY RECORD — three or four, each a FACT plus an INSTRUCTION [Q4]:
   "EP-Online energy figures are CALCULATED (NTA 8800/NEN 7120), never MEASURED. Where a question
    asks for a comparison with a measured benchmark, say it cannot be made from this data, and why."
4. INPUT — the conventions a model gets wrong: formats, "28A = huisnummer 28 + huisletter 'A'",
   what to do on an ambiguous match.
5. NOT FOR — adjacent questions and the right tool.
```

### The eight blocks — three moments, three channels

Every tool uses the same eight blocks (the talk's fixed template), grouped by the moment the model
needs them. The evals made that grouping literal: each moment has its own channel.

| moment | block | channel | note |
|---|---|---|---|
| before the call | WHEN TO USE | description head | one line, in the user's words |
| | WHEN NOT TO USE | description head | often the most valuable line in the budget; includes what the server does NOT have, so a refusal needs no call [Q19] |
| | RELATED TOOLS | description head | one line: `get_x(join key) — what it adds` |
| calling it | QUERY STRATEGY | description head + input-schema `.describe()` | formats, valid names, "call it directly" when models hesitate [Q19c] |
| | RETURNS | description head, terse | **literal field identifiers**, never a paraphrased group label |
| after the answer | INTERPRETATION | **response** `interpretation.notes` | record-conditional rules; only rules that hold for EVERY record also go in the head |
| | ALERTS | **response** `interpretation.alerts` | computed verdicts and branches for this record |
| and one more | FEEDBACK | one line in the head or instructions | only if a feedback mechanism exists |

Why the third group moved: an INTERPRETATION block in the description arrived only up to char
2,048 [Q7], and a description is written before the data exists, so it cannot be conditional on the
record. In the response it is always delivered and can be.

**Naming the blocks costs little.** Eight headers are ~30–40 tokens per tool (~0.1% of a typical
run, not separately measured), and ~110 chars of the 2,048 budget. Use the canonical names when
there is room: a model and a maintainer both find the blocks by name. Merge or rename a header only
when the budget forces it, and say which block it stands for.

**Blocks are earned, not templated.** A sentence exists because a model fails without it. Volume
does not hurt accuracy [Q2] [Q17], but it costs tokens and budget; a wrong sentence can break
59 answers [BT]. Spend the effort on *which* sentence, not how many.

What each block prevents, so you can tell whether one has earned its place [U7]:

| block | without it |
|---|---|
| WHEN TO USE | the model picks the wrong tool, or misses this one |
| WHEN NOT TO USE | it calls this tool for questions that belong elsewhere, or calls where it should refuse |
| RELATED TOOLS | it stops after the first call instead of chaining |
| QUERY STRATEGY | it pulls full records where a summary would do, or walks pagination |
| RETURNS | it cannot tell whether the tool has the data, or how to address a field |
| INTERPRETATION | it returns raw numbers without conclusions, or misreads codes and derived fields |
| ALERTS | it misses the verdict or branch that holds for this record |

**Earned blocks seen in practice**, both in the description head because they matter before the
call [U1]:

- **DATA HORIZON & SCOPE** — why a query returns 0 rows: a retention window, a coverage limit
  (a bookings source that only holds the last 10 years). Not WHEN NOT TO USE (the tool is right,
  the data is absent) and not query strategy.
- **PRIVACY** — handling of sensitive or regulated data (health data, personnel or financial
  records): what to answer, what not to volunteer, when to aggregate. Compliance-critical, so it
  sits early in the head, not in a response note a refusal never sees.

**Two other grammars.** Write/action tools: WHEN TO USE / WHEN NOT TO USE / RETURNS (effects) /
AUTH. App/render tools: WHEN TO USE / RETURNS (what renders) / INPUT (data shape) — see
[render-chart.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/render-chart.ts).

**Deduplication pass — every time the description changes.** Each fact once; no fact that the
input schema already carries; no pointer to the output schema. **One deliberate exception:** a rule
may appear in the description head AND as a response rule when the head version is needed
*before* the call (to decide whether to call, or to refuse) and the response version is
record-specific. In Q19 `best` answered `metered-vs-model` 10/10 with a median of **0 calls**,
from the head's "this server has NO metered consumption" alone. A rule only in the response does
not exist for a question the model answers without calling [Q19].

## 2. Input schema

Delivered, and the only place some knowledge can live.

```ts
export const inputSchema = {
  postcode: z.string().regex(/^\d{4}[A-Z]{2}$/)
    .describe('Dutch postcode, 4 digits + 2 capitals, no space. Example: "3543AR".'),
  huisnummer: z.number().int().positive()
    .describe('House number, integer only. For "28A" pass 28 and huisletter "A".'),
  select: z.array(z.string()).optional()
    .describe('Exact, case-sensitive field names to keep: date, tempMean, tempMin, tempMax, …'),
  summaryOnly: z.boolean().optional().default(false).describe('Summary + interpretation only, no rows.'),
  queryIntent: z.string().optional().describe('The business question this call answers.'),
};
```

- **Typed for expressibility and validation.** A parameter that does not exist cannot be reasoned
  around by any model: `thin` 0/18 → `schema` 18/18 on the question that needed `huisletter` [L3].
  A regex stops silent wrong-entity lookups (`"3039 WB"` returned a different building).
- **List the valid names wherever the model must produce names** (`select`, `fields`, `sortBy`).
  Without the list haiku got 2/10 and told users the field does not exist [N7].
- **When the model must pick an enum value from the data** (a chart type, a strategy, a mode),
  key the guidance on what the data IS: the most specific structure first, the common default
  last ("flows → sankey; a cycle → polarArea; … otherwise a comparison → bar"). Put it in the
  parameter's describe, where it is delivered, above the per-value rules. Rules written per value
  only fire once the model already considers that value: without the path a weekly cycle got bar
  20/20, with it polarArea 16/20, and nothing else moved [Q24].
- **Every enum value must be reachable.** Send the payload the description prescribes for each
  value and check that the input schema accepts it. Three of 14 chart types were refused by the
  schema itself, on every tier, and the refusals never reached the server log [Q24].
- **`queryIntent` and `summaryOnly` on every query tool** — the observability join, and the
  alternative to paginating to hand-aggregate.
- **Working example values**, explicit formats, sane defaults.
- **Document misbehaving parameters on the parameter** ("DO NOT PASS in pre-release: zeroes the
  result set").
- An unknown name in `select` must return the valid list and say it is a *naming* error, not
  missing data.
- **Say what `select` costs.** A projection saves tokens across many rows and is overhead on a
  single-record lookup; say so in its `.describe()` so the model does not add it by reflex [U3].
- **One field list as the single source of truth** for filterable, selectable and returned
  names, checked against the row type at compile time, whether or not a factory generates the
  schema from it [U2]:

  ```ts
  const FIELDS = [
    { name: 'CustomerName', type: 'string', filterable: false },
    { name: 'OrderDate', type: 'date' },
  ] as const satisfies readonly (FieldMeta & { name: keyof OrderRow })[];
  ```

## 3. Output schema — shape-only

Not delivered to the model on Claude Code [Q11]. Keep it for `safeParse` validation and UI:
type + `.optional()`/`.nullable()` + a short identity. No value meanings, no null-conditions, no
pointer to the description. **Identify-before-removing:** before trimming an old annotation,
confirm every fact it carried now lives in the description head, a field name, or a response rule.

When you trim, keep the type and `.optional()`/`.nullable()` exactly, so validation does not
change: freeze a baseline of every output shape with the annotation text stripped, and fail the
build when a shape moves. Also fail on any description that mentions the output schema — a
pointer to a surface the model never receives [U4].

## 4. The response — interpretation, derived values, constants

The response is delivered (under ~25k tokens), host-independent, and it is the only surface that
can be **conditional on the record** [delivery.md]. Standard shape:

```ts
{
  interpretation: {
    alerts:    string[],                 // computed verdicts and branch statements, most decision-relevant first
    notes:     string[],                 // reading rules that apply to THIS record, one line each
    constants: Record<string, number>,   // every constant a rule refers to (conversion factors, thresholds)
  },
  derived: {                             // determinate computations, each self-describing
    spaceHeatingGas: { value: 253, unit: 'm3/year', basis: 'warmtebehoefte × thermal-zone area ÷ 0.95 ÷ 8.79', provenance: 'calculated' },
    totalCo2:        { value: null, reason: 'thermal-zone area not registered' },
  },
  ...data fields,
}
```

- **One fixed key** (`interpretation`) on every tool, so a model that only has a spilled file can
  still read it by key [Q9].
- **Rules live in a registry in source**, each `{ id, relates_to_fields, applies(record),
  render(record), provenance }`. `applies` makes the response conditional; `render` produces one
  line, fact + instruction [Q4]. One line is enough [Q14]; 100 rules are no worse than one [Q17];
  the form (prose vs field-addressed) does not matter [Q10] — so optimise for correctness and
  maintainability, not for size.
- **Only the rendered line reaches the model.** Everything else on a rule stays in source:

  | rule field | reaches the model? | used by |
  |---|---|---|
  | `render(record)` → one string in `interpretation.alerts` / `.notes` | **yes** | the model |
  | `kind` | no — only decides alerts vs notes, and the order | the selector |
  | `applies(record)` | no | the selector (record-conditional) |
  | `relates_to_fields` | **no** | tests: coverage (every output field explained or listed as uncovered), orphans after a rename or schema change |
  | `id`, `provenance` | no | the maintainer — why the rule exists [Q18] |

  Do not ship `relates_to_fields` or `provenance` in the response "to help the model": Q10 put
  field-addressing in the response and it moved nothing, and every response byte is paid for on
  every call [Q5].
- **Prune by relevance, but never drop notes about NULL decision fields.** Pruning notes for
  populated-but-irrelevant fields is free [Q2]; pruning the note about a null sizing input cost
  haiku 18/20 → 10/20 [AS]. Gate null-notes on the field BEING null.
- **Compute determinate verdicts** (a threshold crossed, a band, a conversion) and return them
  with `unit`, `basis` and `provenance` — the most model-uniform mechanism measured [L1], and the
  worst failure when wrong [BT]. Return `null` with a `reason` rather than a fallback that mixes
  scopes.
- **Ship the constants the payload lacks** (a calorific value, a boiler efficiency): no model
  reasons its way to them — opus scored 1–3/10 on the gas estimate without the constant [L2].
- **Ship the data a rule needs, not only the rule** [Q16]: a server-computed reference-period
  figure took haiku 2/20 → 15/20 and cut sonnet/opus calls by ~87% [Q16b]. Ship the data rather
  than a finished factor (11/20).
- **Return thresholded results complete** — no "(+6 more)" [Q11b]. In Q19 sonnet filled the
  truncated list with invented days 10 of 10 times; with the complete list, 9/10 correct.
- **Shipped data must be comparable across calls.** A reference computed relative to each query
  (the 10 years before *this* window) gives two periods two denominators: two-period
  normalisation went 0/10 where the old arm scored 10/10 [Q19b]. Use one fixed reference span,
  or say explicitly that two calls' references differ and what to use instead.
- **Shipped data has an upstream cost.** Fetch only the windows the computation needs, respect the
  provider's metering and concurrency, and cache what cannot change (past years) [Q19c].
- **Say what not to do with it** when the obvious next step is wrong ("this is the reference for
  THIS window; do not scale it to a year") [Q19d].
- **Every quantity that has a calculated and a measured sense states which one it is**, and what
  it may be compared against [BT].
- **Keep responses under the limit.** Serialize and guard; drop bulk rows with an alert naming
  `select`/`summaryOnly`.

**Two-layer enrichment** still applies to the data itself: (1) source-side label joins
(`CategoryName` next to `CategoryCode`) instead of code tables; (2) derived fields in `transform`
that collapse flag combinations into one readable label. Summary keys as `"code: description"`.
Mark each derived field in the row type as computed by the server, not returned by the source,
so the next maintainer does not go looking for it upstream [U5].

## 5. Alerts and empty results

- **`interpretation.alerts` on every response**, even when empty.
- **An empty result names its branch.** "BAG returned no address, EP-Online was NOT queried" is a
  different next step from "EP-Online was queried and has 0 labels" and from "the field is null
  because this calculation method does not produce it". Per tool, never a shared generic hint.
- **Volume claims include the zero case.**
- **Alerts are domain warnings, not chatter**, and they are the highest-trust thing you emit.
  Audit every one for the calculated-vs-measured defect ([`audit.md`](audit.md) step 4).

## 6. Registration

```ts
server.registerTool('get_<entity>', {
  title: 'Orders',
  description, inputSchema, outputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, handler);
```

All four annotations explicit — `destructiveHint` and `openWorldHint` default to `true` in the
spec. `openWorldHint: true` whenever the tool calls an external system.

## Server instructions

Cut at 2,048 like descriptions [Q7]; keep them well under (~900). Use them for what spans tools:
what the server is, what it does **not** have, "every data tool returns `interpretation` — read it
first", the join chain between tools (`coordinaten` → `latitude`/`longitude`). Do not make them the
only home of anything essential; some clients do not read them.

A skeleton that fits the budget, most load-bearing first — drop a line before you shorten the
first three [U8]:

```
<what this server is, in one line> — and what it does NOT have.
TOOL SELECTION: <entry tool> → <which ids feed which tools>.
Every data tool returns `interpretation` first; read it.
CROSS-REFERENCE: <join keys to your other servers' data, with verified coverage>.
KNOWN DATA QUALITY ISSUES: <the one or two that produce confident wrong answers>.
UNITS: <only where a name cannot carry the unit>.
FEEDBACK: <one line, if a feedback tool exists>.
```

A guidance/meta-tool is legitimate when a procedure cannot go in the response — but only behind a
pointer worded as a requirement ("REQUIRED: before any lookup, call … once"), or as its own
parameterless tool [Q8b]. `z.object({})` breaks parameterless tools — use `{}` or omit
`inputSchema`.

---

## Per-tool checklist

- [ ] Name audit done: every numeric name has unit + scope; no name implies another quantity; calculated values say so; renames in a mapping table with reason + provenance
- [ ] Description ≤ 2,048 (test), ceiling ~1,800, load-bearing sentences pinned to offsets
- [ ] Description head: what it is and is NOT, "read `interpretation` first", record-independent rules as fact + instruction, input conventions
- [ ] RETURNS names literal field identifiers
- [ ] Input: typed, regex/enum where it prevents wrong-entity calls, working examples, valid-name lists, `queryIntent`, `summaryOnly`
- [ ] Enums the model chooses from the data: a structure-first decision path on the parameter; every value's prescribed payload passes the input schema
- [ ] Output schema shape-only; no model-facing meaning only there; shape baseline frozen when annotations are trimmed
- [ ] Derived fields marked as computed in the row type
- [ ] Response: `interpretation { alerts, notes, constants }` first; rules from a registry with provenance; null-field notes never pruned
- [ ] Determinate verdicts computed with unit/basis/provenance, or null + reason; no scope-mixing fallback
- [ ] Constants and the data each rule needs are in the response
- [ ] Thresholded lists complete; response size guarded
- [ ] Empty results name their branch
- [ ] All four annotations explicit
- [ ] Open questions carry `[CONFIDENCE: … TODO: DOMAIN EXPERT — …]`
- [ ] Tests: budget, names, each rule, each quirk, response size

## Anti-patterns

| anti-pattern | why | evidence |
|---|---|---|
| Interpretation past char 2,048 | never delivered | Q7 |
| Meaning only in output `.describe()` | never delivered | Q11 |
| A readable name that implies another quantity | overrides the prose beside it | N2 |
| An opaque code without a delivered glossary | confidently misread | N3, N6 |
| A numeric name without a unit | a unit is invented | N5 |
| Comparing a calculated figure with a measured target (in prose OR an alert) | 59/60 wrong | BT |
| An instruction without the fact that triggers it | inert: 10/30 | Q4 |
| A rule that tells the model to go fetch data | helps only the middle model | Q12 |
| A soft pointer to a guidance tool | haiku never calls it | Q8b |
| Pruning the note about a null decision field | haiku 18/20 → 10/20 | AS |
| "(+N more)" in a thresholded alert | boundary cases misread | Q11b |
| Returning 0 for "no data" | reads as a measurement | audit.md |
| Response over ~25k tokens | replaced by a file notice | Q9 |
| Raising the client description cap as the fix | +23.7% tokens on every tool | Q15b |
| Code tables inline | tokens + drift; join the label field | — |
| Duplicating a fact across description, input schema and response | drifts apart | — |
