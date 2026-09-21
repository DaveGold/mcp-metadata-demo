# Open questions

Three experiments the 2026-09-21 runs make obvious but do not answer. Each carries a
**prediction registered before the run** and the result that would **falsify** it —
written down now precisely because this repo has already been burned once by a rule
chosen after seeing the answers (see `results/2026-09-21-shape-replication.json` and
the two live runs that failed to replicate it).

Q1's three arms (`inline`, `words-recipe`, `inline-recipe`) are **built and
deployed as of 2026-09-21**. Q2's is not. Either way a session that predates a
deploy cannot reach the arm: MCP connections are fixed when a session starts, and
the agent list is NOT proof of a connection — on 2026-09-21 the `eval-inline`
agent appeared mid-session while its MCP server stayed unconnected, which would
have produced a subagent with zero tools declining every question. Check you can
call `mcp__eval-<arm>__get_building_profile` before spending anything.

**Q3 needs no new arm and no deploy** — only instrumentation, which now exists:
every log row carries `variant`, `paramsPresent` and `rowCount`.

> **A SECOND, QUIETER FAILURE MODE, found on 2026-09-21.** "All eight arms were
> redeployed to stamp them" was true when written and stopped being true when three
> more arms were added. `mcpInline` was deployed at 15:42, variant stamping landed at
> 16:23, and `mcpInline` was never redeployed — so for the whole Q1 run it wrote
> `variant: "unknown"`, `paramsPresent: []` and `rowCount: 0` on every call, while the
> repo source looked correct and every unit test passed. A `variant:"inline"` filter
> returned zero rows against 63 real calls.
>
> Being able to CALL an arm does not mean it is running current code. Before any run
> that will be audited: call each arm once and confirm its row comes back stamped.
> `get_tool_call_log`'s `summary.countByVariant` now shows this in one unfiltered call.

---

## Q1 — Does guidance work better in the RESPONSE than in the tool description?

> **ANSWERED 2026-09-21. BOTH PREDICTIONS BELOW ARE FALSIFIED.** 210 live runs, three
> models, n=10 — [`results/2026-09-21-q1-response-channel.json`](results/2026-09-21-q1-response-channel.json).
>
> | | haiku | sonnet | opus |
> |---|---|---|---|
> | Q1a `words` (fact, in description) | 0 | 2 | 10 |
> | Q1a `inline` (fact, in response) | **5** | **10** | 10 |
> | Q1b `words-recipe` (procedure, in description) | 0 | 3 | 1 |
> | Q1b `inline-recipe` (procedure, in response) | **9** | **10** | **10** |
>
> Q1a falsified on two models (gap of 5 and 8, threshold was 3). Q1b falsified on all
> three (29 of 30, threshold was 5). Scoring the DERIVATION as well as the value makes
> it starker: `inline-recipe` is 29/30 route-correct and `words`, `inline` and
> `words-recipe` are **0/30 between them** — all 11 of their value-correct answers took
> the ep2 road or invented a constant.
>
> **The predictions below are left exactly as registered.** They were wrong, and that is
> the point of having written them down.

### Why it matters

The strongest negative result in the repo is that a derivation recipe sitting
verbatim in a tool description was applied by **0 of 13 runs across two models**,
while the same text pasted into a prompt produced the right answer 3 of 3. That
comparison is confounded: it crosses the payload-in-prompt and live-tool-call
protocols, which are not comparable.

Moving the same text into the tool **response** isolates the channel cleanly. Same
delivery mechanism, same live tool call, same words — only the position changes.

If guidance in the response works, `return the computed figure` weakens to
`ship guidance in the response`, which is far cheaper to build, and section 6 of the
talk write-up needs rewriting.

### The arm

`inline` — description **byte-identical to `schema`** (one sentence + the typed,
`.describe()`d input/output schemas). The response body carries an `interpretation`
field holding the prose. **No alerts.**

That gives four arms off one base, differing in one variable each:

| guidance absent | in the description | in the response | computed |
| --- | --- | --- | --- |
| `schema` | `words` | **`inline`** | `rich` |

`schema → words` and `schema → inline` are the same text against the same base.

### Two sub-questions

**Q1a — does a FACT travel better in the response?**
Run on `total-vs-per-m2`, where `words` bought +6 on Sonnet (2/10 → 8/10,
p=0.0115) because the description contains the sentence the question turns on.

> **Prediction:** `inline` ≈ `words`. A fact that is already being read and acted on
> in the description has little room to improve by moving.
> **Falsified if:** `inline` beats `words` by ≥3 on any model. That would mean the
> channel matters for content the description was already delivering successfully,
> which is a bigger claim than anything currently in the repo.

**Q1b — does a PROCEDURE work at all in the response?** *(the one that could
overturn the headline)*

> **Prediction:** `inline` stays near zero on `gas-estimate`, like the description
> did. The model declines to execute arithmetic on the author's behalf regardless of
> where the instruction sits — the failure is about procedures, not about channels.
> **Falsified if:** `inline` scores ≥5/10 on any model. That would relegate
> server-side computation from "the only thing that works" to "one of two things
> that work", and the cheaper one would be in the response.

**The recipe is written and both arms are deployed** (2026-09-21). It lives as
`derivedFiguresBlock` in `get-building-profile.ts` and is a deliberate
transliteration of the opaque axis's DERIVED FIGURES block — the text that scored
0 of 13 — with the terse codes swapped for readable field names and nothing else
changed. Reword it and the comparison with that result dies.

| arm | endpoint | carries the recipe |
| --- | --- | --- |
| `eval-words-recipe` | `mcpWordsRecipe` | in the DESCRIPTION |
| `eval-inline-recipe` | `mcpInlineRecipe` | in the RESPONSE |

Verified on the wire: the 438-byte block is **byte-identical across both
channels**, `inline-recipe`'s description is still `schema`'s one-liner, and the
block states no answer — no `253`, no `2630`. Guarded by
`get-building-profile-inline.test.ts`.

### Build notes

`ServerVariant` in `src/server.ts`, a `registerGetBuildingProfileInlineTool`
alongside the existing five, a `mcpInline` export in `src/functions.ts`, the
`deploy` and `logs` scripts in `package.json`, an `.mcp.json` entry and
`.claude/agents/eval-inline.md`. Add a test asserting the description is
byte-identical to `schema`'s and the payload matches `words`' apart from the added
field — the ladder's attributability depends on both.

---

## Q2 — Conditional interpretation: send only the guidance the data calls for

### Why it matters

A tool description is written before the data is known. **A response is the only
channel that can be conditional on it.** So this is not merely a cost optimisation —
it is something the description channel structurally cannot do, and it is an argument
for the response channel independent of whether Q1 finds any reading advantage.

The `INTERPRETATION` block is 4,338 of the 6,099 description characters, and most of
it is **mutually exclusive branches**: NTA 8800 / NEN 7120 + ISSO 75.3 / Nader
Voorschrift. Any given building matches exactly one. Roughly two thirds of that text
is always irrelevant to the record in hand.

### The arm

`inline-conditional` — as `inline`, but the `interpretation` field carries **only**
the branch matching the record's `berekeningstype`, plus field-level notes for fields
that are actually non-null in that response.

> **BUILT AND DEPLOYED 2026-09-21**, endpoint `mcpInlineConditional`, arm
> `eval-inline-conditional`. Verified on the wire and stamping its own log rows
> (`variant: "inline-conditional"`, `paramsPresent`, `rowCount` all populated).
>
> Measured pruning on the two eval addresses, against the 4,338-char full block:
>
> | record | interpretation shipped | cut |
> |---|---|---|
> | Van Beuningenstraat 1 (NTA 8800, woningbouw) | 2,730 chars | 37% |
> | Middenwetering 1 (NEN 7120, utiliteitsbouw) | ~1,000 chars | ~77% |
>
> The pruning is MECHANICAL and deliberately not hand-tuned — see the header of
> `src/tools/get-building-profile-inline-conditional.ts`. Every line it emits is
> sliced from `interpretationBlock`, never retyped, so it cannot drift from `words`
> and `inline`; `get-building-profile-inline-conditional.test.ts` asserts that.
>
> One thing already visible without running anything: on the `total-vs-per-m2`
> record the sentence that question turns on — `gebruiksoppervlakte_thermische_zone_m2`
> vs `oppervlakte_m2` — SURVIVES the pruning, because its field is populated. So the
> prediction's "wins on single-record questions" half is at least not blocked by the
> pruner deleting the load-bearing sentence. `benchmark-trap` is the one to watch.

### Prediction

> Tokens down substantially. **Accuracy flat or UP** — not merely "the same, but
> cheaper".
>
> The reasoning: on `gas-estimate` the full prose was net *negative* on Sonnet, and
> the mechanism was hedging about district heating and metered data — material that
> was not about the question. Pruning to the matched branch removes exactly that
> class of noise.

### The failure mode that makes it a real experiment

Conditional guidance means the model never learns what it is **not** being told.

> **Prediction:** `inline-conditional` wins on single-record questions and **loses on
> cross-record comparison.** `benchmark-trap` is precisely such a question — its
> whole point is recognising that a NEN 7120 figure is not comparable to a measured
> benchmark. Prune to the matched branch and you may delete the sentence that
> prevents the error.
>
> **Run `benchmark-trap` in this experiment even though its ceiling is currently
> unmeasured** — it is the question most likely to show the cost.

---

## Token baseline, measured 2026-09-21

Mean `subagent_tokens` per run, from the runs recorded in `results/`. These are
**self-reported by the harness**, cover the whole subagent session rather than the
description alone, and come from a single sitting — directionally useful, not precise.

| arm | Haiku | Sonnet | Opus |
| --- | --- | --- | --- |
| `thin` | ~28.7k | ~37.4k | ~36.3k |
| `schema` | ~29.1k | ~37.7k | ~36.4k |
| `words` | ~32.4k | ~42.3k | ~41.2k |
| `rich` | ~31.8k | ~41.7k | ~41.2k |

The metadata layer costs roughly **3–5k tokens a call**.

**Note the ordering: `rich` costs LESS than `words`**, on both models, despite
carrying strictly more content (identical description *plus* the alerts). Consistent
direction, ~600 tokens, on both. The alert short-circuits the reasoning, so the
model writes less. Richer metadata is not automatically more expensive.

### Cost per correct answer — the denominator that matters

`gas-estimate`, at tolerance 8. Mean tokens × 10 runs ÷ correct answers:

| arm | Haiku | Sonnet |
| --- | --- | --- |
| `thin` | 287k | 125k |
| `schema` | ∞ (0 correct) | 377k |
| `words` | 324k | 212k |
| `rich` | **32k** | **42k** |

**A three- to tenfold efficiency gap in `rich`'s favour.** The expensive thing is not
the metadata — it is the wrong answers you pay for and throw away.

### The honest counterexample

On `total-vs-per-m2` with Opus, every arm scores 10/10. Cost per correct answer is
then ~36k for `thin` against ~41k for `rich`: **on a question the model can already
do unaided, the metadata is pure overhead.** Any cost argument has to carry this case
too, or it is a sales pitch rather than a measurement.

---

## Q3 — Why does `rich` cost LESS than `words`?

### The observation to be explained

`rich` carries strictly more than `words` — identical description **plus** the alerts
— and costs fewer tokens per run on both models (~31.8k vs ~32.4k on Haiku, ~41.7k
vs ~42.3k on Sonnet). Consistent direction, ~600 tokens, both models.

If this holds up it is the most useful single line in the work, because it removes
the obvious objection to rich metadata: that you pay for it in context. So it should
be attacked before it is quoted.

### Two candidate mechanisms

**(a) Fewer round trips.** The model does not have to make extra calls to reconstruct
meaning.

**(b) Less to say.** The model that has the number writes the number; the model that
does not writes an essay about why it cannot be sure.

### Prediction

> **The saving is almost entirely (b), and (a) is a rounding error.**
>
> Evidence for (b): on `gas-estimate`/Sonnet, `rich` runs completed in ~7.3–7.9s
> against ~17–21s for `words` — a consistent 2–3× duration gap, and duration is
> mostly a proxy for output length. The answers match: `rich` states 253 and stops,
> the lower arms add three sentences of unrequested hedging about district heating
> and metered data.
>
> Evidence against (a): extra calls were observed, and concentrated exactly where
> predicted — `get_weather_context` invoked for degree-day normalisation nobody asked
> for, in `thin` and `schema`, almost entirely on Haiku, with `rich` essentially
> always a single call. But that is roughly **10 runs in 240**. A 4% incidence cannot
> produce a gap that appears on every run.
>
> **Falsified if:** call count differs between `rich` and `words` in more than ~15%
> of runs, or if output length is equal between them while total tokens still differ.

### Why this is not yet provable from what is on disk

The 2026-09-21 results files record answers and scores per run. They do **not**
record `tool_uses`, `duration_ms` or `subagent_tokens` per run — everything above is
read back off a session transcript, which is a real observation but not a
measurement. `subagent_tokens` also does not split input from output, which is
exactly the decomposition the question needs.

### What to instrument

Record per run, in the results file: `tool_uses`, `duration_ms`, `subagent_tokens`,
and the character count of the `ANSWER` line. Then:

- **Close the standing caveat.** Every results file says *"CALLS/TOOLS/PARAMS are
  self-reported and were not audited against `get_tool_call_log`."* Every arm exposes
  that tool. This experiment is the reason to finally run the audit and get a
  server-side call count that does not depend on the system under test describing
  its own behaviour.
- **Separate the arms' costs.** The description is a fixed input cost per call and is
  measurable directly by counting its tokens — no run needed. Anything left over is
  output, which is where the hypothesis says the saving lives.

### Why it matters beyond the talk

If (b) is right, the cost argument generalises: **any** metadata that removes
uncertainty pays for itself in shorter output, whether or not it is a computed
figure. If (a) is right, the saving only applies to tools an agent would otherwise
call repeatedly, and the claim has to be narrowed accordingly.

---

## Suggested order

~~1. **Q1b first.**~~ ~~2. **Q1a** next.~~ **Both run on 2026-09-21 and both
predictions falsified — see the banner under Q1.**

1. **Redeploy every arm and verify stamping.** Blocking, and cheap. `mcpInline` is
   currently serving pre-stamping code, so no run involving it can be audited. Run
   `npm run deploy`, then call each arm once and check `summary.countByVariant`
   accounts for all of them with no `unknown` bucket.
2. **Q2** is now worth running: it depended on Q1 finding the response channel usable
   at all, and Q1 found it is not merely usable but decisive. Note its registered
   prediction has a real failure mode attached — run `benchmark-trap` in it.
3. **Harder questions before bigger n.** Both `derived_number` questions are now at or
   near ceiling for the arms that matter (see `_measured_ceilings`). More repeats on
   them measure nothing; the set needs questions the top arms can still fail.

**Q3 is free to run alongside any of them** — it needs no new arm and no deploy, only
instrumentation of the harness and an audit against `get_tool_call_log`. Do it on the
next run of anything, whatever that run is for.
