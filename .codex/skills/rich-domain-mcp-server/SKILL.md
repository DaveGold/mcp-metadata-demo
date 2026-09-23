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
---

# rich-domain-mcp-server — build, audit and measure MCP tools

A good MCP codebase gives you transport, logging and auth. What you actually build is the layer a
model reasons over at call time: **field names, the description head, the input schema, and the
response**. Plumbing is a day; that layer is the product.

The method is **Introspective Context Engineering**: you do not write domain knowledge from
vendor docs — you *discover* it from live data, get it confirmed by someone who knows the business,
encode it **where the model receives it**, and **measure** whether it was used.

Every rule below carries a tag (`[Q7]`, `[BT]`, `[N2]`) that resolves in
[`references/evidence.md`](references/evidence.md) to the eval result behind it. Read that row
before weakening a rule. The eval set is this repo's `evals/`; the paper it accompanies is
["The Missing Layer"](https://davidgolverdingen.nl/en/the-missing-layer).

---

## Start here — two entry points

| you have | path |
|---|---|
| **Nothing yet** — a new server or tool | Scaffold → the EFVEI loop → Harden |
| **An existing server or tool** — even one with rich metadata | [`references/audit.md`](references/audit.md) first (inventory → names → delivery → wrongness → provenance → migrate), then the EFVEI loop |

Do not skip the audit because the metadata looks rich. In this repo the richest tool delivered
28% of its own description to the model, and one of its computed alerts asserted a verdict the
eval set had already shown to be wrong.

## What reaches the model (Claude Code; verify for other hosts)

| surface | delivered | budget |
|---|---|---|
| field names | **always**, every response | — |
| tool description | **first 2,048 chars only**, every request [Q7] | ≤ 2,048, ceiling ~1,800 |
| server instructions | first 2,048 chars [Q7] | ≤ 2,048 |
| input schema | yes [L3] [Q11] | — |
| output schema | **no** [Q11] | validation/UI only |
| response | yes, **< ~25k tokens**; larger is replaced by a file notice [Q9] | guard it |
| guidance tool | only if the pointer is a requirement [Q8b] | — |

The variable is **delivery, not channel**: the same sentence delivered in the description and in
the response scored 20/20 and 20/20 [Q15]. Details, and how to check it yourself:
[`references/delivery.md`](references/delivery.md).

## What to do, in order (when you do not know which model will call you)

MCP gives a server `clientInfo`, not the model. Build for all of them; this order is ranked by
leverage and by how model-independent each mechanism is:

0. **Name fields so they cannot be misread.** The only semantics guaranteed to arrive. A name
   says what + scope + provenance + unit. A name that implies another quantity overrides the prose
   beside it [N2]; an opaque code is confidently misread [N3]; a unitless name gets a unit
   invented [N5]. If the API is not yours, rename in `transform` with a mapping table.
1. **Ship the facts the payload lacks** — constants, conversions. No model reasons its way to a
   calorific value; opus scored 1–3/10 without it [L2].
2. **Make sure guidance is delivered** — in the response under `interpretation`, or in the first
   2,048 chars of the description [Q15]. Prefer the response for anything that interprets values.
3. **Ship the data a rule needs**, not only the rule: haiku 2/20 → 15/20, strong models −87% calls
   [Q16] [Q16b].
4. **Compute determinate verdicts server-side** — 78/78, identical on all models [L1] — and give
   each computed value its unit, basis and provenance.
5. **Write the fact with the instruction.** Instruction alone 10/30, fact alone 25/30, both 30/30
   [Q4].
6. **Type the input schema** for expressibility and validation [L3], and list valid names where
   the model must produce them [N7].
7. **Do not spend effort on volume.** Cutting half the prose changed 0 of 180 answers [Q2]; one
   relevant rule among 100 was found as easily as alone [Q17].

> **The rule that outranks all of them: volume does not hurt. Wrongness does.** One
> plausible-looking line (`ep1 … Paris Proof kantoor: 70 kWh/m²`) produced 59 of 60 wrong answers
> across three models; one sentence stating that the figures are CALCULATED, not MEASURED, took the
> same question 0/60 → 59/60 [BT]. Auditing what you already ship beats adding more.

Do not tailor per model: with the steps above in place every model converges, so tailoring buys
at most ~2% in tokens [M1]. Haiku-class models are where delivery, explicitness and shipped data
matter most [M2].

---

## The loop: EFVEI

```
SCAFFOLD   ship something simple (new) — or AUDIT what exists (existing)
   │
   ├─► EXAMINE    interrogate the live data AND what the model received, in a FRESH session
   │      │
   │   FLAG       tag every finding with a confidence level + a question, while you find it
   │      │
   │   VALIDATE   an expert confirms what is TRUE; an eval measures what is USED
   │      │
   │   ENCODE     names → description head → input schema → response rules/verdicts,
   │      │       each rule with a provenance line → redeploy
   │      │
   │   ITERATE    call logs, queryIntent, feedback expose the next gap
   │      │
   └──────┘
HARDEN     budget tests, name tests, rule tests, frozen variants, findings doc
```

Copy this checklist into your response and tick it off:

```
- [ ] S/A. Scaffold a thin tool — or run references/audit.md on the existing one
- [ ] E. Examine the data (probe matrix) and the model (what it received, which field it used, how many calls)
- [ ] F. Flag: every finding carries [CONFIDENCE: …  TODO: DOMAIN EXPERT — …]
- [ ] V. Validate: expert session for truth; eval (references/evaluation.md) for use
- [ ] E. Encode: names, description ≤2,048, input schema, `interpretation` rules + computed values, provenance per rule
- [ ] I. Iterate: fresh session, then telemetry
- [ ] H. Harden: tests (budget, names, rules, size, freeze), docs/<name>-findings.md, agent guide
```

### Scaffold (new) — ship something simple

Build the client (if the API needs one), one plain tool, and deploy. Keep the metadata thin on
purpose: `queryIntent`, `summaryOnly`, the params you are sure of, a permissive output schema, a
one-line description ending `[Stub — enriching after discovery.]`. Everything richer written now
is guesswork from vendor docs. Wiring: [`references/scaffolding.md`](references/scaffolding.md);
handler lifecycle: [`references/handlers.md`](references/handlers.md).

### Audit (existing) — find the defects before adding anything

[`references/audit.md`](references/audit.md): measure description offsets and response sizes;
audit every field name; move what is not delivered; check every alert and threshold for the
calculated-vs-measured defect; backfill provenance; rebuild as a new variant beside the old one
and measure the two.

### Examine — the data and the model

[`references/discovery.md`](references/discovery.md). Deploy first, then examine through MCP in a
**fresh session** (clients fix their tool catalog at session start, and an agent that watched you
write the description confirms your assumptions instead of testing them). Be an operator: one
directed probe at a time. Nine data dimensions — shape · **null patterns per slice** · enums ·
ordering · filter semantics and silently ignored params · pagination and lying totals · joins ·
temporal edges and sentinels · failure surface. Then the model side: what did it receive, which
field did it cite, what did it invent, how many calls did it need.

### Flag — while you find it

```
[CONFIDENCE: HIGH|MEDIUM|LOW — <observation>. TODO: DOMAIN EXPERT — <question>]
```

HIGH: confirmed across many records and slices. MEDIUM: observed, exceptions plausible. LOW:
inferred from little data. Without markers, ambiguity is silently resolved with the model's best
guess — which reads exactly like an observation.

### Validate — true, and used

- **Expert** ([`references/validation.md`](references/validation.md)): batch the markers, LOW
  first, closed questions backed by a data sample. Record the answer, dated, with who answered.
- **Eval** ([`references/evaluation.md`](references/evaluation.md)): a question that needs what the
  payload lacks; arms that differ by one variable; a prediction registered before the run; the
  variance bar; an audit against the server log. Most registered predictions in this repo were
  wrong [P].

### Encode — write it where it is delivered

[`references/metadata.md`](references/metadata.md). In order:

1. **Names** (§0) — rename what the audit flagged; mapping table with reason + provenance.
2. **Description head** (§1) — what it is and is NOT (refusals must be possible before a call),
   "read `interpretation` first", the few rules that hold for every record as fact + instruction,
   input conventions. ≤ 2,048, enforced by a test.
3. **Input schema** (§2) — types, regex, working examples, valid-name lists, misbehaving params.
4. **Output schema** (§3) — shape-only.
5. **Response** (§4) — `interpretation { alerts, notes, constants }` first; notes selected from a
   rule registry by `applies(record)`; computed `derived` values with unit/basis/provenance or
   `null` + reason; the data each rule needs; complete thresholded lists; a size guard.

Where each kind of knowledge is written down — for the model and for the next maintainer — is
mapped in [`references/recording.md`](references/recording.md). The short form: **model-facing
knowledge in names, description head, input schema and response; maintainer-facing knowledge
(provenance, evidence, open questions) in source, the findings doc and `evals/`.**

### Iterate — production finds the next gap

`queryIntent` read as a narrative across consecutive calls names the missing sentence. Call-shape
patterns (tightening filters, deep pagination, many calls to a second tool) name the missing
field, summary dimension or shipped data. User friction is the rare, high-signal input. Details in
[`references/validation.md`](references/validation.md).

### Harden — once the loop stabilises

- Tests: delivery budgets (description + instructions ≤ 2,048, offsets, worst-case response
  size), names (units, provenance, no upstream leak), each rule on a triggering fixture, each
  discovered quirk, and a hash freeze on any variant that has been measured.
- `docs/<name>-findings.md` — the dated discovery and audit log.
- A project agent guide (`CLAUDE.md` / `AGENTS.md`) and an MCP client config (`.mcp.json`).

---

## Hard rules

- **Never claim what you have not observed.** Give the count, or the confidence marker.
- **Nothing load-bearing past char 2,048** of a description or the instructions; a test enforces
  it [Q7].
- **No model-facing meaning only in the output schema** [Q11].
- **No field name that implies a quantity it is not; every numeric name carries its unit; calculated
  values say so in the name** when a measured counterpart exists [N2] [N5].
- **Every quantity that could be calculated or measured states which it is, and what it may be
  compared with** — in the name, the rule, and any alert [BT].
- **An instruction ships with the fact that triggers it** [Q4].
- **Computed values carry unit, basis and provenance, or are `null` with a reason** — never a
  fallback that mixes scopes, never 0 for "no data".
- **Ship the data a rule needs** [Q16]; ship constants in `interpretation.constants` [L2].
- **Never prune the note about a null decision field** [AS].
- **Thresholded results are returned complete** [Q11b].
- **Responses stay under the host limit**; guidance lives under the fixed key `interpretation` [Q9].
- **A pointer to guidance is a requirement** ("REQUIRED: …"), or the guidance is its own tool
  [Q8b].
- **Every rule, rename and alert has a provenance line in source** — date + the result, incident
  or expert answer behind it — and it is never serialized [Q18].
- **An empty result names its branch** ("not found — EP-Online not queried" ≠ "0 labels").
- **All four annotations explicit**; `destructiveHint` and `openWorldHint` default to `true`.
- **Title in the source language if the domain has one; description in English**, domain terms
  glossed on first use.
- **Measured variants are frozen** — hash their wire surface; build the next version beside them.
- **Never silently sum a counter**; fetch the metadata aggregation depends on.
- **Deploy before testing hosted tools, then prove the new code is running** (a call-log row
  stamped with the variant), not just that the tool is listed [D].

## Routing

| you are doing… | open |
|---|---|
| Auditing an existing server or tool | `references/audit.md` |
| Checking what reaches the model; budgets | `references/delivery.md` |
| Scaffold: wiring, deploy, CI, adding a variant | `references/scaffolding.md` |
| Examine + Flag: probing an API and the model | `references/discovery.md` |
| Encode: names, descriptions, schemas, response rules | `references/metadata.md` |
| Handler lifecycle, size guard, logging | `references/handlers.md` |
| Where to write each kind of knowledge down | `references/recording.md` |
| Expert session, telemetry, feedback | `references/validation.md` |
| Measuring a change with an eval | `references/evaluation.md` |
| Why a rule exists / whether it was refuted | `references/evidence.md` |

## Reference implementation in this repo

The **`best`** variant applies every rule above to two tools, and is measured against the older
variants in `evals/`:

| pattern | file |
|---|---|
| Field renames with reason + provenance | [best-field-names.ts](../../../src/domain/best-field-names.ts) |
| Rule registry, record-conditional selection, provenance | [best-rules.ts](../../../src/domain/best-rules.ts), [best-building-rules.ts](../../../src/domain/best-building-rules.ts), [best-weather-rules.ts](../../../src/domain/best-weather-rules.ts) |
| Description ≤ 2,048 + `interpretation`-first response + computed `derived` values | [get-building-profile-best.ts](../../../src/tools/get-building-profile-best.ts) |
| Shipping the data a rule needs (reference-period degree days), size guard, complete lists | [get-weather-context-best.ts](../../../src/tools/get-weather-context-best.ts), [reference-period.ts](../../../src/domain/reference-period.ts) |
| Budget, name and rule tests | [best-arm.test.ts](../../../src/tools/best-arm.test.ts) |
| Wire-surface freeze of measured variants | [arms-frozen.test.ts](../../../src/arms-frozen.test.ts) |
| Audit record written the way `recording.md` prescribes | [docs/building-profile-findings.md](../../../docs/building-profile-findings.md), [docs/weather-findings.md](../../../docs/weather-findings.md) |

Contrast cases, kept frozen because results were measured on them:
[get-building-profile.ts](../../../src/tools/get-building-profile.ts) (`rich`: a 7,360-char
description of which the first 2,048 arrive, and an EP-1 vs Paris Proof alert that the audit
flags as the calculated-vs-measured defect) and
[get-building-profile-minimal.ts](../../../src/tools/get-building-profile-minimal.ts) (no metadata
layer). [render-chart.ts](../../../src/tools/render-chart.ts) is the MCP App (render) example.

## Caveats

- **Host-specific numbers.** The 2,048-char cut, the ~25k-token response limit and the absent
  output schema were measured on Claude Code. Re-verify on another host with the techniques in
  `delivery.md` before relying on them — or design for the strictest, as this skill does.
- **One author, one domain family.** The same party wrote the metadata, questions, ground truth
  and scoring of every eval behind this skill. Treat `evidence.md` statuses accordingly.
- **Discovery findings expire.** Every claim in a description is a maintenance liability; date it
  in the findings doc and re-check it.

## Example requests

- "Add an MCP server for backend X" → Scaffold → EFVEI.
- "Review / improve the tools on this server" → `audit.md`, then EFVEI.
- "The agent ignores what the description says" → `delivery.md`: is it past char 2,048?
- "The agent misreads this field" → `audit.md` step 2 (names), then `metadata.md` §0.
- "The agent keeps picking the wrong tool" → description head: WHEN NOT TO USE + RELATED TOOLS in both tools.
- "Which fields are always empty / what does this field mean?" → `discovery.md`, then encode.
- "Where do I write this down?" → `recording.md`.
- "Did this change help?" → `evaluation.md`.
- "Can I delete this rule?" → its provenance line in source, and `evidence.md`.
