# Open questions

Twelve experiments. Each carries a **prediction registered before the run** and the
result that would **falsify** it — written down in advance precisely because this repo
has already been burned once by a rule chosen after seeing the answers (see
`results/2026-09-21-shape-replication.json` and the two live runs that failed to
replicate it).

**Q1–Q6 are ANSWERED** (banners in their sections; predictions left as registered — five
of the six were wrong, which is the point of registering them). **Q7–Q12 are open**, and
were added on 2026-09-22 from the frame in [`research-frame.md`](research-frame.md) —
read that file for *why these questions*: the six axes (channel, timing, distance,
conditionality, addressability, activation), which of them the answered questions cover,
and which design principles are still unfalsified.

**Q13 is ANSWERED** — registered and run on 2026-09-22, after Q7–Q12 were filed.
It asks whether the ALERTLESS tiers can be fixed at all, and all three of its
predictions were falsified. **Read it together with Q7**: Q13 measured the same
sentence at 0-of-20 use in the description against 20-of-20 in the response, and
Q7 is what decides whether that is *absence* or *presence-and-non-application*.

Read *What the runs support so far* next — it is the synthesis, and it is a narrower
claim than "richer metadata is better" — then *Design guidance*, which turns it into what
to build.

**Q7 is foundational and is not optional.** It asks whether the tool description was even
absent at interpretation time. If it was present, the word "weakened" is wrong everywhere
it appears below, and Q1's result is a stronger claim than the one currently written.

Every arm Q1–Q6 needed is **built and deployed** — `inline`, `words-recipe`,
`inline-recipe`, `inline-conditional`, `inline-fact` and `inline-instruction`. **Q8–Q11
each need a new arm** (`guidance-recipe`, `inline-head`, `inline-addressed`,
`schema-semantic`); Q7 and Q12 need none. A session that predates a deploy cannot reach a
NEW arm: MCP connections are fixed when a session starts, and
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

## What the runs support so far — read this first

Added 2026-09-21, after Q1, Q2 and the Q2 follow-up re-run. This is the claim the repo
can actually defend. It is narrower, and more useful, than "richer metadata is better".

### Volume is not the variable. Placement and precision are.

| change | size of the change | effect |
| --- | --- | --- |
| Prune 37–50% of the INTERPRETATION to the record (Q2) | −1,600 to −2,200 chars | **no change.** 39/90 vs 39/90 |
| Move the same 438 bytes DESCRIPTION → RESPONSE (Q1b) | 0 chars | **4/30 → 29/30** |
| Add ONE sentence that was missing (Q2 follow-up) | +682 chars | **0/60 → 59/60** |

Cutting half the prose changed no answer. Adding one *right* sentence changed 59. The
amount of metadata is close to irrelevant; *which* sentence, and *which channel*, is
nearly everything.

This also retires the cost framing. The INTERPRETATION block is ~1,100 tokens of a
~38,000-token subagent run — about 2%. No pruning of it can be "substantial", and the
measured saving (−1.84% over 180 runs) is exactly the text removed, no more.
**Conditional interpretation is FREE, not cheap.** Its justification stays the
structural one: a description is written before the data, a response can be conditional
on it. Q2 shows that mechanism costs nothing to adopt — not that it saves much.

### Metadata is high-leverage in BOTH directions

- One sentence **added**: +59 correct answers out of 60.
- One sentence **missing**, plus one plausible-looking line **present**
  (`ep1 … Paris Proof 2040 targets — kantoor: 70 kWh/m²`): **59 of 60 WRONG**, across
  two arms and three models, with 22 fabrications and one confidently-wrong.

That second number is the strongest single result in `results/`, and it is a **warning,
not a sales pitch**. The line was well-intentioned and accurate-looking, and it produced
near-total failure — and the same defect is live in the production Duurzaam server,
where it is worse because the verdict is *server-computed as an alert* (MCPSER-81).
A surface that can fix 59 answers can break 59.

Keep the documented counterexample too: on `total-vs-per-m2` with opus **every arm
scores 10/10**, so there the metadata is cost with no benefit.

### Per-model, what the numbers say

| | haiku | sonnet | opus |
| --- | --- | --- | --- |
| Fact needed and **present** in payload (co2 total) | words 0/10 → inline 9/10 | words 2/10 → inline 10/10 | **10/10 on every arm** |
| Derivation needs a constant **absent** from payload (gas) | 1–2/10 | 6–8/10 value, wrong road | 1–3/10 |
| Spontaneously named the calc-vs-measured trap (before the fix) | **0 of 20** | 1–3/10 | **7/10** |
| After one explicit sentence | 10/10 | 9–10/10 | 10/10 |
| Broke the agent's output contract | every case | 0 | 0 |

Three rules follow:

1. **Capability substitutes for metadata only when the needed quantity is already in the
   payload.** Opus is 40/40 unaided on the CO₂ total — metadata there is pure overhead.
   On `gas-estimate` it is 1–3/10, no better than haiku, because no amount of reasoning
   invents a calorific value. *Ship the fact the payload lacks; for facts it already
   carries, a strong model needs nothing.*
2. **The weaker the model, the more the response channel and explicitness earn.** Haiku
   went 0/10 → 9/10 on the same bytes moved into the response, and never once reached
   the calculated-vs-measured trap unaided. Quote the DIRECTION of these channel gaps,
   not their size: `words`/sonnet on `total-vs-per-m2` measured 8/10 in one sitting and
   2/10 in another on the same day, so any single-cell magnitude is a property of its
   sitting. See the variance warning in `results/README.md`.
3. **Noticing is not acting.** Opus named the mismatch 7 times in 10 and *still returned
   the forbidden verdict 10 times out of 10.* It had the fact and lacked the
   instruction. Writing what a field *means* is not enough for a strong model — Q4.

### The claim the repo can defend

> Tool metadata determines behaviour more than model capability does, for anything the
> payload does not already state. The leverage is in **precision and placement, not
> volume** — and the same surface that fixes 59 answers can break 59.

### What this does NOT establish

- **Self-authorship.** The same party wrote the metadata, the questions, the ground
  truth and the scoring. That is the standing caveat on everything in `results/`.
- **Teaching to the test.** The Q2-follow-up sentence and that question's `ground_truth`
  state the same distinction in nearly the same words. The run shows the arms can USE a
  correct sentence, not that they would infer it.
- n=10, one sitting per run; Q2 covered 2 of the 6 question shapes.
- Three of five Q2 scoring rules were fixed mid-run (the follow-up's were pre-registered).
- The block change moved SIX prose arms, so the readable-ladder files are no longer
  comparable on any `ep1`/`ep2`/`berekend` question.

---

## Design guidance — what to actually do

> **PROVISIONAL, 2026-09-22.** This is the "so what" of the synthesis above: the
> section before it says what the runs support, this one says what to build. It rests
> on three questions and two of six shapes, every per-cell number carries the ~4-run
> noise bar in `results/README.md`, and item 4 below is a Q4 hypothesis whose arms are
> built but unrun. Revise it when Q4 lands.

### When you do not know which model will call your tool

Which is the normal case, and the one MCP puts you in — the protocol hands a server
`clientInfo` (name and version), **not the model**. There is no field for it.

The answer is not "write for the weakest model". It is this ordering, because the
mechanisms differ in how model-dependent they are:

**1. Ship the facts the payload cannot contain.** The most model-agnostic need there
is. Opus scores 0–1/10 on `gas-estimate`, *no better than haiku*, because no amount of
reasoning invents a calorific value. Capability substitutes for metadata only where the
quantity is already present. If the tool returns kWh and a caller will want m³, ship
the conversion.

**2. Put guidance in the RESPONSE, not the description.** 29/30 against 4/30 for the
same 438 bytes. Free, and it helped all three models. If you change one thing, change
this one.

**3. Compute it server-side where the computation is determinate.** 78 of 78 across
three questions, and the only mechanism that performs IDENTICALLY on all three models —
which is exactly the property you want when you cannot know the model. But see the
warning below: a wrong computed value is the worst failure mode in this repo.

**4. Write the BEHAVIOUR, not only the semantics.** Opus named the calculated-vs-measured
trap 7 times in 10 and returned the forbidden verdict 10 times in 10. It had the fact
and lacked "say X rather than producing a ratio". *(Q4 hypothesis — arms built, unrun.)*

**5. Typed schemas, but only for expressibility.** `thin` 0/18 → `schema` 18/18 on the
one question where the correct call cannot be EXPRESSED without the parameter, and ≈0
everywhere else. Cheap, so do it — but do not expect a schema to carry meaning.

**6. Do not spend effort on volume.** Cutting 37–50% of the prose changed zero answers
in 180.

### The rule that outranks all six

> **Volume does not hurt. Wrongness does.**

The largest single effect measured anywhere in `results/` is a DEFECT: one
plausible-looking line (`ep1 … Paris Proof kantoor: 70 kWh/m²`) produced 59 of 60 wrong
answers, across two arms and three models, with 22 fabrications. Auditing the guidance
you already ship beats adding more of it. The same defect is live in the production
Duurzaam server, where it is worse because the verdict is server-COMPUTED as an alert
(MCPSER-81) — and per item 3, computed values are the most readily believed thing a tool
can emit. That cuts both ways, and this is the cutting edge.

### If you COULD target the model — you cannot, and it would buy little

The counterfactual, because it is the obvious next thought and the evidence answers it.

| | haiku | sonnet | opus |
| --- | --- | --- | --- |
| bottom rung (`thin`) | 0–1/10 | 0–3/10 | 0–10/10 |
| top rung (`rich`) | **10/10** | **10/10** | **10/10** |

The models differ enormously at the bottom and **converge completely at the top**. So
once the best mechanism ships, per-model tailoring buys no accuracy — there is none left
to buy. It buys only tokens, and Q2 measured what prose-trimming is worth: about 2%.

**Per-model tailoring is therefore a cost optimisation with a ~2% ceiling, not a quality
one. Do not build it.**

Three things tailoring WOULD legitimately change, if the signal existed:

- **Opus — skip the prose, keep the procedures.** 10/10 unaided on facts already in the
  payload, and prose does not help it where it fails: on `gas-estimate` it is 0–1/10 on
  `thin` AND on `words`, and only the recipe and the computed value move it. The
  glossary is dead weight for opus; the constants and the directives are not.
- **Sonnet — pin the derivation, not the answer.** It reaches the right number by the
  wrong road more than the others: 5–8/10 by value against 0/10 by derivation on
  `gas-estimate`. Tailoring for sonnet means specifying HOW, because it will otherwise
  find a road that lands inside the band.
- **Haiku — reinforce the output contract.** All 29 format violations across 240 runs
  were haiku; sonnet and opus were 0 of 120. That is the one genuine per-model defect
  that more DOMAIN metadata does not fix.

### The load-bearing assumption

"Tailoring buys nothing" holds only because a top rung exists that saturates every
model. If a domain has no determinate computation to precompute, the models do NOT
converge and this section's conclusion changes. Check that before reusing it.

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

> **ANSWERED 2026-09-21** — `results/2026-09-21-q2-conditional-interpretation.json`,
> 180 live runs, three models. The predictions below are left exactly as registered.
>
> **Cost half: FAILED as stated.** Tokens fell in all nine question x model cells, but
> by 1.4–2.4% (mean −707, −1.84%). Cutting 37–50% of the prose saves almost exactly
> the tokens it removes — the block is only ~2% of a subagent run's bill, so no
> pruning of it can be "substantial".
>
> **Accuracy half: HELD only in the weak form it was written to exclude.** Dead flat,
> 39 of 90 correct for each arm. The result is "the same, but slightly cheaper".
>
> **"Wins single-record, loses cross-record": NEITHER half confirmed, and the second
> could not be tested.** `benchmark-trap` scored **0 of 10 in all six cells**. The
> sentence this section feared the pruner would delete — that ep2 is calculated
> primary energy while Paris Proof is measured final energy — **is not in the 4,338-char
> block at all** (no "metered", no "final energy", no "primary fossil" anywhere in it).
> Meanwhile the line that *causes* the error, `ep1 ... Paris Proof 2040 targets —
> kantoor: 70 kWh/m²`, survives pruning because ep1 is populated, and all 60 runs of
> both arms ranked ep1 81.68 against 70. The prediction below was right that
> `benchmark-trap` was the one to watch, and wrong about why.
>
> The note below — that the `gebruiksoppervlakte` sentence survives on the
> `total-vs-per-m2` record — was confirmed: that question scored 29/30 vs 28/30.
>
> **Still open:** the cross-record half, and the ~77% pruning case. All three
> questions run used NTA 8800 records, so only the 37–50% band was exercised.
>
> **FOLLOW-UP, 2026-09-21: the missing sentence has been ADDED and the question
> RE-RUN.** `interpretationBlock` now carries a `CALCULATED vs MEASURED` line stating
> that ep1/ep2/berekend are calculated NTA 8800 figures, that Paris Proof is defined
> on measured final energy, and that this server holds no metered data. The
> `ep1 … 70 kWh/m²` line was left in place — this change adds, it does not remove, per
> the "do not do both in one change" note above. Pinned by
> `get-building-profile-calculated-vs-measured.test.ts`.
>
> Measured locally: the block grows 4,338 → 5,020 chars. The pruner gates the new line
> on its own three fields, like every other field note, which means:
> - on the `benchmark-trap` record (NTA 8800, all three populated) the line SURVIVES
>   pruning, so **both arms ship it** and the re-run measures whether the sentence
>   fixes the question, NOT whether pruning deletes it;
> - on a NEN 7120 record (all three null) the line IS pruned — which for the first time
>   creates a genuine test of Q2's cross-record half, on `metered-vs-model`, not here.
>
> **DONE AND RE-RUN, 2026-09-21** — deployed (the IAM error was the wrong firebase
> account, not a missing role: `mcp-metadata-demo` is invisible to the warmtebouw
> account) and verified on the wire in both arms before spawning. 60 runs:
> **benchmark-trap went from 0 of 60 to 59 of 60.** Fabrications 22 → 0,
> confidently-wrong 1 → 0, `named_mismatch` 13/60 → 60/60. Cost ~260 tokens a call.
> See `results/2026-09-21-benchmark-trap-calculated-vs-measured.json`.
>
> So the registered expectation below HELD, decisively. The question was never
> measuring conditional guidance; it was measuring a hole in the metadata. Both arms
> remain at ceiling against each other (inline 29/30, conditional 30/30, tokens
> −2.27%), so Q2's own prediction is untouched and its cross-record half is STILL
> untested — though it is now testable on `metered-vs-model`, where the new sentence
> IS pruned.

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

> **ANSWERED 2026-09-22 — AND THE MECHANISM IS NEITHER OF THE TWO BELOW.** 40 runs,
> two arms, two models, n=10, plus a zero-run measurement of the fixed input cost.
> See [`results/2026-09-22-q3-cost-decomposition.json`](results/2026-09-22-q3-cost-decomposition.json).
> The prediction is left exactly as registered.
>
> **First, with no runs at all:** `rich` pays **MORE** on input, on both counts — a
> tool definition 725 chars larger and a response 788 chars larger (the alerts), so
> **+1,513 chars (~378 tokens) every call**. The saving therefore has to exceed the
> observed gap, not equal it.
>
> | | haiku | sonnet |
> |---|---|---|
> | token gap (rich cheaper by) | **594** | **505** |
> | + rich's extra input | +378 | +378 |
> | = must be saved elsewhere | **972** | **883** |
> | explained by shorter ANSWER | 11 | 40 |
> | **residual** | **961 (99%)** | **843 (95%)** |
>
> **(a) fewer round trips — CONFIRMED as a rounding error.** Call counts differ in
> **1 of 20 pairs** (5%), under the registered 15% threshold. The one difference is a
> `words` run retrying with a huisletter.
>
> **(b) less to say — NOT SUPPORTED.** The ANSWER *is* shorter for `rich` (by 44
> chars on haiku, 160 on sonnet), so the literal falsification criterion — "output
> length is equal while total tokens still differ" — does not fire. But it accounts
> for **2% of the saving on haiku and 8% on sonnet**. Real, and small.
>
> **The actual mechanism is a third one this question never named: LESS TO THINK.**
> The arm without the computed figure does not write a longer essay — it deliberates
> longer to produce one of similar length. With identical call counts and comparable
> answer lengths, `words` takes **1.63× longer on haiku and 2.01× on sonnet**. The
> duration observation cited below replicates almost exactly (measured 9.3s vs 18.6s
> on sonnet); what it was taken to *mean* does not.
>
> **What can now be quoted:** richer metadata can be cheaper per run even though it
> is strictly larger on the wire, because the dominant cost is the model working out
> what it was not told. That is broader than (b), and it survives `rich` paying ~378
> tokens more in input on every single call.
>
> **Caveat that matters:** `subagent_tokens` does not split input from output — as
> this question itself flagged. The residual is an *inference*, not a measurement.
> Duration corroborates it independently but is also a proxy.

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

---

## Q5 — Does the deliberation saving survive when the answer is NOT handed over?

> **ANSWERED 2026-09-22 — PREDICTION CONFIRMED. The first one in this file that
> has survived its own test.** 20 runs, haiku, n=10 per arm, same batch. See
> [`results/2026-09-22-q5-deliberation-control.json`](results/2026-09-22-q5-deliberation-control.json).
>
> | | `gas-estimate` (alerts DO answer it) | `overheating` (alerts do NOT) |
> |---|---|---|
> | token delta | **rich 594 CHEAPER** | **rich 1,172 DEARER** |
> | duration ratio | **1.63×** | **1.01×** |
>
> The sign flips and the duration gap collapses. Same arms, same protocol, same
> model — only the question changed. Neither falsification criterion fired.
>
> Magnitude ran ~3.3× larger than the predicted ~350 tokens, because the
> prediction priced the alert payload once per call when it is in fact carried
> through every turn, and because `rich` averaged slightly more tool calls.
>
> **Q3's claim now needs its qualifier:** the saving comes from metadata that
> answers *the question being asked*. Metadata that is merely present and
> irrelevant is charged at list price on every call — here, +1,172 tokens for five
> alerts about gas, CO₂ and Paris Proof when the question was about overheating.
>
> That is more useful than the unqualified version, because it tells you what to
> put in alerts: the things your users actually ask about.
>
> **A separate and serious finding:** `overheating` is **not functioning as a
> control**. Ground truth is *significant* risk (3.59 > the 1.5 threshold), and
> **8/10 rich and 7/10 words asserted no or low risk** — the `must_not_say`. Both
> arms carry the threshold line and both ignore it, inventing their own instead
> ("below the 40-hour standard", "below the 5 K threshold"). They read 3.59 as
> degrees or hours, which sound small, rather than as the index the prose defines.
> **This is README finding §2 again** — a misleading name defeating adjacent
> guidance — and this time it defeats prose present in *both* arms.

> **REGISTERED 2026-09-22, BEFORE THE RUN.** This is an attack on Q3's finding,
> not a confirmation of it. Written and committed before any run was spawned.

### What Q3 established

`rich` costs ~500–600 tokens less per run than `words` on `gas-estimate`, despite
paying **~378 tokens more input** on every call. The saving is not round trips
(call counts identical in 19 of 20 pairs) and not output (a shorter answer explains
2–8%). The residual is **95–99%**, and `words` takes 1.63×/2.01× longer with the
same calls. Q3's conclusion: the saving is **deliberation** — the model working out
what it was not told.

### The obvious objection

`gas-estimate` is `rich`'s best case. Its `alerts` array literally contains the
answer (*"Estimated space-heating gas equivalent: ~253 m³/year"*). So "rich
deliberates less" may be nothing more general than "rich was handed the answer and
words was not". If so, the finding is real but narrow, and the quotable line —
*richer metadata can be cheaper because the dominant cost is working out what you
were not told* — overclaims.

### The test

`overheating` on Van Beuningenstraat 1. Verified on the wire before registering:

- `temperatuuroverschrijding` = **3.59** is present in BOTH arms' responses.
- `rich` returns **5 alerts** on this record — multiple VBOs, Paris Proof, gas
  estimate, CO₂, heat-pump suitability — and **not one of them mentions
  overheating**. The question's own `asks` field already says so: *"Control: no
  alert covers it, so alerts should not help."*
- `rich` still pays the input penalty: **+1,398 chars (~+350 tokens)** per call
  (+725 tool definition, +673 response).

So both arms hold identical information about the thing being asked, and `rich`
carries ~350 tokens of payload irrelevant to it. This isolates the mechanism: if
the saving is deliberation about *the answer*, it must vanish here.

### Prediction

> **The saving disappears, and reverses. `rich` will be MORE expensive than
> `words` on this question, by roughly its input penalty (~350 tokens, order of
> magnitude 200–450). Durations converge to within ~1.2×.**
>
> The reasoning: deliberation is driven by uncertainty about the answer. Neither
> arm is told the answer here, both read the same field against the same
> threshold, so neither has less to work out. What remains is the payload
> difference, which `rich` pays and does not recover.
>
> **Falsified if** `rich` is still cheaper by more than ~100 tokens on a question
> its alerts do not answer, **or** if the duration ratio stays above ~1.3×. Either
> would mean the saving is not about the specific answer — that carrying more
> context makes the model cheaper in general — which is a *larger* claim than Q3
> made and would need its own explanation.

### Why the outcome is useful either way

- **Prediction holds** → Q3's finding is real but must be stated narrowly: the
  saving comes from metadata that answers *the question being asked*, not from
  richer metadata as such. The quotable line needs that qualifier.
- **Prediction fails** → the effect is more general than Q3 claimed and the
  mechanism is not yet understood. That is the more interesting result and should
  be reported as such.

### Cost

1 question × 2 arms × 2 models × n=10 = **40 runs**. No new arm, no deploy.

---

## Q6 — Is the `overheating` failure caused by the FIELD NAME?

> **ANSWERED 2026-09-22 — PREDICTION FALSIFIED. It is not the name.** 21 runs,
> haiku, n=7 per arm, all three arms in the same batch. See
> [`results/2026-09-22-q6-overheating-naming.json`](results/2026-09-22-q6-overheating-naming.json).
>
> | arm | correct | wrong | declined | other |
> |---|---|---|---|---|
> | `words` | **2** | 5 | 0 | 0 |
> | `opaque-words` | **0** | 6 | 1 | 0 |
> | `opaque` | **0** | 1 | 3 | 3 |
>
> `opaque-words` did not beat `words` — it did **worse**, despite carrying strictly
> better guidance on both counts: a field name with no connotation *and* an explicit
> *"unitless"* with the 1.5 threshold spelled out in capitals. **It scored zero.**
>
> Three of its seven runs did not use `to` at all and invented a different field
> instead — *"ahe (Actuele Huisklimaatindex) value of 0, which indicates no risk"*.
> `ahe` is the renewable share.
>
> The two regimes fail **differently**: the readable name gets the model to the right
> field and then misleads it about units (3.59 read as hours, or as degrees); the
> terse name loses the model entirely. `words` scores higher only because it at least
> engages the correct field.
>
> **This contradicts `_the_rule`.** `overheating` is interpretation-shape — read one
> value against a stated threshold. The semantics are present, correct and explicit
> in two arms, and the combined score is **2 of 21**. Semantics do not handle this
> interpretation. That is the third failure to replicate the rule and the clearest:
> the guidance is not absent or ambiguous here, it is spelled out and ignored.
>
> **CORRECTED 2026-09-22 BY Q13 — "prose will not fix it" is TOO GENERAL.** Every arm
> Q6 tested (`words`, `opaque-words`, `opaque`) carries its guidance in the
> **DESCRIPTION**. The response channel was never tested. It fixes the defect
> completely: `inline`, carrying the byte-identical threshold line in the RESPONSE,
> scores **20/20** where `words` scores 5/20 and cites the threshold in **0 of 20**
> runs. What Q6 measured is a delivery failure, not a failure of prose. The original
> text is left below as written. See
> [`results/2026-09-22-q13-overheating-response-channel.json`](results/2026-09-22-q13-overheating-response-channel.json).
>
> **So yes — this is a defect in the shipped tool, and prose will not fix it.** The
> indicated fix is server-side computation, exactly as for the gas figure:
> `generateAlerts` computes *"~253 m³/year"* and *"suitable for a heat pump"* but
> computes **nothing** for `temperatuuroverschrijding`, which is why Q5 found `rich`
> no better than `words` here. An alert reading *"Overheating risk: SIGNIFICANT
> (TOjuli 3.59, above the 1.5 threshold)"* is the `benchmark-trap` playbook, which
> took that question from 0/60 to 59/60. **The live Warmtebouw Duurzaam server
> exposes the same field and should be checked.**

> **REGISTERED 2026-09-22, BEFORE THE RUN.** Committed before any run was spawned.

### The defect

Q5 found `overheating` is not working as a control: **8/10 `rich` and 7/10 `words`
asserted no-or-low risk** against a ground truth of *significant*
(`temperatuuroverschrijding` 3.59, threshold 1.5). Both arms carry the threshold
line; both ignore it and invent their own — *"below the 40-hour Dutch standard"*,
*"below the 5 K threshold"*, *"well below 10+ K"*.

### The hypothesis

The field name is doing the damage. `temperatuuroverschrijding` means "temperature
exceedance", so `3.59` reads as **3.59 °C** or **3.59 hours** — both of which sound
small. The prose beside it is defeated by the name, which is exactly README §2
(`berekend_energieverbruik_kwh_m2` says kWh/m², so models benchmark it).

Two defects, verified on the wire, and the opaque arms have **neither**:

| | readable (`rich`/`words`) | opaque (`opaque-words`) |
|---|---|---|
| field name | `temperatuuroverschrijding` — reads as °C or hours | **`to`** — no connotation |
| glossary says unitless? | **no** | **yes** — *"unitless"* |

### Prediction

> **`opaque-words` beats `words` on this question, by a wide margin — despite
> carrying strictly less readable field naming.** `opaque` (code, no glossary)
> scores near zero, because `to: 3.59` is uninterpretable without the glossary.
>
> Expected ordering: **`opaque-words` ≫ `words` > `opaque` ≈ 0.**
>
> **Falsified if** `opaque-words` does not clearly beat `words`, which would mean
> the name is not the cause and the failure is something else — most likely that
> `3.59` simply reads as "small" regardless of what it is called, in which case no
> renaming fixes it and the guidance itself has to change.

### Note on comparing across regimes

The README says never to compare readable against opaque, because they differ in
field naming **as well as** metadata. Here field naming **is the variable under
test**, deliberately. The comparison is legitimate for this question and this
question only, and the confound is the point rather than a flaw.

### If the prediction holds

This is not just a measurement — it is a **defect in the shipped tool**, in the
same class as the `CALCULATED vs MEASURED` gap that took `benchmark-trap` from
0/60 to 59/60. The fix would be to say **unitless** in the readable interpretation
block, as the opaque glossary already does, and re-run. The live Warmtebouw
Duurzaam server exposes the same field and should be checked too.

### Cost

1 question × 3 arms × 1 model × n=10 = **30 runs**. No new arm, no deploy.

---

## Q4 — Is the operative ingredient the FACT or the INSTRUCTION?

> **ANSWERED 2026-09-22 — THE PREDICTION BELOW IS FALSIFIED ON BOTH OF ITS OWN
> CRITERIA.** 180 runs, three arms, three models, two questions. See
> [`results/2026-09-22-q4-fact-vs-instruction.json`](results/2026-09-22-q4-fact-vs-instruction.json).
> The prediction is left exactly as registered.
>
> | `benchmark-trap` | haiku | sonnet | opus | total |
> |---|---|---|---|---|
> | `inline` (both) | 10 | 10 | 10 | **30/30** |
> | `inline-fact` | 5 | 10 | 10 | **25/30** |
> | `inline-instruction` | 0 | 0 | 10 | **10/30** |
>
> `metered-vs-model`: **30/30 for all three arms.** 0 confidently-wrong and 0
> fabricated across all 180 runs.
>
> Both registered falsification criteria fired: fact-only came within 3 of both on
> TWO models (0 apart on each), and instruction-only scored below fact-only on TWO
> models. The second prediction inverted too — instruction-only was predicted to WIN
> on `benchmark-trap` and LOSE on `metered-vs-model`; it lost the first and tied the
> second.
>
> **Why.** The instruction is conditional: *"where a question asks how a building
> compares to a METERED BENCHMARK, say the comparison cannot be made."* Its trigger
> condition is the very fact that was withheld — to fire it on `benchmark-trap` the
> model must already know Paris Proof is defined on measured final energy. The
> control settles it: on `metered-vs-model` the question itself contains the word
> "metered", the trigger is visible in the prompt with no domain fact needed, and the
> same arm scores 30/30. **An instruction is not executable without the semantics
> that say when it applies.** The "tool metadata must specify BEHAVIOUR, not
> SEMANTICS" reframing this question was registered to test gets no support here.
>
> **Tokens.** `instruction-only` is the cheapest arm — by 112 tokens, 0.4% — and also
> the worst. Quality and cost still do not point the same way.
>
> **Caveats that matter.** `instruction-only` also lost the two-word label by design,
> so fact and label cannot be separated by this run. opus scored 10/10 on all three
> arms, so a third of the matrix measures nothing. Q2's cross-record half was NOT
> run: it needs `inline-conditional`, which was not in this arm set.

> **REGISTERED 2026-09-21. ARMS BUILT AND DEPLOYED; NOT YET RUN.** The prediction
> below was written before the arms existed and is left exactly as registered.
>
> `mcpInlineFact` / `eval-inline-fact` and `mcpInlineInstruction` /
> `eval-inline-instruction`, deployed 2026-09-21 and **verified on the wire** (over a
> direct MCP client, since a session cannot reach a server added to `.mcp.json` after
> it started):
>
> | arm | interpretation chars | FACT present | INSTRUCTION present | label present |
> |---|---|---|---|---|
> | `inline` (both) | 5,020 | yes | yes | yes |
> | `inline-fact` | 4,856 | yes | **no** | yes |
> | `inline-instruction` | 4,504 | **no** | yes | **no** |
>
> All three return a byte-identical one-sentence description. The label
> "CALCULATED vs MEASURED" is withheld from `inline-instruction` on purpose — it is
> itself a two-word statement of the distinction, so leaving it would leak the fact
> that arm exists to withhold.
>
> The prose is SLICED from `interpretationBlock` and `both` is COMPOSED from the two
> halves, so `both` is by construction exactly fact + instruction and no arm can
> drift. `get-building-profile-inline-ablation.test.ts` pins that the arms differ from
> `inline` in EXACTLY ONE LINE, that instruction-only leaks neither the semantics nor
> the label, and that instruction-only is the shortest of the three.

### Why it matters

The sentence that took `benchmark-trap` from 0 of 60 to 59 of 60 bundles two different
kinds of content:

- a **FACT** — `ep1`/`ep2`/`berekend_energieverbruik` are calculated NTA 8800 figures,
  Paris Proof is defined on measured final energy at the meter, and this server holds no
  metered data;
- an **INSTRUCTION** — "Where a question asks how a building compares to a metered
  benchmark, say that the comparison cannot be made from this data and why, rather than
  producing a ratio."

Before the change, `opus`/`inline` **named the mismatch in 7 of 10 runs and returned the
forbidden verdict in 10 of 10.** It had the fact. What it lacked was the instruction.

If that generalises, the finding is much larger than "write better field descriptions":
it is that tool metadata must specify **behaviour**, not only **semantics** — and
essentially all the metadata on the `words`/`rich` ladder, and in the wild, is semantics.
That would reframe the whole argument.

### The arms

Three response-channel variants of the same line, off `inline`. Same description, same
schemas, same render tools, same question. Nothing else changes.

| arm | ships |
| --- | --- |
| `fact-only` | the two clauses naming what the quantities are and that no metered data exists. No guidance on what to do. |
| `instruction-only` | the behavioural clause alone — say the comparison cannot be made and why, rather than producing a ratio. Does NOT say why the quantities differ. |
| `both` | the line as deployed 2026-09-21. **Already measured: 59 of 60.** |

Cheapest possible build: two new endpoints; `both` already exists as the current
`inline`. No new question and no new address needed for the first half.

### Prediction

> `instruction-only` ≈ `both`, and both beat `fact-only` by a wide margin.
>
> The reasoning: opus already had the fact 7 times in 10 and acted wrongly all 10 times,
> so on the strongest model the fact alone demonstrably does not change behaviour. Haiku
> never had the fact at all (0 of 20) and should therefore gain more from `fact-only`
> than opus does — but still less than from `instruction-only`, because an instruction is
> executable without understanding the reason for it.
>
> **Falsified if** `fact-only` comes within 3 runs of `both` on any model, or if
> `instruction-only` scores below `fact-only` on any model.

### The failure mode that makes it a real experiment

An instruction without its reason should be **brittle**: it ought to fix the case it
names and do nothing for a case it does not. So the run needs a SECOND question the
instruction does not mention — `metered-vs-model` (Middenwetering 1), which asks the same
class of thing about a different record and a different berekeningstype.

> **Prediction:** `instruction-only` wins on `benchmark-trap` and **LOSES to `both` on
> `metered-vs-model`**, because there the model must recognise an unnamed case from the
> principle rather than follow a named rule. If `instruction-only` wins there too,
> instructions generalise better than I expect and the "specify behaviour" reading gets
> considerably stronger.

### Also measure in the same run

**Tokens.** `instruction-only` is the shortest of the three variants. If it matches
`both`, then the best-performing metadata is also the cheapest — which would be the first
time in this repo that quality and cost point the same way. Every prior result has them
in tension or unrelated.

### Cost

2 questions × 3 arms × 3 models × n=10 = **180 runs**, two new arms to build and deploy.
`metered-vs-model` is also where Q2's untested cross-record half can finally be run,
since the calculated-vs-measured line was believed to be pruned on a NEN 7120 record — so one build
serves two open questions.

## Q7 — Was the description ABSENT at interpretation time, or present and ignored?

> **REGISTERED 2026-09-22, BEFORE THE RUN.** Registered with Q8–Q12 in one commit,
> from the frame in [`research-frame.md`](research-frame.md).

### Why it matters

This file currently says the description-channel guidance "weakened substantially by the
time the model had to interpret the returned data" (Q1). That phrasing survives only
because nobody checked the obvious alternative: **the description may have been sitting
in the request the whole time.** Most hosts keep tool definitions in every inference
request, not only the one that selects the tool.

If it was present, then `4/30` versus `29/30` **cannot** be explained by the model no
longer having the information, and every sentence in this repo that reads like
"forgetting" is wrong. The defensible claim becomes the stronger and stranger one:

> **The knowledge was available, and placement changed whether it was applied.**

Until this lands, `research-frame.md` principle 1 is not quotable and neither is the
word "weakened". Everything else in the file is downstream of it, which is why it is Q7
and not Q12.

### What is already known, and why it points one way

Q5 measured `rich`'s input penalty as **+725 chars of tool definition per call** — per
*call*, not per session. The accounting only works if the definition is re-sent on every
turn. That is strong circumstantial evidence for "present", from a run done for another
purpose entirely.

### The test — two probes, neither needing a new arm

**7a — accounting.** Record input tokens per turn for a 1-call and a 3-call trajectory on
the same arm and question. If the tool-definition bytes are charged once, the description
is sent once; if they scale with turns, it is present at interpretation time. Q5's
per-call figure predicts the latter.

**7b — canary.** Append to the `words` description one instruction that can only be obeyed
*after* the result exists: *"When you report a record from this tool, end your answer with
the marker ⟨D7⟩."* It is content-free — no domain knowledge, nothing to reason about, no
ground truth to get wrong. If the marker appears, the description was present **and read**
at the post-tool step, and the 4/30 is a failure to *apply* domain guidance rather than
to *see* it.

Run 7b against `words` and `opaque-words` so the answer is not a property of one
description.

**Do not edit the shipped `words` and `opaque-words` arms to do it.** This repo has
already lost a run to an arm that changed underneath it (see the stamping failure at the
top of this file) and six prose arms are still awaiting re-baselining. Deploy
`words-canary` and `opaque-words-canary` as throwaway variants, and delete them after.
The canary's whole value is that it changes nothing else — so it must change nothing
else.

### Prediction

> **Present, and read. 7a shows tool-definition bytes charged per turn; 7b's marker
> appears in ≥8 of 10 runs on both arms.**
>
> The reasoning: Q5's per-call penalty, plus the fact that a bare formatting instruction
> asks nothing of the model except compliance — and compliance with format instructions
> is the one thing every arm in this repo does well, haiku excepted.
>
> **Falsified if** the marker appears in ≤3 of 10, **or** if input accounting shows the
> definition charged once per session. Either would mean the description really does fall
> out of the interpretation step, Q1 becomes a much more mundane result — knowledge that
> is gone cannot be applied — and the interesting question moves to *which* hosts drop it.

### The outcome that would be most awkward

Marker at 8/10 while the *domain* sentence in the same description scores 4/30. That is
the sharpest single finding available in this file: same channel, same request, same
turn — obeyed as an instruction, ignored as domain knowledge. It would make the variable
**what the model does with a channel**, not what the channel contains, and it would set
up Q4's fact-versus-instruction result rather than repeat it.

### Cost

7a: re-reading instrumentation on any existing run — free. 7b: 1 question × 2 arms ×
1 model × n=10 = **20 runs**, one description edit, one deploy.

---

## Q8 — The bootstrap channel: is the boundary the RESPONSE, or just NOT-THE-DESCRIPTION?

> **REGISTERED 2026-09-22, BEFORE THE RUN.**

### Why it matters

Q1b compared exactly two channels for the DERIVED FIGURES recipe — description
(`words-recipe`, 4/30) and data response (`inline-recipe`, 29/30) — and the file has been
reading that as *responses beat descriptions*. There is a third channel between them that
this repo has never built: a **parameterless guidance call** that returns HOW before any
data exists. It is a real pattern (the production Duurzaam server ships `start_duurzaam`),
and it sits on the far side of the execution boundary while still being *upstream* of the
data.

That distinguishes two very different stories:

- **"Interpretation must travel with the data"** — then guidance-call placement should
  fail like the description did, because the recipe still arrives before the record.
- **"Anything the model receives as a tool RESULT is treated differently from a tool
  DEFINITION"** — then guidance should score like the response arm, and the variable is
  channel *role*, not proximity to data.

The second is the more useful finding for anyone building a server, and it is the one
this repo cannot currently tell apart.

### The arm

`guidance-recipe` — new variant, same shape as the others:

- `get_building_profile` description: minimal, **no** recipe;
- calling it with no parameters returns the HOW block verbatim (the same bytes as
  `words-recipe` and `inline-recipe` ship);
- the parameterised call returns data with **no** interpretation prose.

Byte-identical guidance, three channels, one question. `gas-estimate` is the question,
because the recipe is the whole difference between 0/10 and 10/10 on it and no model
tested derives the conversion unaided (see `2026-09-21-guide-ablation.json`).

### Prediction

> **`guidance-recipe` lands with the response arm, not the description arm: ≥25/30,
> against `words-recipe`'s 4/30.**
>
> The reasoning: the guide ablation showed the recipe works whenever the model actually
> reads it, and Q7 (if it holds) says the description is read too — so what separates
> 4/30 from 29/30 is not availability but the role the model assigns to the surface.
> A tool *result* is evidence about the task; a tool *definition* is documentation about
> a capability. The guidance call is a result.
>
> **Falsified if** `guidance-recipe` scores ≤10/30, which would mean proximity to the
> data is what matters and the recipe must ride along with the record — a stricter and
> more expensive design rule, since it has to be re-sent on every call.

### Also worth reading off the same run

Whether the model *makes* the parameterless call unprompted. If it does not, the channel
is worthless regardless of how well its content performs, and that is a finding about
bootstrap patterns generally — including the shipped `start_duurzaam`.

### Cost

1 question × 3 arms (`words-recipe`, `guidance-recipe`, `inline-recipe`) × 2 models ×
n=10 = **60 runs**, one new arm to build and deploy.

---

## Q9 — Position inside the response, and distance across turns

> **REGISTERED 2026-09-22, BEFORE THE RUN.**

### Why it matters

The standing objection to Q1 is *"you are just measuring recency"*. It deserves a direct
answer, and the two halves of it are not the same claim.

**Position within one response** is the weak version: if the interpretation block works
better last than first, response *ordering* becomes part of interface design. Today
`inline` spreads `interpretation` after the profile fields, so it is already last, by
accident rather than decision.

**Distance across turns** is the strong version, and the one that decides whether a
bootstrap channel (Q8) is durable: guidance delivered once has to survive whatever the
agent does before it reaches the data.

### The arms

- `inline-head` — the identical block, emitted as the **first** key of the JSON instead
  of the last. One-line change, zero bytes different.
- Distance is tested without a new arm, by protocol: `guidance-recipe` (Q8) followed by
  0, 1 and 3 intervening `get_weather_context` calls before the building lookup.

### AMENDED 2026-09-22 — the instrument changes, and it should have from the start

Both halves above are weak on `get_building_profile`, for the same reason: **its response
is too small for distance to exist in.** One record is ~1,400 chars. Moving a block from
the first key to the last moves it a few hundred tokens, which is not a distance, and
three intervening calls are the only way to open a gap at all.

`get_weather_context` has a payload dial and the building tool does not. Measured on the
wire (`weather-fixtures.json`, `payload_dial`):

| call | response |
|---|---|
| `summaryOnly=true` | ~1,300 chars (~330 tokens) |
| 366 days, `select` to 3 fields | ~20,000 chars (~5,000 tokens) |
| 366 days, full records | ~73,000 chars (~18,000 tokens) |

A **55× range on one tool, one question, one guidance block** — and the block can sit
before 18,000 tokens of daily records or after them. That is the position experiment the
building tool cannot run. It also costs no new arm for the range itself: the prose and
one-sentence weather descriptions are already wired (`opts.minimal`).

Run Q9 on `weather-partial-normalization` (`questions-weather.json`), which needs the
guidance — the HDD-ratio rule — and returns as much or as little data as the call asks
for. **Revise the prediction's threshold when it runs at this scale:** "within 2 of
`inline`" was written for a 1,400-char response and is not the same test at 73,000.

### Prediction

> **Position within a response does not matter (`inline-head` within 2 of `inline`
> on 30 runs). Distance across turns does (≥5 lost between 0 and 3 intervening calls).**
>
> The reasoning: this file has measured volume three times and found it inert — 37–50%
> pruned, then 67% pruned, zero answers changed — while every effect it *has* found came
> from a channel change or a wrong sentence. A few hundred tokens of reordering inside
> one response is the smallest perturbation yet attempted. Turn distance is a different
> mechanism: the guidance stops being adjacent to anything and starts competing with
> everything the intervening calls returned.
>
> **Falsified if** `inline-head` differs from `inline` by ≥3, which would make ordering
> a real design surface and would partially rescue the recency objection — or if the
> distance curve is flat, which would make guidance-once-per-session a safe pattern and
> materially cheapen every recommendation in `research-frame.md`.

### Cost

Position: 1 question × 2 arms × 1 model × n=10 = **20 runs**, one trivial arm.
Distance: 3 distances × 1 arm × 1 model × n=10 = **30 runs**, no new arm, but it needs
Q8's arm deployed first.

---

## Q10 — Field addressability: can `relates_to_fields` beat a misleading name?

> **REGISTERED 2026-09-22, BEFORE THE RUN. This is the one this repo already has
> evidence AGAINST — see Q6.**

### Why it matters

Q5 and Q6 together are the hardest thing in this file for the *put interpretation next to
the value* principle. On `overheating` the threshold sentence is present in every prose
arm, adjacent to the value, and **every prose arm ignores it**: 8/10 and 7/10 asserting
no-or-low risk against a ground truth of *significant*, reading
`temperatuuroverschrijding = 3.59` as degrees or hours and inventing thresholds to match.
Q6 then tested the obvious culprit — the name — and **falsified it**: a neutral field
code plus an explicit *unitless, threshold 1.5* scored **0 of 7**, worse than the
readable name's 2 of 7, because three runs lost the field altogether and answered from
`ahe`, the renewable share.

So: adjacency does not bind, and renaming does not rescue it. **2 correct in 21.** Q6's
conclusion was that prose will not fix this and the repair is server-side computation.

That is the state Q10 walks into, and it is why the question is worth running rather than
assuming. The draft proposes two primitives that are neither prose nor renaming — they
make the link between rule and field **machine-explicit** instead of spatial:

- `relates_to_fields` — *which returned values does this knowledge interpret?*
- `triggered_by` — *which value made the server decide it applies?* (the activating field
  need not be the explained field: `berekeningstype` activates the reading of `ep2`)

The claim under test is that an explicit edge routes attention where adjacency only
hopes to. If it holds, structure is a third mechanism alongside prose and naming, and the
first one to survive this question. If it does not, then **nothing short of computing the
verdict works here**, and the guidance for server authors is blunt: do not annotate your
way out of a value the model will misread.

### The arm

`inline-addressed` — as `inline`, but the interpretation block becomes a list of objects
carrying `relates_to_fields`, `triggered_by` and `meaning`, with the same sentences.
Byte count will rise slightly; per Q2 and Q9 that is not expected to matter on its own,
and `inline` is the control that says so.

### Questions to run it on

`overheating` and `benchmark-trap` — the two where a field name actively lies about what
it holds — plus `gas-estimate` as a null case where no name is misleading.

### Prediction

> **It does not work. `inline-addressed` stays at or below 4/10 on `overheating` —
> within noise of `inline` — and is flat on the other two.**
>
> The reasoning, stated against the draft's own hypothesis: the failure Q6 documented is
> not the model failing to find which rule goes with which field. In `words` it reaches
> the right field and then **overrides the stated threshold with an invented one**. An
> explicit edge answers *which field does this rule explain* — a question the model was
> already answering correctly. It does not make a rule more believed, and belief is what
> is missing.
>
> Registering the null is the point: `relates_to_fields` is an appealing primitive and
> this file's record is that appealing mechanisms measure at zero more often than not.
>
> **Falsified if** `overheating` reaches ≥7/10. That would be the most interesting single
> result available in this file — it would mean structure succeeds where identical prose
> failed, that the model treats a machine-readable edge as a stronger commitment than a
> sentence, and that the layered model gains a real primitive rather than a vocabulary.

### Why the outcome is useful either way

A win gives the layered model its missing primitive and the first mechanism that beats a
name. A null retires `relates_to_fields` before it reaches a guide, and leaves Q6's much
less glamorous conclusion standing: **for a value the model will misread, compute the
verdict server-side — do not annotate your way out.** Either way, run the
`overheating` alert fix separately; it is a shipped defect, not an experiment.

### Cost

3 questions × 2 arms × 2 models × n=10 = **120 runs**, one new arm to build and deploy.

---

## Q11 — Does `outputSchema` reach the model at all?

> **REGISTERED 2026-09-22, BEFORE THE RUN.**

### Why it matters

The root `README.md` states, as fact, that the output schema is *"deliberately shape-only
— the model never sees this"*, and records that interpretation was moved out of it and
into the description for that reason. **That assertion has never been measured.** The
schema is registered on the tool and therefore goes over the wire in `tools/list`;
whether the host surfaces it at the post-tool step is a host property, and this repo has
been asserting the answer instead of testing it.

It is the cleanest instance in the whole file of *protocol-visible ≠ model-effective*. It
also decides a real architectural question: whether `outputSchema` can serve as the
**canonical** home for stable field semantics — units, types, invariant meaning — that the
response then **projects**, or whether canonical and delivered have to be the same place.

### The arms

- `schema-semantic` — the existing minimal arm, plus full `.describe()` interpretation on
  every output field: units, stable meaning, the calculated-vs-measured distinction. The
  description and the response stay bare.
- `words` and `inline` as the already-measured comparisons for the same sentences in the
  other two channels.

### Prediction

> **No measurable effect. `schema-semantic` scores within 2 of the bare arm on every
> question, i.e. it behaves like `thin`, not like `words`.**
>
> The reasoning: the existing `schema` arm moved 0/18 → 18/18 on the one question where
> the correct call cannot be **expressed** without the parameter, and ≈0 on everything
> else. Schemas have bought expressibility here and never meaning. Note this prediction
> agrees with the README's assumption — which is exactly why it needs a run rather than a
> re-reading.
>
> **Falsified if** `schema-semantic` scores within 3 of `words` on any interpretation
> question. That would mean the canonical/projection split is buildable as stated, that
> a stable-semantics layer costs nothing to place correctly, and that the README's claim
> — and the refactor it justified — need revisiting.

### AMENDED 2026-09-22 — a sharper version of this question exists, in `select`

The version above asks whether schema semantics help the model *interpret*. There is a
harder case where schema knowledge is not an aid but a **precondition**, and this repo
already ships it: `get_weather_context`'s `select` is the only mechanism here where the
model must supply **output** field names as an **input** parameter.

Two things make it the sharper test:

**The failure is silent.** Captured on the wire (`weather-fixtures.json`,
`select_probe`): `select: ["date","maxTemperature","weather"]` — plausible guesses, both
wrong — returns **HTTP success, `recordCount` unchanged, three well-formed records
carrying only `date`**. Every requested value is gone. Nothing errors; one alert says so.
A model that guesses field names does not fail loudly, it reports an empty projection as
an answer. So "can the model name the fields" has a real consequence, not a stylistic one.

**And names are the WEAKER half of the problem.** Knowing the names lets you filter at
all. Knowing what the fields *mean* is what stops you projecting to a, b, c when the
conclusion needed d — and that failure leaves **no trace at all**, because nothing
invalid happened. Two questions in `questions-weather.json` isolate it:

| | the field that carries the answer | what a plausible smaller projection does |
|---|---|---|
| `select-hides-the-evidence` | `tempMin` **and** `tempMax` jointly | `tempMean` loses the phenomenon *and inverts the ranking*: the 11 qualifying days average 15.8–18.3 °C, and the two warmest days by mean are not qualifying days at all |
| `select-wrong-degree-day` | `weightedHdd` | `hdd` is 6.7% lower over the same quarter and silently wrong for a Dutch normalization |

In both, every name is valid, every record is well-formed, **no alert fires**, and the
response is indistinguishable from a correct one. That is a strictly worse failure than
the guessed-name case, and it is the one that actually bears on whether output-field
*semantics* have to be model-visible at call time.

**It also exposes a tension this file has not met before.** `select` exists to save
tokens, and *"keep the response small"* sits in both question prompts on purpose — that
instruction is exactly what pushes a model to drop a field. Everywhere else in this repo
pruning was free (Q2: −67% of the block, zero answers changed). Here pruning is the
mechanism of the error. **Measure tokens and correctness together on these two, or the
result means nothing.**

**The repo already ASSUMES the answer, and has never tested it.** The twelve record field
names are declared twice: in `outputSchema.records`, each with its own `.describe()`, and
again in the **`select` input-schema description** — identically on every arm, including
`minimal` and `opaque`. Someone wrote them into the input side because the output schema
alone was not trusted to make them usable at call time.

Note precisely what that is and is not. It is a **design choice**, so it is evidence about
what its author believed — not about what a model does. The duplication is load-bearing
only if removing it makes the model guess, and that has never been run. Reading the code
as confirmation would be this repo's own signature error, one register up: *the names are
in the input description, therefore they were needed there* is the same move as *the
knowledge is in the context, therefore the model has it*.

`select-blind` is the arm that measures it: identical in every respect except that the
`select` input description loses its field list, leaving the names only in `outputSchema`.
Question: `select-blind` in `questions-weather.json`.

> **Prediction, names: the model guesses, and the guess is not recoverable from
> `outputSchema`. ≤3 of 10 runs send a fully valid `select` array, and of those that do
> not, at least half report the empty projection without noticing the alert.**
>
> **Falsified if** ≥8 of 10 send valid names, which would mean `outputSchema` does reach
> the model, that the duplication into the input description is dead weight, and that the
> main prediction of this question is wrong too.

> **Prediction, meanings — registered separately because it is the real claim.
> `select-hides-the-evidence` ≤4 of 10 on the prose arms, and the failures are SILENT:
> a well-formed answer, no alert, no hedge. `select-wrong-degree-day` ≤5 of 10, with
> `hdd` chosen over `weightedHdd` in most misses.**
>
> The reasoning: `tempMean` is the obvious compact choice for a temperature question and
> `hdd` is the obvious name for a degree day. Nothing in the response corrects either.
> The only thing that can is knowing what the fields mean *before* the projection is
> chosen — which is the claim under test, stated as a prediction rather than assumed.
>
> **Falsified if** either clears 8 of 10 on an arm whose description carries the
> semantics, which would mean prose at call time is sufficient and the semantics do not
> need to travel with the record.

Record a **third outcome** separately: a run that guesses, notices the alert, and
re-queries without `select` is *safe but expensive*. It is the behaviour you would want,
and it costs a full-payload round trip — which is the whole saving `select` exists to
provide.

### Cost

3 questions × 2 arms × 2 models × n=10 = **120 runs**, one new arm. Cheap to build: the
`.describe()` strings already exist in git history, from before they were moved out.
`select-blind` is a second arm and 20 more runs, and is worth more than the other three.

---

## Q12 — A second domain

> **REGISTERED 2026-09-22. THE GATE, NOT AN EXPERIMENT.**

### Why it matters

Everything in this file is one domain, one register pair, one tool shape, and one author
for the metadata, the questions, the ground truth and the scoring. No result here becomes
an MCP design rule until the central one — **the same bytes, moved from description to
response, change the answer** — reproduces somewhere with no shared vocabulary, no shared
ground truth and, ideally, no shared author.

### The test

The narrowest useful replication, not a second research programme:

- one existing production server with a genuine record-conditional rule **and no personal
  data** — the Artikelbeheer sentinel date (`0001-01-01` means *not set*, not a date in
  year 1) or the Ketenstandaard cross-table code collision. Both are the right shape: a
  value that reads as valid, with a rule that applies only to some records. The HR and
  fleet servers hold better traps and are **not** eligible: an eval publishes its
  records, and those records are colleagues;
- byte-identical guidance in description and in response;
- one question, two arms, two models, n=10.

Q1's shape, nothing more.

### Prediction

> **The direction replicates; the magnitude does not. Response placement wins, by
> noticeably less than 4/30 → 29/30.**
>
> The reasoning: `gas-estimate` is close to a best case — a constant the payload cannot
> contain, needed by every model, with a single correct road. Most real rules are less
> load-bearing than that, so the gap should compress.
>
> **Falsified if** the description arm matches or beats the response arm. That would
> localise the entire finding to this domain or this tool shape, and every general
> sentence in `research-frame.md` would have to be rewritten as a statement about Dutch
> building data.

### Cost

1 question × 2 arms × 2 models × n=10 = **40 runs**, plus the work of writing a second
domain's ground truth — which is the real cost, and the reason this is last.
---

## Q13 — Can the ALERTLESS tiers be fixed at all? Prose in the RESPONSE vs computation

> **ANSWERED 2026-09-22 — ALL THREE PREDICTIONS FALSIFIED. The channel is the whole
> story.** 60 runs, haiku, n=20 per arm, one batch. See
> [`results/2026-09-22-q13-overheating-response-channel.json`](results/2026-09-22-q13-overheating-response-channel.json).
>
> | arm | where the threshold sits | correct | confidently wrong | fabricated | **cited the 1.5 threshold** |
> |---|---|---|---|---|---|
> | `words` | DESCRIPTION | **5** | 10 | 9 | **0 of 20** |
> | `inline` | **RESPONSE** | **20** | 0 | 0 | **20 of 20** |
> | `rich` | computed verdict | **20** | 0 | 0 | 20 of 20 |
>
> The 1.5 threshold is present verbatim in **both** `words` and `inline`. `words`
> cited it **zero times in twenty**; `inline` cited it **twenty times in twenty**.
> Same sentence, same model, same question, same sitting — only the channel differs.
>
> - **P1** (`inline` ≤ 10/20) → **20/20.** Falsified.
> - **P2** (`rich` − `inline` ≥ 8) → **0.** Falsified.
> - **P3** (`inline` − `words` < 4) → **+15.** Falsified.
>
> **The registered reasoning was wrong in a specific, legible way.** It assumed the
> failure was a *prior* that survived the guidance — that 3.59 "sounds small"
> whatever you tell the model. Placement alone refutes that. Zero of twenty `words`
> runs cited the threshold against twenty of twenty for `inline`; when they do not
> use it they invent a unit, always one that makes 3.59 negligible — hours a year,
> degrees, percent — and 10 of 20 then conclude low or no risk.
>
> **But WHY placement mattered is not settled here, and an earlier draft of this
> banner overclaimed it.** It said the runs "never retrieved" the threshold. That is
> an inference about what was in context, and **Q7 is registered to test exactly
> it** — Q5 already charged `rich`'s tool-definition bytes *per call*, which points
> at the description being present the whole time. If it was, this result is the
> stronger one: the knowledge was available and placement decided whether it was
> applied. What this run measured is **use**, not availability.
>
> **And it is cheaper.** `inline` costs **9.7% fewer tokens than `words`** and
> **12.3% fewer than `rich`**, while tying for best. **This is the first arm measured
> in this repo that is simultaneously the cheapest and the best** — every previous
> cost/quality finding has them pointing in opposite directions.
>
> **Q6's conclusion is corrected.** Q6 said this was "a defect prose will not fix".
> True of prose in the DESCRIPTION, which is all Q6 tested. Prose in the RESPONSE
> fixes it completely. So **#48's computed alert was not wrong, but it was not
> necessary** — it is the expensive fix to a defect that had a free one. Check the
> channel before writing a computation.
>
> **And the interpretation block should not be edited for this.** The sequencing
> argument below was the point of running Q13 first, and it paid: the wording was
> never the problem, so the six-arm comparability cost stays unpaid.

> **REGISTERED 2026-09-22, BEFORE THE RUN.** Committed before any run was spawned.
> No new arm, no deploy, no change to any shipped byte — all three arms already
> exist and were preflighted on the wire for this run.

### The gap this closes

The overheating verdict is now computed (#48) and `rich` went **2/10 → 10/10**. But
the fix lives in `generateAlerts`, and **only `rich` has alerts.** `words`,
`opaque-words`, `schema`, `thin` and `inline` all still hand the caller a bare
`temperatuuroverschrijding: 3.59` and let them read it as degrees or as hours.

That population is not a curiosity. **It is the closest analogue in this repo to a
real third-party consumer of a plain MCP tool** — a description, a typed payload,
and no computed layer. If the only available fix is "compute it server-side", then
every MCP server that ships without a computation step has this defect and cannot
metadata its way out.

### Why this is NOT "reword the interpretation block"

Q6 already ran that experiment and it failed: the threshold is stated, in capitals,
with the word *unitless*, and the combined score across two arms carrying it was
**2 of 21**. Rewording is not the open question.

The open question is **channel**, which is the one variable Q1 showed to be
dominant — the same 438 bytes scored **29/30 in the RESPONSE and 4/30 in the
DESCRIPTION**. Every arm Q6 tested carried the threshold in the **description**.
`inline` carries the byte-identical line in the **response**, and *has never been
run on this question*.

Verified on the wire before registering:

| arm | where the threshold line sits | measured on `overheating`? |
|---|---|---|
| `words` | DESCRIPTION | yes — 2/7 (Q6), then 3/10 and 7/10 |
| `inline` | **RESPONSE**, byte-identical line | **never** |
| `rich` | computed verdict in `alerts` | yes — 10/10 post-#48 |

### The sequencing argument — why this runs before anything is changed

Changing `interpretationBlock` moves **six arms** (`words`/`rich`/`words-recipe`
descriptions, `inline`/`inline-recipe`/`inline-conditional` responses) and
invalidates comparability with everything scored before it on any question touching
the changed text. That is an expensive, one-way cost.

This run costs **nothing** — no deploy, no edit — and tells you whether that cost is
worth paying. If the response channel already fixes it, the alertless tiers need no
new prose at all, only a move. If it does not, then no wording in any channel will,
and the block should not be touched.

### The arms

`words` · `inline` · `rich`, all **readable** field names, so no cross-regime
comparison is involved and the README's prohibition is not engaged.

Per the skill: `inline` vs `words` is the two channels head to head and is the
clean single-variable comparison. **`inline` → `rich` is NOT an adjacent-rung
comparison** — it crosses the channel *and* the computation — and must be reported
as "prose versus computation", never as the value of one layer.

**haiku, n=20 per arm, all three arms interleaved in ONE batch, 60 runs.** haiku
because Q6 and the #48 verification both used it and it has headroom; n=20 because
the verification file flagged `words` drifting **3/10 → 7/10 with no code change**,
and this run re-measures that cell at double n in a single sitting as a by-product.

### Prediction

> **The channel will NOT fix it. Computation is doing the work, not placement.**
>
> - **P1 — `inline` does not fix it: ≤ 10/20.** Falsified if `inline` ≥ 16/20.
> - **P2 — the computation gap is large: `rich` − `inline` ≥ 8 runs.** Falsified if
>   the gap is under 4 runs, the directory's noise bar at n=10.
> - **P3 — the channel buys little here: `inline` − `words` < 4 runs.** Falsified
>   if `inline` beats `words` by 4 or more.
>
> **Reasoning, recorded so it can be wrong.** Q6's failure mode is not that the
> guidance goes *unread* — three arms reached the right field and then misread it.
> It is that `3.59` is interpreted through a prior about what an overheating number
> means, and *sounds small* on every unit the model might assume. Moving the same
> sentence nearer the data does not contradict a prior; it just repeats the rule.
> The computed alert works because it **removes the inference step** — it states the
> verdict instead of the rule that would produce it.
>
> **The case against my own prediction**, which is real: Q1's channel effect was
> enormous and this repo's registered predictions are 1-for-6. If P1 and P3 are both
> falsified, the reading is that `overheating` was a channel problem all along, #48
> was an expensive fix to a cheap one, and Q1 generalises from recipes to plain facts.

### Why the outcome is useful either way

| if | then |
|---|---|
| prediction **holds** | There are facts **prose cannot carry in any channel**. That is a boundary condition on Q1, which is currently stated without one — and it means the alertless tiers have **no metadata-only fix**. For a plain MCP tool that translates to one concrete instruction: write the verdict into the response body. |
| prediction **falsified** | The alertless population has a **free** fix — move the guidance from the description into the response — and the computation was not required. That is the cheaper and more generally useful result, and it would extend Q1 from procedures to facts. |

### Cost

1 question × 3 arms × 1 model × n=20 = **60 runs.** No new arm, no deploy, no
source change. Records `tool_uses`, `duration_ms`, `subagent_tokens` and the ANSWER
character count per run, and audits against `get_tool_call_log` unfiltered.

### Known limits, stated up front

- **haiku only.** Per §8 semantics scale inversely with model size, so a null result
  here is the *strong* direction (the model most helped by metadata is not helped);
  a null on opus would mean little. It still cannot support a claim above haiku.
- **One question, one defect.** `overheating` is a single interpretation-shape
  failure. A channel null here does not generalise to every fact.
- **No control.** `overheating` was the set's only non-separation control and has
  just been re-designated; both survivors are refusals. This run has no control
  behind it and the caveats must say so.

---

## Suggested order

~~1. **Q1b first.**~~ ~~2. **Q1a** next.~~ **Both run on 2026-09-21 and both
predictions falsified — see the banner under Q1.**

~~1. Redeploy and verify stamping.~~ ~~2. **Q2.**~~ **Both done on 2026-09-21** — the
redeploy is verified and Q2 is answered, along with the `benchmark-trap` repair its
failure mode uncovered.

> **CORRECTION, 2026-09-22 — the claim above is FALSE.** The CALCULATED vs MEASURED
> line is **NOT** pruned on a NEN 7120 record. Measured on the wire before running:
> it is PRESENT, with its instruction clause, in BOTH arms on BOTH records. The
> pruner treats it as unconditional. `inline-conditional` does cut the block hard on
> a NEN 7120 record — 5,020 → 1,668 chars, −66.8% — but that line survives. Q2's
> cross-record half as described therefore cannot be run, and the run that replaced
> it measured what pruning two thirds of the block costs instead: **nothing in
> accuracy (30/30 vs 30/30), −4.78% in tokens.** See
> [`results/2026-09-22-q2-cross-record-pruning.json`](results/2026-09-22-q2-cross-record-pruning.json).
> The same false claim was repeated in
> [`results/2026-09-21-benchmark-trap-calculated-vs-measured.json`](results/2026-09-21-benchmark-trap-calculated-vs-measured.json)
> (`newly_possible`) and in the Q4 results file and PR #44.

~~1. **Q4 first.**~~ **Answered 2026-09-22 — prediction falsified on both limbs.**

**The order for Q7–Q12, added 2026-09-22:**

1. **Q7 first, and before anything is quoted.** It is nearly free — one description edit
   and 20 runs — and it decides how every other result in this file may be worded. If the
   description turns out to be present and read, "weakened" and "forgot" come out of the
   prose and the claim gets stronger, not weaker.
2. **Q10 next.** The highest-value open question now that Q4 has landed: it is the only
   untried mechanism aimed at this repo's most stubborn failure — 2 correct in 21 on
   `overheating`, with both prose and renaming already falsified (Q5, Q6) — and it is
   registered as a null, so a win would be the surprise and a loss retires a fashionable
   primitive before it reaches a guide.
3. **Q8, then Q9's distance half.** Q8 builds the arm that Q9's distance protocol needs,
   so one deploy serves both. Q9's position half (`inline-head`) can ride along with
   anything; it is a one-line arm.
4. **Q11 whenever there is spare batch capacity.** Cheap, and it tests an assertion the
   root `README.md` currently states as fact.
5. **Q12 last, and only if Q7–Q10 hold.** A second domain is the gate on generalising,
   not a way to learn more about this one.

**Standing rules for any run, whatever it is for:**

- **Harder questions before bigger n.** Both `derived_number` questions and now
  `benchmark-trap` are at or near ceiling for the arms that matter (see
  `_measured_ceilings`). More repeats on them measure nothing; the set needs questions
  the top arms can still fail.
- **Re-baseline the ladder.** The 2026-09-21 block change moved six prose arms, so the
  readable-ladder files are stale on any `ep1`/`ep2`/`berekend` question. Anything that
  quotes those numbers needs re-running before it can be quoted again.
- **Record the model-facing request while you are in there.** Q7 aside, every run from
  now on should note whether the description, input schema, output schema and prior tool
  results were present in the post-tool request. Inferring visibility from the protocol
  objects is the error `research-frame.md` exists to prevent.
