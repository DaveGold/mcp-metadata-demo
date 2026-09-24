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

> **REQUIRED before anything else — local overlays.** Find `<repo-root>`: the root of the current
> git worktree (`git rev-parse --show-toplevel`; in Claude Code also `${CLAUDE_PROJECT_DIR}`),
> never a path relative to this skill's folder or the cwd. If
> `<repo-root>/.skill-local/rich-domain-mcp-server/README.md` exists, read it NOW, before any
> other file, and check its contract version (*Local overlays* below). Then, every time you open
> a reference file, read the overlay it names on its first lines before its content. No such
> file: this skill applies as written.

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
| input schema | yes, in full [IS] — re-sent every turn | size it: it is paid on every call |
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

## The loop: EFVEI — same shape as the talk

```
SCAFFOLD   ship something thin (new) — or AUDIT what exists (existing)
   │
   ├─► EXAMINE    interrogate your own deployed tool in a FRESH session: the data AND what the model received
   │      │
   │   FLAG       every finding carries a confidence level + a question, while you find it
   │      │
   │   VALIDATE   the agent settles what it can against the data — and a small eval MEASURES
   │      │       whether the model uses what you encoded (references/evaluation.md)
   │      │
   │   ENCODE     into the channel the model actually reads (names → description head →
   │      │       input schema → response), each rule with a provenance line → redeploy
   │      │
   │   ITERATE    back to Examine; in production, telemetry picks the next gap
   │      │
   └──────┘   3–4 passes is typical (experience, not measured)
VALIDATE   the expert — only what the agent could not settle — then one more pass
HARDEN     the eval set becomes a regression suite: budget, name and rule tests, frozen
           variants, ground-truth tests, a periodic re-run, a dated findings log
```

Measuring belongs **inside** the loop, not after it. Every large defect in this repo was found by
a run during iteration, not by a test or a review: the 2,048-character cut [Q7], the undelivered
output schema [Q11], a computed alert that asserted a wrong verdict [BT] [Q19], a stale deploy [D],
and an upstream quota the tool itself exhausted [Q19]. Waiting until "the loop stabilises" means
several passes of metadata written into a channel that does not arrive.

Copy this checklist into your response and tick it off:

```
- [ ] S/A. Scaffold a thin tool — or run references/audit.md on the existing one
- [ ] E. Examine the data (probe matrix) and the model (what it received, which field it used, how many calls)
- [ ] F. Flag: every finding carries [CONFIDENCE: …  TODO: DOMAIN EXPERT — …]
- [ ] V. Validate by the agent against the data; measure with a minimal eval (evaluation.md §0)
- [ ] E. Encode: names, description ≤2,048, input schema, `interpretation` rules + computed values, provenance per rule
- [ ] I. Iterate: fresh session, re-measure, then telemetry
- [ ] V. Expert session for what the agent could not settle (validation.md), then one more pass
- [ ] H. Harden: regression suite (evaluation.md §7), docs/<name>-findings.md, agent guide
```

### Scaffold (new) — ship something thin

Build the client (if the API needs one), one plain tool, and deploy. Keep the metadata thin on
purpose: `queryIntent`, `summaryOnly`, the params you are sure of, a permissive output schema, a
one-line description ending `[Stub — enriching after discovery.]`. Everything richer written now
is guesswork from vendor docs. Wiring: [`references/scaffolding.md`](references/scaffolding.md);
handler lifecycle: [`references/handlers.md`](references/handlers.md).

### Audit (existing) — find the defects before adding anything

[`references/audit.md`](references/audit.md): measure description offsets and response sizes;
audit every field name; move what is not delivered; check every alert and threshold for the
calculated-vs-measured defect; backfill provenance; rebuild as a new variant beside the old one
and measure the two. In this repo that audit predicted where the old reference would lose, and it
lost there: `rich` 0/20 against `best` 20/20 on `benchmark-trap` [Q19].

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

### Validate in the loop — the agent against the data, and a measurement

- **The agent settles what it can**: another probe instead of a question for the expert
  (`discovery.md`).
- **Measure whether the model USES it** ([`references/evaluation.md`](references/evaluation.md)):
  §0 is a minimal version for any server (5–10 questions, the old and the new variant, n=10, one
  batch); the rest is the full method — questions that need what the payload lacks, one variable
  per variant, a prediction registered before the run, the variance bar, an audit against the
  server log. Most registered predictions in this repo were wrong [P].

### Encode — write it where it is delivered

[`references/metadata.md`](references/metadata.md). In order:

1. **Names** (§0) — rename what the audit flagged; mapping table with reason + provenance.
2. **Description head** (§1, the eight blocks: the before-the-call and calling-it groups here, the
   after-the-answer group in the response) — what it is and is NOT (refusals must be possible before a call),
   "read `interpretation` first", the few rules that hold for every record as fact + instruction,
   input conventions. ≤ 2,048, enforced by a test.
3. **Input schema** (§2) — types, regex, working examples, valid-name lists, misbehaving params.
4. **Output schema** (§3) — shape-only.
5. **Response** (§4) — `interpretation { alerts, notes, constants }` first; notes selected from a
   rule registry by `applies(record)`; computed `derived` values with unit/basis/provenance or
   `null` + reason; the data each rule needs — comparable across calls, cached if it is costly
   upstream; complete thresholded lists; a size guard.

Where each kind of knowledge is written down — for the model and for the next maintainer — is
mapped in [`references/recording.md`](references/recording.md). The short form: **model-facing
knowledge in names, description head, input schema and response; maintainer-facing knowledge
(provenance, evidence, open questions) in source, the findings doc and `evals/`.**

### Iterate — production finds the next gap

`queryIntent` read as a narrative across consecutive calls names the missing sentence. Call-shape
patterns (tightening filters, deep pagination, many calls to a second tool) name the missing
field, summary dimension or shipped data. User friction is the rare, high-signal input. Details in
[`references/validation.md`](references/validation.md).

### Validate after the loop — the expert

Only what the agent could not settle from the data, batched into one session, LOW markers first,
closed questions backed by a sample ([`references/validation.md`](references/validation.md)). Then
one more pass of the loop with the answers encoded.

### Harden — the measurement becomes a regression suite

What the talk calls "tests, a findings log": concretely, the parts of the eval that keep guarding
after the loop has stabilised ([`references/evaluation.md`](references/evaluation.md) §7):

- **Budget tests:** description and instructions ≤ 2,048 (ceiling ~1,800), load-bearing sentences
  before fixed offsets, worst-case response under the size guard.
- **Name and rule tests:** units in names, a provenance line on every rename and rule, each rule
  on a fixture record that triggers it.
- **Ground-truth tests:** every eval question's expected value re-derived from frozen fixtures.
- **Frozen variants:** a hash of `tools/list` + instructions for every variant that has been measured.
- **Deploy check:** one live call per variant, and the call log shows it stamped with its own name.
- **Periodic re-run** of the eval set — registers, upstream APIs, hosts and models all drift.
- `docs/<name>-findings.md` — the dated discovery, audit and eval log; a project agent guide
  (`CLAUDE.md` / `AGENTS.md`) and an MCP client config.

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
- **Shipped data must be comparable across calls.** A reference that moves with the query (the
  previous 10 years of *each* window) gives two periods different denominators: 0/10 against
  10/10 on a two-period comparison; with one fixed span, 8/10 [Q19b]. Fix the reference period,
  or say that two calls' references are not comparable.
- **Shipped data has an upstream cost.** Know how the source meters requests (Open-Meteo weighs by
  data volume and caps concurrency); fetch only what the computation needs, and cache data that
  cannot change. One un-cached 10-year fetch per call exhausted the quota and failed every call
  [Q19c].
- **Say what NOT to do with shipped data when the question invites misuse.** With the right
  quarter figure in hand, 10 of 16 correct haiku answers still extrapolated it to a year; with an
  explicit "do not scale it to a year", 5 of 18 [Q19d]. It reduces the misuse; it does not end it.
- **Never prune the note about a null decision field** [AS].
- **A fix that must happen is a refusal, not an alert.** After a successful call the model reads an
  alert as a note: 0/10 re-rendered a table whose headers the alert said were wrong [Q22b]. The
  same check as a refusal with the fix in the message: 10/10, every refused run retried [Q22c].
  Keep alerts for what the user should know.
- **Walk every branch with data built for it.** For each value of an enum like a chart `type`,
  send the payload the description prescribes and check it passes the INPUT SCHEMA. Three of 14
  chart types were unreachable on every tier because the schema refused the right call; the model
  fell back to bar or line, and the refusals never reached the server log, since schema validation
  runs before the handler [Q24].
- **Size render guidance to the mistakes the data invites.** A chart tool offering 14 types got bar
  and line (and text, most often); its 2,769 characters of per-type rules changed one thing, a
  12-slice pie, 3/10 → 0/10 [Q23]. Keep the rules for the tempting wrong choices on your data, cut
  the menu to what your data can use.
- **Size the input schema to what forming the call needs.** It is re-sent every turn for every
  tool, so every question pays for it: the same structure in fewer words saved 21–23% of each run
  and lost nothing; the shapes only some calls need can move behind a REQUIRED guidance call
  (−26–29%, followed 58/62) [Q25]. The handler still validates the full shape and refuses with it.
- **Audit the app tools too.** Their input schema is delivered, so an example there is advice: a
  "Paris Proof target" annotation example on a server of calculated figures got the line drawn
  20/20, and the fixed tool left it out 16/20 [Q22].
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

## Local overlays

A codebase plugs its own knowledge into this skill without editing it: platform and deploy
wiring, auth, known vendor quirks, conventions, telemetry, reference implementations, local
evidence. The skill folder is copied unchanged; the overlays live outside it, so replacing the
folder on a sync never touches them.

**Where.** `<repo-root>/.skill-local/rich-domain-mcp-server/`, where `<repo-root>` is the root of
the current git worktree (`git rev-parse --show-toplevel`; in Claude Code also
`${CLAUDE_PROJECT_DIR}`) — never relative to this skill's folder, the cwd or a user-level
install. Read overlays by exact path; a glob may skip a dot-folder.

**What.** One overlay per document, same file name; `README.md` overlays this file and is read
first. Each reference file names its overlay in its first lines — read it when you open that
file, not all of them up front. The machine-readable contract is `overlays.json` next to this
file; a starter set is in `local-template/`.

| document | overlay | typically holds |
|---|---|---|
| `SKILL.md` | `README.md` | who, contract version, filled overlays, boundaries with other skills, reference implementations, example requests |
| `references/audit.md` | `audit.md` | known state of the existing servers, known deviations and their tickets |
| `references/delivery.md` | `delivery.md` | measured surfaces for the hosts this codebase targets |
| `references/scaffolding.md` | `scaffolding.md` | shared app factory, auth patterns, secrets, deploy, CI, UI wiring, adding a variant |
| `references/handlers.md` | `handlers.md` | shared handler factory, permissions, log store and fields, feedback wording |
| `references/discovery.md` | `discovery.md` | known vendor quirks, sentinels, operator semantics, cross-server joins, probe scripts |
| `references/metadata.md` | `metadata.md` | title and description language, schema idiom, server-instructions skeleton |
| `references/recording.md` | `recording.md` | where findings docs, tickets and provenance live |
| `references/validation.md` | `validation.md` | telemetry store, triage commands, feedback tool, domain experts |
| `references/evaluation.md` | `evaluation.md` | how this codebase runs an eval and adds a variant |
| `references/evidence.md` | `evidence.md` | local evidence rows, tagged `[X-…]` |

**Precedence.** An overlay fills in what this skill leaves open and may tighten any rule. It may
relax or replace a rule that carries an evidence tag only through a row in its own `evidence.md`
that points at a reproducible artifact (result file or protocol, date, scope, result, status).
Experience without a measurement never relaxes a rule. Where an overlay contradicts this skill
and no such row exists, this skill holds — and say so to the user, because the overlay is stale.

**Contract.** The local `README.md` starts with front matter `contract: <major>` and `overlays:`
(the files it fills). If the major differs from `overlays.json`, tell the user and do not read
the overlays until they are migrated. A major bump renames or removes an overlay, or changes when
it is read or what wins; a minor bump adds one.

**Trigger.** The frontmatter above triggers on request phrasing. If this skill must run before a
code change, also put a state-based trigger in the always-loaded project guide (`CLAUDE.md`,
`AGENTS.md`), outside any block a tool regenerates: "invoke `rich-domain-mcp-server` before
creating or editing anything under `<servers dir>`" [U6].

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
| Plugging this codebase's own knowledge in | *Local overlays* above, `local-template/` |

## Reference implementation in this repo

The **`best`** variant applies every rule above to two tools, and is measured against the older
variants in `evals/`. This table is the public reference; a local `README.md` overlay may list
the codebase's own implementations, and those come first where the pattern matches.

| pattern | file |
|---|---|
| Field renames with reason + provenance | [best-field-names.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-field-names.ts) |
| Rule registry, record-conditional selection, provenance | [best-rules.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-rules.ts), [best-building-rules.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-building-rules.ts), [best-weather-rules.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-weather-rules.ts) |
| Description ≤ 2,048 + `interpretation`-first response + computed `derived` values | [get-building-profile-best.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-building-profile-best.ts) |
| Shipping the data a rule needs (reference-period degree days), size guard, complete lists | [get-weather-context-best.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-weather-context-best.ts), [reference-period.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/reference-period.ts) |
| Defects an eval found in the reference itself, and their fixes (query-relative reference 0/10 → fixed span 8/10; annualising 10/16 → 5/18) | [docs/weather-findings.md](https://github.com/DaveGold/mcp-metadata-demo/blob/main/docs/weather-findings.md) §7 |
| Budget, name and rule tests | [best-arm.test.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/best-arm.test.ts) |
| Wire-surface freeze of measured variants | [arms-frozen.test.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/arms-frozen.test.ts) |
| Audit record written the way `recording.md` prescribes | [docs/building-profile-findings.md](https://github.com/DaveGold/mcp-metadata-demo/blob/main/docs/building-profile-findings.md), [docs/weather-findings.md](https://github.com/DaveGold/mcp-metadata-demo/blob/main/docs/weather-findings.md) |

Contrast cases, kept frozen because results were measured on them:
`rich` ([wire view](https://github.com/DaveGold/mcp-metadata-demo/blob/main/docs/wire/rich.md): an ~8,000-char
description of which the first 2,048 arrive; its EP-1 vs Paris Proof alert, the calculated-vs-measured
defect the audit flagged, was removed on 2026-09-24) and
[get-building-profile-minimal.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-building-profile-minimal.ts) (no metadata
layer). [render-chart.ts](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/render-chart.ts) is the MCP App (render) example.

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
