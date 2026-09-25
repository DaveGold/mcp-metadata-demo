# Open questions

> ### ⚠️ 2026-09-22 — THE DESCRIPTION CHANNEL WAS TRUNCATED IN EVERY RUN HERE
>
> The host these runs used (Claude Code) sends only the **first 2,048 characters** of each
> MCP tool description. The `words` / `rich` / `words-recipe` descriptions are 6.8–7.4k
> characters, so **70–72% of them, including almost the whole INTERPRETATION block, the
> CALCULATED vs MEASURED line, the overheating threshold and the recipe, never reached the
> model.** In `opaque-words`, 57% was cut, including the `to` threshold and the recipe. Found by Q7; see its banner and
> [`results/2026-09-22-q7-description-truncation.json`](results/2026-09-22-q7-description-truncation.json).
> Every "description vs response" result below compares **delivered with undelivered**
> text. Read each one that way until it is re-run with the sentence inside the cut.
>
> **Re-run 2026-09-23 — Q15 and Q15b.** Delivered in both channels, the same sentence scores
> the same: 20/20 description vs 20/20 response (Q15, line inside the cut), and 20/20 vs
> 20/20 with the cap raised and the whole block uncut (Q15b). Haiku, one question. On this
> evidence the variable is **delivery**, not channel.

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

**Q13 and Q14 are ANSWERED** — registered and run on 2026-09-22, after Q7–Q12 were filed.
Q14's prediction was **confirmed**: one line in the response does what the whole block did.

**Q15 and Q15b are ANSWERED** — registered and run on 2026-09-23, after Q7. All seven of
their predictions were **confirmed**: a description sentence that is DELIVERED is applied
exactly as often as the same sentence in the response. That turns Q1/Q13/Q14's channel
finding into a delivery finding.

**Q8–Q12 were amended on 2026-09-23, before any of them ran.** Each amendment records which
quoted numbers measured undelivered text. **Q10 is suspended**: its premise was absence.
**Q11's main half is answered by accounting**: `outputSchema` never reaches the model on
Claude Code. Q8 runs with the cap raised, and Q12 must deliver its description copy.

Q13 asks whether the ALERTLESS tiers can be fixed at all, and all three of its
predictions were falsified. **Read it together with Q7**: Q13 measured the same
sentence at 0-of-20 use in the description against 20-of-20 in the response, and
Q7 is what decides whether that is *absence* or *presence-and-non-application*.

Read *What the runs support so far* next — it is the synthesis, and it is a narrower
claim than "richer metadata is better" — then *Design guidance*, which turns it into what
to build.

**Q7 is foundational and is not optional.** It asks whether the tool description was even
absent at interpretation time. If it was present, the word "weakened" is wrong everywhere
it appears below, and Q1's result is a stronger claim than the one currently written.
**ANSWERED 2026-09-22: absent, by truncation. See the banner at the top of this file.**
"Weakened" is still wrong everywhere below, but for the opposite reason: nothing weakened.
Past character 2,048 the guidance was never sent. Q1's result is a *different* claim from the
one written, not a stronger one.

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
| Move the same 438 bytes DESCRIPTION → RESPONSE (Q1b) | 0 chars | **4/30 → 29/30**, but the description copy was never delivered (Q7). Delivered in both channels, they tie (Q15/Q15b) |
| Add ONE sentence that was missing (Q2 follow-up) | +682 chars | **0/60 → 59/60** |

Cutting half the prose changed no answer. Adding one *right* sentence changed 59. The
amount of metadata is close to irrelevant; *which* sentence, and *whether it is
delivered*, is nearly everything. (Written as "which channel" until Q15/Q15b showed that
a delivered description sentence scores like the response.)

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

**2. Make sure the guidance is DELIVERED — in the response, or inside the first 2,048
characters of the description.** 29/30 against 4/30 for the same 438 bytes was delivered
against absent (Q7). Delivered in both channels, the same line scores 20/20 either way
(Q15/Q15b). Prefer the response: no host cut-off applies to it, and later edits above it
cannot push it out. Free, and it helped all three models. If you change one thing, change
this one. **Not a guidance call behind a soft pointer** (Q8): sonnet made the no-argument call
10/10, haiku 0/10. **Word the pointer as a requirement, or give the guidance its own tool**
(Q8b): haiku then made it 10/10 both ways, and every caller was correct.

**2b. If a rule needs data the payload lacks, SHIP THE DATA** (Q16). The partial-period rule
alone: haiku 2/20. The same rule plus a server-computed reference-period figure: 15/20.
Handing over the finished factor did not add to that (11/20). Strong models fetch the data
themselves (sonnet 10/10, opus 9/10); weak ones do not.

**2c. Record WHY each rule exists; the form of the source is free** (Q10, Q17, Q18). At
runtime the form did not matter: prose, `relates_to_fields` or a computed trigger scored the
same, and one relevant rule among 100 was found as easily as alone. At design time (Q18) it
did not matter either. The agent in the improvement loop was measured on sonnet and opus,
with 112 rules. It did three things as well from today's prose (99–100%) as from
`{ relates_to_fields, meaning, provenance }` records:
- found the rule a failing trace points at;
- listed the rules a schema change orphans;
- listed the fields with no semantics.

Only **provenance** changed the outcome. Asked whether to delete a rule, agents that had its
recorded eval result cited it 16/16, and mostly decided. Without it they re-derived the
rationale from the rule's text and asked for the test to be re-run. None invented a history.

So keep one provenance line per rule: the date, and the eval result or incident behind it.
Explicit field lists are cheap and still earn their place:
- they are what selective projection needs;
- they carry links the prose leaves implicit. Prose readers called `gebouwklasse` and
  `gebruiksdoel` uncovered 20/20, labelled readers 0/20 (unscored: coverage there is a
  judgment).

They are **not** needed for the agent to navigate a source that fits in one read.
*Untested:* a source too big for one read, haiku, and whether the edits then fix the answer.

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

**5b. Do not rely on an over-limit response to deliver guidance** (Q9). On Claude Code a
result over ~25,000 tokens is replaced by a *"saved to file"* notice.

- **Without file tools** (a subagent, many SDK agents), neither the data nor the guidance
  reaches the model.
- **With Read or jq** it can be recovered. In a manual main-session test (Opus 5.5, n=1), the
  model ran `jq '{summary, interpretation, …}'` on the saved file. It picked up guidance
  placed after 274 records **by its key**, and was faster and cheaper than when the data came
  back inline.

So: keep responses under the limit when the client may lack file tools, and **always put
guidance under a fixed, named key** (e.g. `interpretation`), so a targeted read finds it. Under the limit, distance barely matters: a recipe
fetched once was still applied after ~62k chars of other tool output (haiku, 9–10/10).

**6. Do not spend effort on volume.** Cutting 37–50% of the prose changed zero answers
in 180. And adding it did not hurt: uncut `words` scored 20/20 with the line inside
~37.6k characters of tool definitions (Q15b). It did cost tokens (+23.7%).

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

> **ANSWERED 2026-09-22 — ABSENT, and not for the reason this question imagined.** See
> [`results/2026-09-22-q7-description-truncation.json`](results/2026-09-22-q7-description-truncation.json).
>
> **7a: the tool definitions ARE re-sent on every request** — 1,012 of 1,012 runs on disk
> re-read request 1's whole cached prefix, which starts with the tools. **But what is
> re-sent is the description cut at 2,048 characters.** This host (Claude Code) truncates
> every MCP tool description to its first 2,048 characters and appends `… [truncated]`.
> `words`' description is 6,779 characters and the 1.5 threshold line starts at character
> **6,181**; in `opaque-words` it starts at **3,105**. It never reached the model.
>
> Confirmed three independent ways: the host's own tool listing; an `eval-words` subagent
> on haiku and on sonnet, asked for the last 120 characters of its description, both
> quoting the text ending at exactly character 2,048; and same-session token accounting,
> where `words-recipe`'s appended 438-byte recipe adds **+12 / +24 tokens** — the length
> of `-recipe` in six tool names, and nothing else.
>
> **7b was built, deployed and verified, NOT RUN, and deleted on 2026-09-23** (code in commit 61e3d89). The canary is appended past the
> cut, so it would have scored 0/10 by construction. That result would have looked like
> a falsification and would really have measured the truncation.
>
> **What it changes:** Q1, Q13, Q14 and Q6 compared *delivered* guidance with
> *undelivered* guidance. "Weakened" is wrong. So is "present and ignored". The honest
> statement is that, on this host, text past character 2,048 of a tool description does
> not exist for the model. **The channel question itself is untested**: no run here has
> put the same sentence where both channels deliver it. The question Q7 meant to ask,
> *is a delivered description sentence applied?*, is still open, and needs the sentence
> inside the first 2,048 characters.

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

### AMENDED 2026-09-22 — BEFORE ANY 7b RUN, AND BEFORE 7a IS COMPUTED

> Committed before a canary arm exists, before any 7b subagent is spawned, and before
> the 7a corpus analysis below is run. The prediction above is **not** reopened; this
> fixes what the registration left open. Nothing here may be revised after the answers
> are visible.

#### 7a — it is measurable, and not the way the registration assumed

The harness's `subagent_tokens` is one total per run, so it cannot answer 7a. **But
every subagent transcript on disk records the API's own `usage` for every request** —
`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` — under
`~/.claude/projects/*building-profile*/*/subagents/agent-*.jsonl`, with `agentType`
and `model` in the sibling `.meta.json`. ~1,500 eval runs are on disk, ~230 of them
`eval-words`.

**Disclosure.** That this data exists was found by opening ONE transcript (an
`eval-words` / haiku / `overheating` run: request 1 input 20,997; request 2 cache-read
20,987). Nothing else was inspected before this amendment.

**Why cache reads answer the question.** The Messages API caches by exact prefix, in
the fixed order **tools → system → messages**. A request whose `cache_read_input_tokens`
covers the whole of request 1's input began with request 1's prefix byte for byte —
**including the tool definitions**, which come first. If the definitions were dropped
or changed after request 1, the prefix would break at its very start.

**Method, pinned.**

- One API request = one assistant `message.id`; usage from its final streamed line.
  `total_in = input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
- **Test A — present at the interpretation request.** For every `eval-*` run with ≥2
  requests, whether the request that follows the last `get_building_profile` result has
  `cache_read ≥ total_in(request 1)`. Reported as a fraction per arm and model, with
  the weaker `cache_read > 0` alongside.
- **Test B — 1-call vs 3-call, as registered.** For `eval-words` / haiku, the
  per-request `total_in` and `cache_read` of the shortest and a ≥3-call trajectory, on
  the same question. "Charged per turn" = the request-1 prefix appears in the input of
  every request.
- **Test C — the description is in that prefix at all** (i.e. not deferred behind a
  tool search). Median `total_in(request 1)`, same question and model: `words` above
  `schema` by roughly the description's size; and, after 7b, **`words-canary` above
  `words` by the canary sentence's token count** and nothing else.
- **Falsified, as registered, if** the definitions are absent from requests after the
  first — Test A failing on most runs.
- **Wording, fixed now.** After the first request, the prefix is billed at the
  cache-read rate. "Charged once per session" in the registration means *sent* once;
  a definition that is re-sent and billed at a discount is **present**, and will be
  reported that way.
- **Limit, fixed now.** This is Claude Code's subagent host, reading the API's
  accounting from the client's transcript. It is the host every run in this repo used,
  so it settles Q1/Q13/Q14 as run; it says nothing about other hosts, and it is not a
  capture of the request body.

#### 7b — the three decisions the registration left open

**1. Which question.** `overheating` on **haiku**. Every answer is scored for BOTH the
marker (an instruction in the description, obeyed?) and the 1.5 citation (a domain
sentence in the same description, applied?).

**2. Arms and n.** n=10 per canary arm, **as registered; thresholds unchanged**. The
two bases, `words` and `opaque-words`, run in the **same batch** at n=10 as well —
40 runs, five waves of eight, two per arm per wave. The bases are **not** part of the
prediction. They exist to show the canary changed nothing else. Canary vs base is
reported descriptively, under the directory's noise bar (a gap under 4 runs is noise).
Each canary is compared **only to its own base**, never readable against opaque.

**The model-visible name.** The subagent sees each MCP server's key inside every tool
name (`mcp__<key>__get_building_profile`). A key containing `canary` would put a word
meaning *tripwire* next to an instruction to emit a token. That is an avoidable
confound on exactly the thing being measured. So the **`.mcp.json` keys are neutral —
`eval-words-b` and `eval-opaque-words-b`** — while the variant, function, log and agent
names stay `words-canary` / `opaque-words-canary` (none of those is shown to the
model). The base keys differ from the canary keys by `-b` and nothing else.

**3. What counts as the marker, and where.** The agents must return exactly
`ANSWER:` / `CALLS:` / `TOOLS:` / `PARAMS:`, and the canary says *end your answer with
the marker*. The two instructions compete, so position cannot be what the prediction is
scored on.

- **OBEYED** (the prediction's measure) = the token `D7`, bare or in any bracket pair
  (`⟨D7⟩`, `<D7>`, `[D7]`, `(D7)`), **anywhere** in the subagent's returned text. `D7`
  appears in nothing else the subagent sees — not the question, the agent prompt, the
  payload or the addresses file (checked). A run that *mentions* the marker ("the tool
  asks me to add ⟨D7⟩") also counts: it proves the sentence was read, which is all Q7
  asks.
- **Reported, not thresholded:** EXACT (`⟨D7⟩`) vs VARIANT; and position —
  `END_OF_ANSWER` (last token of the ANSWER line), `IN_ANSWER`, `AFTER_PARAMS` (on or
  after the PARAMS line), `OTHER`. A marker after PARAMS **counts as obeyed**; it is
  the canary winning "end of answer" over the format.
- **Carried or produced?** From the transcript on disk: whether `D7` appears in any
  assistant text *before* the final request. If it only appears in the final message,
  it was produced at the post-tool step. Thinking may not be visible on disk; say so
  where it is not.
- **Confirmed** if OBEYED ≥ 8/10 on **both** canary arms. **Falsified** if ≤ 3/10 on
  **either**. Anything else is partial and is reported as direction only. (The
  registration's "falsified if ≤3 of 10" did not say *on either arm*; this is the
  reading, fixed now.)

**Domain scoring.** CORRECT / CONFIDENTLY_WRONG / OTHER / FABRICATED / CITES_1_5 exactly
as pinned in `results/2026-09-22-q13-overheating-response-channel.json` → `scoring_rule`,
applied to the answer with the marker stripped. `opaque-words` carries the same
threshold ("ABOVE 1.5 = significant overheating risk"), so the same rule applies.

**The awkward outcome, operationalised.** On the same canary arm: OBEYED ≥ 8/10 **and**
CITES_1_5 ≤ 3/10. Reported as a per-run 2×2 (marker × citation) for each canary arm,
whatever the counts.

**Exclusions, fixed now.** A run that never receives a `get_building_profile` result
cannot test an instruction conditional on reporting a record. It is scored `NO_RECORD`,
kept in the file, and dropped from the marker denominator. Not replaced.

**Per run, recorded:** `tool_uses`, `duration_ms`, `subagent_tokens`, ANSWER character
count (with the marker stripped), the markers above, the domain columns, and the
per-request usage from disk.

---

## Q8 — The bootstrap channel: is the boundary the RESPONSE, or just NOT-THE-DESCRIPTION?

> **ANSWERED 2026-09-23 — the channel works if it is CALLED, and only sonnet called it.**
> See [`results/2026-09-23-q8-guidance-call.json`](results/2026-09-23-q8-guidance-call.json). 60 runs, haiku + sonnet, n=10
> per cell, `gas-estimate`, cap raised so the description arm delivers. Audit exact, 80/80.
>
> | arm | recipe arrives via | haiku route-correct | sonnet route-correct | made the no-arg call |
> |---|---|---|---|---|
> | `words-recipe` | description (uncut) | 7/10 | 10/10 | — |
> | **`guidance-recipe`** | **no-argument call** | **0/10** | **10/10** | **haiku 0/10 · sonnet 10/10** |
> | `inline-recipe` | response | 6/10 | 10/10 | — |
>
> **The prediction is NOT CONFIRMED, and is recorded as falsified.** `guidance-recipe` scored
> 10/20 route-correct (15/20 by value). The registration's thresholds are out of 30, but its
> own design gives 20 per arm (2 models × n=10). The build notes missed that. On the letter,
> 10 ≤ 10 falsifies; scaled to 20 (≥ 17 / ≤ 6), it is partial. Both readings are in the file.
>
> **But the falsifier's stated meaning does not hold.** It said a low score would mean
> *"proximity to the data is what matters"*. Sonnet made the call first in 10/10 runs and was
> then 10/10, the same as the response and description arms. The recipe did not need to
> travel with the record; it needed to be **fetched**. Haiku went straight to the lookup
> every time, never saw the recipe, and improvised: invented efficiencies, the 41 m² BAG
> area, one ep2 road. It scored 0/10 route-correct.
>
> Two further readings off the same run. **Given the recipe, the channel does not matter**:
> `words-recipe` 17/20 and `inline-recipe` 17/20 by value, the third tie after Q15/Q15b.
> And a guidance call is **not safe as the only carrier** of anything a weak model needs.
> That is exactly the exposure of the shipped `start_duurzaam` pattern.

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

### AMENDED 2026-09-23 — after Q7, Q15 and Q15b, BEFORE ANY RUN

> The prediction above is **not** reopened. This amendment records which numbers the
> registration leans on that measured undelivered text, and fixes the decisions that
> changes, before any arm is built or any run is spawned.

**What the registration leaned on.** `words-recipe`'s **4/30** is the description arm, and
its recipe sits at **char 6,781**, past the cut. It never reached the model (Q7). The
reasoning bet that *"what separates 4/30 from 29/30 is not availability but the role"*.
Q7 says it was availability, and Q15 says a delivered description sentence is applied as
often as a response one. So the "role" story is already under pressure before Q8 runs.

**Decisions, fixed now.**

- **Run Q8 in a session started with `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`.**
  Otherwise the description arm measures truncation again. Under the raised cap
  `words-recipe` delivers its recipe. `guidance-recipe` and `inline-recipe` carry minimal
  descriptions, so the cap changes nothing for them. The volume confound is the one Q15b
  measured (it did not fire).
- **Verify delivery host-side before any run**, as in Q15b: no `[truncated]` in
  `words-recipe`'s listing, and the recipe present.
- **The registered thresholds stand**: `guidance-recipe` ≥ 25/30 confirms, ≤ 10/30
  falsifies. The contrast "lands with the response arm, not the description arm" can no
  longer be read off `words-recipe`'s old 4/30. The same-batch `words-recipe` cell is now
  reported descriptively. After Q15, the expected picture is all three arms high, which
  would say the guidance call works because it delivers, not because of its role.
- **Unchanged and still the sharpest part:** whether the model makes the parameterless
  call unprompted. No cap touches that.

---

### BUILD NOTES, fixed 2026-09-23 — after the arm was built, BEFORE ANY RUN

**The arm as built** (`src/tools/get-building-profile-guidance.ts`, pinned by 7 tests):

- **No-argument call → `{ "guidance": derivedFiguresBlock }`.** These are the same imported bytes
  `words-recipe` appends to its description and `inline-recipe` appends to its response.
- **Lookup → the profile with no prose**, field for field identical to `schema`'s response.
- **Description = `schema`'s one-liner + one pointer sentence:** *"Call it once with no
  arguments first: that returns how to derive figures from the lookup result."* The
  registration said "minimal" and was silent on discovery. Without a pointer the call
  cannot be found, and the unprompted-call metric would be zero by construction.
  `start_duurzaam` carries the same kind of pointer. The pointer names the call, and
  contains no word of the recipe.
- **`postcode` and `huisnummer` are optional** in this arm's input schema, which is its
  one schema difference.
- **Everything else is `inline-recipe`'s:** the same bare instructions and the same minimal
  render/weather/log tools.
- **Model-visible names avoid "guidance".** The `.mcp.json` key is `eval-g-recipe` and
  the server name is `metadata-demo-g-recipe`, as Q7 kept `canary` out of its keys. The
  variant, function (`mcpGuidanceRecipe`) and agent (`eval-guidance-recipe`) names are not
  shown to the model.

**An asymmetry, stated up front.** `words-recipe` and `inline-recipe` deliver the recipe
**together with** the 5,020-char INTERPRETATION block (in the description and in the
response respectively). `guidance-recipe` delivers the recipe **alone**. The guide
ablation found the recipe is what produces the answer on `gas-estimate`, so this is not
expected to matter. It is a second difference, though, and is reported as one.

**The run, fixed now.**

- **Models: haiku and sonnet** (the registration said "2 models" without naming them).
  n=10 per arm per model, **60 runs**, one sitting. Waves of 6 are interleaved across the
  3 arms × 2 models, so ten waves in all.
- **Session:** every wave in a fresh headless session started with
  `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`, per the amendment above. Only the
  `question` string is passed.
- **Preflight:**
  - host listing shows `words-recipe` uncut, with the recipe present;
  - `guidance-recipe`'s listing is the one-liner plus pointer;
  - one live no-argument call and one live lookup on `guidance-recipe`;
  - one live lookup on each of the other two arms;
  - `countByVariant` unfiltered, with `guidance-recipe` stamped under its own name.

**Scoring, fixed now.** As `gas-estimate` and `_scoring` pin it: **correct** = within 253 ± 8
m³/year (range → midpoint); **declined** in its own column; **confidently_wrong** = the
headline exceeds ~2× ground truth, or asserts kWh as a gas volume (Q1's precedent);
**fabricated** = a constant not in the payload *or the recipe*. **Route is mandatory**: `wb`
(warmtebehoefte 52.73 × 40.02 m² thermal zone ÷ 0.95 ÷ 8.79) vs `ep2`, plus the
disqualifying steps in `_scoring.route`. The headline number is **route-correct**, reported
beside value-correct.

**The unprompted-call metric, fixed now.**

- **MADE_GUIDANCE_CALL** = the run's transcript shows a `get_building_profile` call with no
  `postcode` and no `huisnummer`, cross-checked against the log (rowCount 0, no address in
  `queryIntent`).
- **Also reported:** whether that call came BEFORE the first lookup, and whether a run that
  skipped it still got the answer.
- **The registered ≥ 25/30 threshold counts every `guidance-recipe` run**, called or not,
  because "the channel is worthless if it is not called" is part of what it tests.

**Record per run:** `tool_uses`, `duration_ms`, `subagent_tokens`, ANSWER chars, request-1
input.

---

### Q8b — Can haiku be made to make the call? Registered 2026-09-23, BEFORE either arm exists

> **ANSWERED 2026-09-23 — YES, by wording alone. All three predictions CONFIRMED.** See
> [`results/2026-09-23-q8b-guidance-discovery.json`](results/2026-09-23-q8b-guidance-discovery.json). haiku, n=10 per arm, one batch. Audit exact, 52/52.
> Both Q8b arms were deleted afterwards: `mcpGuidanceTool` after Q8b, and `mcpGuidanceStrong` after Q9 used it (2026-09-23). Code is in git history.
>
> | arm | pointer | made the call | route-correct | fabricated |
> |---|---|---|---|---|
> | `guidance-recipe` | soft (Q8's) | **0/10** | 0/10 | 8/10 |
> | **`guidance-strong`** | **REQUIRED + consequence** | **10/10**, first | **10/10** | 0 |
> | **`guidance-tool`** | **its own tool** | **10/10**, first | **10/10** | 0 |
>
> **P1, P2 and P3 all CONFIRMED.** All 20 runs that made the call were route-correct; none of
> the 10 that skipped it were. The extra round trip cost 0.1–0.5% tokens. **Q8's haiku failure
> was the pointer, not the model.** It also resolves the puzzle above. The canary and the strong
> pointer are explicit imperatives, while the soft pointer (*"first: that returns …"*) reads as
> information. Haiku obeys delivered instructions when they are worded as instructions.

Q8 found the guidance channel works only when the model calls it: sonnet called it 10/10,
haiku 0/10. The pointer haiku ignored was one soft sentence: *"Call it once with no arguments
first: that returns how to derive figures from the lookup result."* This follow-up asks
whether that is a wording problem or a property of haiku. It is the question the shipped
`start_duurzaam` pattern turns on.

**The puzzle it has to explain.** Q15's canary was also an instruction in a delivered
description (*"end your answer with the marker ⟨D7⟩"*), and haiku obeyed it 20/20. The Q8
pointer is an instruction in a delivered description, and haiku obeyed it 0/10. The
difference may be what is asked: an output-format instruction applied at answer time,
against an extra action required *before* the call the model already wants to make.

**Arms** (haiku, `gas-estimate`, n=10 each, one batch, cap raised as in Q8):

| arm | how the guidance is reached | pointer |
|---|---|---|
| `guidance-recipe` | no-argument call of `get_building_profile` (Q8, unchanged) | soft: Q8's sentence |
| **`guidance-strong`** | the same no-argument call | **imperative, with a consequence:** *"REQUIRED: before any lookup, call this tool once with no arguments. That returns how to derive figures from the lookup result; do not derive figures without it."* |
| **`guidance-tool`** | a **separate** parameterless tool, `get_derivation_guide`, as `start_duurzaam` is | `get_building_profile`'s description: *"Call get_derivation_guide first: it returns how to derive figures from this tool's result."* The guide tool's own description says to call it before `get_building_profile`. |

The guidance bytes are `derivedFiguresBlock` in all three. The only thing that varies is how the
call is pointed to. `guidance-tool`'s `get_building_profile` takes the normal required
address. Model-visible keys and server names avoid the word "guidance". The separate tool's
own name cannot, because the tool name *is* the pattern.

**Prediction.**

> **Wording fixes it. A stronger pointer, or a tool of its own, gets haiku to make the call.**
>
> - **P1: `guidance-strong` — haiku makes the call in ≥ 7/10.** Falsified if ≤ 3/10.
> - **P2: `guidance-tool` — haiku makes the call in ≥ 7/10.** Falsified if ≤ 3/10.
> - **P3 (sanity): a run that makes the call is route-correct in ≥ 80% of such runs**, pooled
>   across arms. The Q8 result says fetching was the whole problem, and this checks it.
> - The `guidance-recipe` baseline is not a prediction. Q8 measured it at 0/10; ≤ 2/10 is
>   expected, and anything above 4 is reported as a sitting effect.
>
> **Reasoning.** Haiku obeyed a delivered instruction 20/20 in Q15, so the channel carries
> instructions. The Q8 pointer was soft ("first"), gave no consequence, and competed with a
> required-looking address schema. An explicit REQUIRED plus a reason, or a separate tool
> whose only purpose is the guide, removes both.
>
> **The case against.** Haiku may treat any extra pre-lookup step as optional however it is
> worded. If so, both P1 and P2 fail, and a bootstrap channel is unusable on the weakest
> model whatever the pointer says. That would be the stronger design finding.

**Scoring.** As Q8's build notes: MADE_GUIDANCE_CALL from the transcript, cross-checked in the
log, with before/after lookup recorded; value- and route-correct on `gas-estimate` exactly
as in Q8. **Cost:** 30 runs, two new arms, one deploy.

## Q9 — Position inside the response, and distance across turns

> **ANSWERED 2026-09-23 — distance is FLAT (prediction falsified); position NOT MEASURED AT
> SCALE.** See [`results/2026-09-23-q9-position-distance.json`](results/2026-09-23-q9-position-distance.json). haiku. Audits exact (38/38, 101/101).
> `inline-head` was deleted afterwards (`mcpInlineHead`, 2026-09-23; code in git history).
>
> **Position half RETIRED 2026-09-23 as not worth running on this host.** Three reasons:
> - **Models keep responses small unaided.** All 20 runs chose `summaryOnly`. Forcing large
>   responses needs a protocol instruction, and this question's first distance run showed
>   such instructions change behaviour on their own.
> - **The window where position could matter is narrow:** large enough to have distance,
>   but under the ~25k-token output limit, past which the response is replaced.
> - **Distance across turns, the larger perturbation, was flat.**
>
> The prediction's position half stays unscored.
>
> **Distance** (`guidance-strong`, `gas-estimate`, n=10 per distance, redesigned run):
>
> | intervening quarterly weather calls | route-correct |
> |---|---|
> | 0 | 10/10 |
> | 1 (~21k chars) | 10/10 |
> | 3 (~62k chars) | 9/10 |
>
> Actual distance: 5 of the 6 runs that really had ~62k chars between the guidance and the
> lookup were correct. The registered **≥ 5 lost** did not happen: one was lost, within the
> "flat" band fixed before the run, so the prediction is **FALSIFIED**. The registration's own
> reading of a flat curve applies: *guidance delivered once per session is safe*, here for
> haiku up to ~15k tokens of intervening, irrelevant tool output.
>
> **Position** (`inline-head` vs `inline`, `weather-partial-normalization`): every one of the 20
> runs asked for `summaryOnly` (~1.2k-char responses), so there was nothing for the block to
> sit before or after. By the rule fixed before the run, it is **not measured at scale**
> (10/10 vs 9/10 as numbers).
>
> **Host finding from the void first distance run:** a 79k-char result was **replaced** by a
> 1.7k *"saved to file"* notice (the 25,000-token MCP output limit). For these subagents,
> which had no file-reading tool, the guidance inside the response never arrived, whether
> it sat first or last. An agent that can read the file might recover it; that is
> unmeasured. This is the response-side twin of Q7's 2,048-char description cut.

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

### AMENDED 2026-09-23 — after Q7, Q15 and Q15b, BEFORE ANY RUN

> The prediction above is **not** reopened. This amendment records which numbers the
> registration leans on that measured undelivered text, and fixes the decisions that
> changes, before any arm is built or any run is spawned.

**Mostly unaffected.** Both halves are response-channel and guidance-call designs. No
host description cap touches a tool result.

- **The weather question already delivers its rule in the response.** On
  `weather-partial-normalization` the HDD-ratio rule's description copy sits at
  **char ~4,048** of `get_weather_context`, past the cut. But the same rule also fires as a
  computed `interpretation.alerts` line for every partial-period query, on every arm.
  So the question never depended on the description, and no description-channel
  comparison is available on it at the default cap. None is needed.
- **The threshold revision the previous amendment deferred is resolved: no change.** The
  metric is runs out of n, which does not depend on response size. Position: `inline-head`
  within 2 of `inline` confirms, ≥ 3 apart falsifies. Distance: ≥ 5 lost between 0 and 3
  intervening calls. n=10 per cell as registered.
- **One more volume data point, for the reasoning only:** Q15b put the threshold line
  inside ~37.6k characters of delivered tool definitions and it still scored 20/20. It
  changes no threshold.
- The distance half still needs Q8's arm, which should be deployed first.

---

### BUILD NOTES, fixed 2026-09-23 — after the arms were built, BEFORE ANY RUN

**Model: haiku** for both halves (the registration says "1 model"). It is the model most
exposed to both effects, and after Q8b it reliably makes the guidance call.

**Position half — `inline-head` vs `inline`, `weather-partial-normalization`, n=10 each.**

- **`inline-head`** is `inline` byte for byte (tools/list, instructions, server name, payload
  content), except `interpretation` is emitted as the **first** JSON key of both the building
  and the weather response instead of the last. Four tests pin this, and the weather order
  is checked on the wire.
- **The guidance the question needs reaches both arms only through the response.** The
  weather description is the 87-char minimal one. The HDD-ratio rule and the
  `gasNormalizationFactor` warning arrive as computed `interpretation.alerts` lines for any
  partial-period query.
- **The distance risk, stated before the run.** The question needs two quarterly calls. The
  model chooses the payload: `summaryOnly` gives ~1.3k chars with nothing to sit "before",
  full records give ~90 daily rows (~18k chars). So position can only matter in runs that
  fetch records. Response size and `summaryOnly`/`select` are recorded per call. The position
  effect is reported overall and for record-fetching runs. **If fewer than 5 runs per arm
  fetch records, the position half is reported as *not measured at scale*.**
- **Scoring:** as the question pins it. Correct = 4,434 ± 60 m³ (the plain-HDD road, ~4,451,
  is also inside). Route is mandatory: weightedHDD / HDD / gasNormalizationFactor / none, and
  a gasNormalizationFactor answer (~10,626) is confidently wrong. Fabrication per its watch.
- **Thresholds as registered:** within 2 of 10 confirms, ≥ 3 apart falsifies.

**Distance half — `guidance-strong`, `gas-estimate`, n=10 per distance, d ∈ {0, 1, 3}.**

- **d=0** is the plain `eval-guidance-strong` agent (Q8b: 10/10 called, 10/10 correct).
  **d=1 / d=3** are the same agent plus ONE protocol paragraph: after the first tool call,
  call `get_weather_context` exactly N times for Amsterdam, full year 2024, no other
  arguments. Each such response is ~73k chars (~18k tokens) of daily records. So the recipe
  from the guidance call sits ~18k or ~55k tokens before the lookup it must be applied to.
- **Confound, stated:** d=1/d=3 have a longer system prompt than d=0. A d=0 agent with a
  zero-call protocol sentence would be stranger, not cleaner.
- **Order is recorded, not assumed.** If a run does not make the guidance call first, or
  makes a different number of weather calls, it is scored on its ACTUAL distance and flagged.
- **Scoring as Q8.** Registered: "≥ 5 lost between 0 and 3" confirms. **"Flat", left
  undefined at registration, is fixed now: falsified if d=3 is within 2 of d=0.** A loss of
  3–4 is partial.
- The session cap is left at the default: every arm here carries minimal descriptions.

**Cost:** 20 + 30 = 50 runs. One new arm (`mcpInlineHead`), two agent files.

### AMENDED 2026-09-23 — the first distance run was VOID; a redesign, fixed BEFORE it runs

The first distance run (30 runs, 15:19–15:25Z) measured nothing about distance. It is kept
and reported in the results file, and is not scored against the prediction. Three instrument
failures, all found in the transcripts:

1. **The host does not deliver a large tool result.** A full-year `get_weather_context`
   response is 79,182 chars. Claude Code replaced every one with a **1,713-char notice**:
   *"result … exceeds maximum allowed tokens. Output has been saved to …/tool-results/….txt"*.
   The subagent has no file-reading tool. So the records, and the `interpretation` inside
   them, never reached the model, and the "~18k tokens of distance" never existed. This is
   the documented 25,000-token MCP output limit, observed as replacement rather than
   truncation. **It is also a finding in its own right:** on this host, guidance inside an
   over-limit response is not delivered at all, whether it sits first or last.
2. **The protocol paragraph displaced the guidance call.** *"After your FIRST tool call …
   call get_weather_context"* made haiku do the lookup first. Among runs that got a
   profile, guidance-first was 8/8 at d=0 (no paragraph) but 2/10 at d=1 and 2/10 at d=3.
   The run measured instruction competition, not retention.
3. **The server's own rate limiter** (30 requests / minute per IP + user agent per instance)
   returned *"Too many requests"* in wave 2. Runs with no profile result are NO_RECORD.

**The redesign, fixed now.**

- **Distance is made of responses the host delivers.** Each intervening call fetches one
  QUARTER of 2024 with full records (~30k chars, ~8–10k tokens, under the cap). d=1 is
  Q2 2024; d=3 is Q2, Q3 and Q4 2024. So the recipe sits ~0, ~9k or ~28k tokens before the
  lookup. The preflight checks, from a subagent transcript, that a quarterly result arrives
  inline and is not replaced.
- **The same protocol paragraph at every distance, including d=0**, and it fixes the order:
  (1) `get_building_profile` with no arguments; (2) the listed weather calls (none at d=0);
  (3) carry on answering. The guidance call is now protocol-prompted. That is right for this
  half, which tests retention after delivery, not discovery (Q8b measured discovery). It
  also removes the prompt-length confound the build notes disclosed.
- **Waves of 3** (one per distance), ten waves, to stay under the rate limit. A run with no
  profile result is NO_RECORD, kept, and dropped from its denominator. It is not replaced.
- **The prediction and thresholds are unchanged:** ≥ 5 lost between d=0 and d=3 confirms,
  and d=3 within 2 of d=0 falsifies. Scoring as Q8. Runs that do not follow the protocol
  order are scored on their actual distance and flagged.
- **Position half, recorded as run:** all 20 runs used `summaryOnly` (~1.2k-char responses),
  so it is *not measured at scale*, per the build notes. It is not re-run here. Forcing record
  fetches would need a protocol too, and finding 1 caps the testable window at ~25k tokens.

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

### AMENDED 2026-09-23 — after Q7, Q15 and Q15b, BEFORE ANY RUN

> The prediction above is **not** reopened. This amendment records which numbers the
> registration leans on that measured undelivered text, and fixes the decisions that
> changes, before any arm is built or any run is spawned.

**The premise is void.** The registration's case rests on *"the threshold sentence is
present in every prose arm, adjacent to the value, and every prose arm ignores it"*, and
on Q6's 0/7. On this host that sentence was **never delivered** to any of those arms:
`words` at char 6,181, `opaque-words`' `to` line at 3,105, and `rich` before the computed
alert. *"In `words` it reaches the right field and then overrides the stated threshold"*
is wrong: nothing was stated to it. Once the sentence is delivered, `overheating` is
**20/20** on haiku through every channel tried: `inline` (Q13), `inline-oneline` (Q14),
`words-front` (Q15) and uncut `words` (Q15b). "2 correct in 21" was absence, not disbelief.

**Consequence: the registered falsifier is void by construction**, the same failure as
7b. `inline-addressed` carries the same sentence in the response, so it would almost
certainly score ~10/10 on `overheating`. That would trip "falsified if ≥ 7/10" for a
reason that has nothing to do with structure: `inline`, with the same prose and no
structure, is already 20/20. The other two questions are no better. `benchmark-trap` is
at 59/60 for the response arms, and `gas-estimate` is at ceiling on the recipe arms.

**Decision, fixed now: Q10 is SUSPENDED, not run and not built.** `relates_to_fields` can
only be tested on a question where a response-channel arm that *delivers* the sentence
still fails, and the set has none. The prediction stays as registered. Its status is
*untestable on the current set*, not confirmed and not falsified. Q10 comes out of first
place in *Suggested order* below.

---

### REOPENED 2026-09-23 — two questions with headroom exist now. Registered BEFORE any arm is built

> **RUN 2026-09-23 — structure is not a lever for haiku.** See [`results/2026-09-23-q10-addressed-semantics.json`](results/2026-09-23-q10-addressed-semantics.json). 120 runs,
> haiku, n=20 per arm per question, all in the response. Audit exact, 170/170.
>
> | question | prose | addressed | addressed + triggered |
> |---|---|---|---|
> | `weather-single-quarter` | 1/20 | 0/20 | 1/20 |
> | `total-vs-per-m2` | 11/20 | 14/20 | 14/20 |
>
> - **P1 (addressing alone does nothing): CONFIRMED.**
> - **P2 (activation fixes the weather rule): FALSIFIED.** The trigger said, computed for this
>   record, *"requested period is 91 days … not a full calendar year"*. haiku multiplied by 2.53
>   anyway, in 14 of 20 runs.
> - **P3 (activation helps the area rule, ≥ +4): PARTIAL.** It moved +3, inside the noise bar.
>
> For haiku on this rule, no FORM (here) and no CHANNEL (Q12) of guidance works. The levers
> left are computation, which the alerts showed, and an imperative instruction to *do*
> something, which Q8b showed.

Q10 was suspended because every known question had response-channel prose at ceiling.
Two now have room, and in both the sentence **is delivered in the response and still
not applied**:

- **`weather-single-quarter`:** haiku scored 0/10 with the partial-period rule in the response
  (Q12). It kept multiplying by `gasNormalizationFactor`.
- **`total-vs-per-m2`:** haiku scored 5/10 on `inline` (Q1). The sentence that settles it,
  *"gebruiksoppervlakte_thermische_zone_m2 … vs oppervlakte_m2 (BAG): two different scopes …
  Use the EP-Online area as the denominator for every per-m² NTA value"*, sliced from
  `interpretationBlock`, is in that response.

That is exactly the case Q10 asks about: delivery equal, only the FORM differs. Three arms,
all putting ONE sentence in the RESPONSE, byte-identical (the partial-period RULE on
weather; the scopes line on buildings):

| arm | the sentence ships as | key |
|---|---|---|
| `q10-prose` | a plain string | `eval-q10a` |
| `q10-addressed` | `{ relates_to_fields: [...], meaning: <sentence> }` | `eval-q10b` |
| `q10-triggered` | the same, plus `triggered_by`: a server-computed line naming the value in THIS record that makes the rule apply (*"requested period is 91 days, not a full calendar year"*; *"oppervlakte_m2 = 100 and gebruiksoppervlakte_thermische_zone_m2 = 92 differ"*) | `eval-q10c` |

- `prose → addressed` measures **addressability** alone.
- `addressed → triggered` measures **activation** (the server saying *why now*).
- Descriptions are `schema`'s one-liners, and the weather Note clause is stripped, as in Q12.
- **Run:** haiku, both questions, **n=20 per arm per question**, 120 runs, default cap.
- **Headroom gate per question:** the comparison is scored only if `q10-prose` ≤ 14/20.

**Prediction (supersedes the suspended one for these two questions; the original stays on
record):**

> - **P1: addressing alone does nothing.** `q10-addressed` is within 3 of `q10-prose` on both
>   questions. Falsified if it leads by ≥ 6 on either.
> - **P2: activation fixes the weather rule.** `q10-triggered` ≥ `q10-prose` + 6 on
>   `weather-single-quarter`. Falsified if the lead is < 3.
> - **P3: activation helps the area rule.** `q10-triggered` ≥ `q10-prose` + 4 on
>   `total-vs-per-m2`. Falsified if the lead is < 2.
>
> **Reasoning.** An explicit field edge answers *which field does this rule explain*. In
> both failures haiku already has the right field; it does not see that the rule applies
> *now*. A server-computed trigger says so in terms of the record in hand.

**Scoring:**
- `weather-single-quarter`: its `_judge_note`, as in Q12.
- `total-vs-per-m2`: 2,630 ± 60 kg led with, route recorded, as in RB1.

## Q11 — Does `outputSchema` reach the model at all?

> **ANSWERED 2026-09-23 — no, and the rest of the question falls out differently than
> registered.** Main half, by accounting: `outputSchema` is not in the model-facing request
> on Claude Code (see the amendment). The remaining halves ran as 110 runs, haiku + sonnet,
> cap raised. See [`results/2026-09-23-q11-select.json`](results/2026-09-23-q11-select.json).
>
> - **Names (`select-blind`) — FALSIFIED by the letter.** sonnet sent the exact
>   `{date, weatherLabel, tempMax}` 8/10 times blind, and recovered in the other 2. But it
>   took the names from the question's own words (*"the weather label"*, *"the maximum
>   temperature"*), not from `outputSchema`. haiku managed 2/10 and never recovered. 5 of
>   its 8 misses told the user, falsely, that the API lacks the field. None presented the
>   gap as complete, so the "report without noticing" sub-prediction is false too.
> - **`select-wrong-degree-day` — FALSIFIED.** Uncut `words` scored 20/20 and even `thin`
>   18/20; everyone picked `weightedHdd`. The semantics changed the *explanation*:
>   `thin`/sonnet invented a weighting rationale in 8/10 runs; `words`/sonnet gave the real
>   factors every time.
> - **`select-hides-the-evidence` — PARTIAL.** `words`/haiku 6/10, `words`/sonnet 0/10, and no
>   arm reached 8. The registered mechanism, a silent `tempMean` projection, never happened
>   (0/40). sonnet selected the right fields 20/20 and still misread boundary values (14.1 °C,
>   20.5 °C) every time. Prose made no difference (`words` ≈ `thin`).
>
> Recorded as wrong: **nine of fourteen** registered predictions now wrong.
>
> `select-blind` was deleted afterwards (`mcpSelectBlind`, 2026-09-23; code in git history).

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

### AMENDED 2026-09-23 — after Q7, Q15 and Q15b, BEFORE ANY RUN

> The prediction above is **not** reopened. This amendment records which numbers the
> registration leans on that measured undelivered text, and fixes the decisions that
> changes, before any arm is built or any run is spawned.

**The main half is answered on this host by accounting, and running it would measure
absence.** This was checked before any Q11 arm exists. The request-1 input on disk for
`eval-thin` against `eval-schema` answers it. The two arms have byte-identical
descriptions (276 chars in total). Their `outputSchema`s differ by **7,659 characters**
(8,706 vs 16,365 as JSON), and their input schemas by 486. Median request-1 input:

| model | `thin` | `schema` | Δ tokens |
|---|---|---|---|
| haiku | 17,271 (n=45) | 17,452 (n=36) | **+181** |
| sonnet | 22,297 (n=28) | 22,633 (n=56) | **+336** |
| opus | 22,270 (n=29) | 22,491 (n=36) | **+221** |

7,659 characters of JSON would be well over 1,500 tokens. The observed +181 to +336 is
about the size of the input-schema difference alone. So **`outputSchema` is not in the
model-facing request on Claude Code.** That fits the Messages API tool format, which has
no output-schema field. The root README's *"the model never sees this"* is therefore
**measured true for this host**. Other hosts are not measured. Limit: medians pool
sessions, so this is accounting evidence, not a capture of the request body.

**Decisions, fixed now.**

- **`schema-semantic` is not built for Claude Code.** Its prediction ("behaves like
  `thin`") would hold by construction, as 7b would have failed by construction. Q11's main
  half is recorded as *answered by accounting on this host*. The registered run is void
  here and would only mean something on a host that forwards `outputSchema`.
- **The falsifier's comparator was also invalid:** *"within 3 of `words`"* compares with
  `words` numbers measured on a cut description.
- **`select-blind` stays, and must be built off `minimal`, not off a prose arm.** Input
  schemas are sent. The `select` field list is 430 characters, far under any cut. But the
  delivered first 2,048 characters of the full weather description already name
  `weatherLabel` (char 296), `tempMax` (1,018), `tempMin` (1,475) and `weightedHdd` (237).
  A prose arm with the input list removed is not blind. With `outputSchema` shown absent,
  the registered falsifier ("≥ 8/10 valid names means `outputSchema` reaches the model")
  can only fire if names leak from somewhere else, and that is what would be reported.
- **The meanings half: check each sentence's position before scoring.** Delivered in the
  prose description: the fighting-system rule (char ~1,441) and the `weightedHdd` name
  (237). Past the cut: the seasonal-weight convention (×1.1, char ~4,531). A prose arm's
  `select-wrong-degree-day` result must be read with the convention absent, unless run
  with the cap raised.

---

### BUILD NOTES, fixed 2026-09-23 — BEFORE the select-blind arm is built and before any run

**Names half: `select-blind`.** It is the `thin` (minimal) arm byte for byte, except that the
`select` input description loses its field list. It keeps *"Return only these fields per
daily record — a token saver …"* and drops *"Fields: date, tempMean, … isForecast."* With
`outputSchema` shown absent on this host (the amendment above), the model then has **no
delivered source for the names** before its first weather response. The model-visible key is
`eval-thin-s` and the server name is `thin`'s, so nothing says "blind". One field name does leak on every arm: the shared `dateTo` description mentions
`isForecast`. The question does not need that field, and `weatherLabel` and `tempMax` are named nowhere the model is shown.

- **Question `select-blind`, haiku and sonnet, n=10 each**, plus **`thin` on haiku, n=10**, as
  the control with the list present. That is 30 runs.
- **Scored per run:**
  - **VALID_SELECT**: the first `select` array sent is exactly {date, weatherLabel, tempMax},
    in any order. This is the registered measure.
  - the names actually guessed;
  - whether the response was the silent partial case (≥ 1 valid name, so no list of valid
    fields comes back);
  - **SAFE_BUT_EXPENSIVE**: a re-query that recovered;
  - whether the final answer presents a projection missing the requested fields as complete.
    That is the registered "report the empty projection without noticing the alert".
- Registered: ≤ 3/10 valid, and of the rest ≥ half report without noticing. Falsified if
  ≥ 8/10 valid.
- **A host interaction to watch:** a full-year response with no `select` is ~79k chars, and
  on this host it is replaced by a file notice (Q9). So "call once without select to learn
  the names" fails on this question. That is recorded, not designed around.

**Meanings half: `words` vs `thin`, on `select-hides-the-evidence` and
`select-wrong-degree-day`, haiku and sonnet, n=10 per cell, 80 runs.**

- **The cap is RAISED** (`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`). The registered
  falsifier needs *"an arm whose description carries the semantics"*. At the default cap,
  `words`' weather description delivers the fighting-system hint (*"check daily
  tempMin/tempMax"*, char ~1,441) but NOT the `weightedHdd` seasonal-weight convention
  (×1.1 / 1.0 / 0.8, char ~4,531). Uncut, it carries both. `thin` is unaffected by the cap.
  The whole Q11 batch runs under the raised cap for uniformity.
- **select-hides-the-evidence:** CORRECT = exactly the 11 dates. **PARTIAL (alert only)** =
  the alert's count or its five named dates without the rest. WRONG = anything else. Route =
  the exact `select` array (tempMin+tempMax / tempMean / none). Registered: ≤ 4/10 on the prose
  arm, with silent failures.
- **select-wrong-degree-day:** CORRECT = a weightedHdd series summing to 1,106.3 ± 1. Route =
  weightedHdd / hdd / both. Registered: ≤ 5/10, with hdd chosen in most misses.
- **Falsified if either question clears 8/10 on uncut `words`.**
- Waves of 8, one question per wave, five waves per question. NO_RECORD as in Q9.

**Cost:** 110 runs, one new arm.

## Q12 — A second domain

> **RUN 2026-09-23 (weather amendment) — NO HEADROOM, NOT SCORED.** See
> [`results/2026-09-23-q12-weather-replication.json`](results/2026-09-23-q12-weather-replication.json). 60 runs, haiku + sonnet, n=10 per cell. Audit exact,
> 126/126. The weather tool's own partial-period rule was placed in the description
> (`wx-desc`) or the response (`wx-resp`), with a no-rule control (`wx-none`): **18/20, 19/20,
> 19/20.** Both channels tie, but the control is at ceiling. Asked to compare two quarters,
> both models compare their degree-days without being told, and only 1 run in 60 took the
> `gasNormalizationFactor` road. The question does not need the rule, so where it sits
> cannot matter. As the amendment fixed before the run, the run measured nothing, and it is
> not counted in the ledger.
>
> **Re-run with headroom (amendment 3), 2026-09-23: SCORED, and FALSIFIED as recorded in
> advance.** See [`results/2026-09-23-q12b-weather-single-quarter.json`](results/2026-09-23-q12b-weather-single-quarter.json). The question was `weather-single-quarter`:
> normalise ONE quarter to an average year. 60 runs, haiku + sonnet, n=10.
>
> | arm | haiku | sonnet | total | factor road (≈10,600 m³) |
> |---|---|---|---|---|
> | `wx-none` | 0/10 | 3/10 | **3/20** | 16/20 |
> | `wx-desc` | 0/10 | **10/10** | **10/20** | 6/20 |
> | `wx-resp` | 0/10 | **10/10** | **10/20** | 7/20 |
>
> - **The headroom gate passed:** `wx-none` scored 3/20, under the fixed ≤ 14/20.
> - **Description and response tie exactly.** The rule, byte-identical in either channel,
>   takes sonnet from 3/10 to 10/10, and every sonnet run then built a reference quarter from
>   4–11 prior years. That is Q15's delivery-not-channel result, reproduced in a second data
>   domain.
> - **haiku scores 0/10 in every arm.** With the rule delivered it still multiplies by 2.53
>   (6–7/10), or invents a reference. The overheating line tells haiku how to *read* a value
>   it already has, and haiku used it 20/20. This rule tells it to *go fetch* data it does
>   not have, and haiku skips that step, as it skipped Q8's soft-pointer call. That account
>   is a hypothesis, not tested.
> - **The gate itself, a second server and author, stays open.** This is a second public
>   data domain only.
>
> Ledger: **ten of fifteen** registered predictions wrong.
>
> The three `wx-*` arms were deleted after the opus run and the manual test (2026-09-23; code in git history).

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

### AMENDED 2026-09-23 — after Q7, Q15 and Q15b, BEFORE ANY RUN

> The prediction above is **not** reopened. This amendment records which numbers the
> registration leans on that measured undelivered text, and fixes the decisions that
> changes, before any arm is built or any run is spawned.

**The registered falsifier no longer localises anything.** *"Falsified if the description
arm matches or beats the response arm. That would localise the entire finding to this
domain."* Q15 and Q15b have now shown the description arm **matching** the response arm
*in this domain*, whenever the description delivers the sentence. So a tie in a second
domain would replicate Q15, not localise Q1.

**Decisions, fixed now.**

- **Delivery is verified host-side for both arms before any run**, as in Q15. It is
  reported per arm: where the guidance sits relative to char 2,048, and whether the
  listing shows it.
- **The description copy goes inside the first 2,048 characters** (or the run uses a
  raised-cap session). Otherwise Q12 replicates the truncation, not the channel.
  Production descriptions are mostly longer than 2,048 (MCPSER-87 counts ~60 of 88), so
  an as-shipped description arm would naturally test absence. If that is wanted, it is a
  third arm, labelled as such.
- **The prediction stands as registered**: response wins by less than 4/30 → 29/30.
  Stated plainly: after Q15 the expected outcome with both copies delivered is a tie,
  which this registration scores as **falsified**. That is recorded now, before the run,
  so a tie is not later read as a surprise.

---

### AMENDED 2026-09-23 (second) — the domain changes to WEATHER, before anything is built

**Why.** Both registered candidates are closed APIs. Artikelbeheer (Compano) and
Ketenstandaard need licensed access and are not public. An eval publishes its records,
so neither can be used. The only public data this repo can publish is BAG/EP-Online
(the building set) and Open-Meteo (the weather tool).

**What this makes Q12.** A replication in a **second data domain**, not a second author:

- a different public source (Open-Meteo, not BAG/EP-Online);
- a different field set;
- a different rule shape (a period condition, not a berekeningstype or a threshold);
- ground truth derived from `weather-fixtures.json`, independent of `questions.json`.

It shares the server, the host and the author. `questions-weather.json` already says it is
"not a second domain" in Q12's sense, and that stays true of the *gate*. This amendment runs
the narrowest version the constraint allows, and it will be reported as **partial external
validity, not the gate**.

**The rule.** The weather tool's own record-conditional sentence, byte-identical in every arm
that carries it (the `RULE`):

> *"IMPORTANT: gasNormalizationFactor is only valid for full-year (Jan 1–Dec 31) queries. For
> partial-period year-over-year comparison, use the HDD ratio directly: normalizedEnergy =
> energy × (refPeriodHDD / thisPeriodHDD)."*

It applies only when the requested period is not a calendar year. The payload still returns
a `gasNormalizationFactor` for every period (2.53 for Q1 2024), so the wrong road is always
on offer.

**Arms.** All are `thin`'s minimal server, identical except where the RULE goes. In **all**
of them the computed partial-period alert keeps its first sentence (HDD total and factor)
and **loses its "Note: …" clause**, so no computed text carries the rule.

| arm | the RULE is delivered in | model-visible key |
|---|---|---|
| `wx-none` | nowhere (control, descriptive, not part of the prediction) | `eval-wx1` |
| `wx-desc` | the weather tool DESCRIPTION: minimal one-liner + RULE, well inside 2,048 chars | `eval-wx2` |
| `wx-resp` | the weather RESPONSE: `interpretation.guidance` = RULE, on every call | `eval-wx3` |

**Run.** `weather-partial-normalization`, **haiku and sonnet, n=10 per cell**, 60 runs, one
batch, default cap. Only the question string is passed. The preflight is Q15's: the host
listing shows the RULE inside the delivered description of `wx-desc`, and in no other
arm's listing; live calls; `countByVariant`.

**Scoring** as the question pins it: correct = 4,434 ± 60 m³ (the plain-HDD road ~4,451 is
inside), or the equivalent ~3.6% weather-corrected improvement, as in Q9. Route is mandatory:
HDD ratio / gasNormalizationFactor / none. The gasNormalizationFactor road (~10,626, or
comparing 2.53 against 2.40) is confidently wrong.

**Prediction: unchanged**, response wins by less than Q1's margin, and it is scored on
`wx-desc` vs `wx-resp`, 20 runs each. **Stated again, before the run:** after Q15, Q15b and Q8,
the expected result with both copies delivered is a **tie**, and this registration scores a
tie as **falsified**. `wx-none` shows whether the question has headroom without the rule. If
`wx-none` is also near ceiling, the run measured nothing, and it will say so.

### AMENDED 2026-09-23 (third) — a question WITH headroom, registered BEFORE it runs

The weather run above had no headroom: a two-period comparison routes around the factor.
This re-runs Q12 with the same three arms (`wx-none`, `wx-desc`, `wx-resp`, still deployed
and unchanged) on **`weather-single-quarter`**, added to `questions-weather.json` in this
commit with its ground truth tested against the fixtures. It asks for ONE quarter in an
*"average year"*, which is exactly the job `gasNormalizationFactor` looks built for, and the
one the rule forbids.

- **Run:** haiku and sonnet, n=10 per cell, 60 runs, default cap, one batch, only the
  question string passed.
- **Scoring:** the question's `_judge_note`. CORRECT means no factor-based figure presented
  as the answer, plus saying the factor is full-year-only or that a reference period is
  needed. CONFIDENTLY_WRONG means ~10,626 m³ presented. FABRICATED means an invented
  reference quarter.
- **Headroom gate, fixed now:** the comparison is scored only if `wx-none` is ≤ 14/20
  correct. Above that, it is recorded as no headroom, like the run above.
- **Prediction: unchanged.** Response wins by less than Q1's margin; falsified if the
  description matches or beats it. After Q15, a tie (within 2 of 20) is again the expected
  outcome, and is recorded now as the registered falsification.

### AMENDED 2026-09-23 (fourth) — the single-quarter run on OPUS, registered BEFORE it runs

> **RUN 2026-09-23 — FALSIFIED: opus does not need the rule.** See [`results/2026-09-23-q12c-weather-single-quarter-opus.json`](results/2026-09-23-q12c-weather-single-quarter-opus.json).
> `wx-none` **9/10**, `wx-desc` 9/9 (plus 1 NO_RECORD), `wx-resp` 10/10. Without the rule opus
> builds a reference quarter from 4–31 prior years itself, and no run took the factor road.
> Across models the rule is worth 0 on haiku (it doesn't act on it), 7/10 on sonnet, and 0 on
> opus (it doesn't need it). Two manual main-session runs on Opus 5.5 agree.

The same three `wx-*` arms and `weather-single-quarter`, **opus, n=10 per arm**, 30 runs,
default cap. The prediction for opus: **both rule arms ≥ `wx-none` + 5, and within 2 of each
other.** Falsified if either rule arm leads `wx-none` by < 3, or if the two rule arms differ
by ≥ 4. It asks whether sonnet's result (3/10 → 10/10 by either channel) holds on the
largest model, where `research-frame.md` says metadata matters least. Scoring as amendment
3. The manual-test rows (`queryIntent` "manual-test") are excluded from the audit.

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

## Q14 — Is ONE line enough? The minimum viable response payload

> **ANSWERED 2026-09-22 — ALL THREE PREDICTIONS CONFIRMED.** 60 runs, haiku, n=20 per
> arm, one batch. See
> [`results/2026-09-22-q14-one-line-response.json`](results/2026-09-22-q14-one-line-response.json).
>
> | arm | response carries | correct | fabricated | **cited 1.5** | tokens (median) |
> |---|---|---|---|---|---|
> | `words` | nothing | 8/20 | 20 | **0 of 20** | 27,615 |
> | **`inline-oneline`** | **one 181-char line** | **20/20** | 1 | **20 of 20** | **23,556** |
> | `inline` | the whole 5,020-char block | 20/20 | 0 | 20 of 20 | 24,058 |
>
> P1 (≥16) → **20**. P2 (gap ≥8) → **+12**. P3 (cited ≥16) → **20**. The second confirmed
> prediction in this file, after Q5 — and, like Q5, the one that bet on the simpler
> mechanism.
>
> **One line does what the whole block did.** The line is in the *description* of both
> `words` and `inline-oneline`, byte for byte; the only difference is that
> `inline-oneline` also carries it in the response. Cited 0 of 20 without that copy, 20
> of 20 with it. The counter-case — that a response needs enough bulk to be noticed —
> did not fire.
>
> **Adding 181 characters made it 14.7% cheaper** than `words` (median), with answer
> lengths within 10 characters. The `words` runs spend the difference improvising a
> unit for 3.59; every one of them did. Against `inline` the one-line arm is cheaper by
> only ~2% — a tie. The saving is from answering the question, not from shipping less.
>
> **For MCPSER-81 this is the answer:** a plain server can fix the overheating defect by
> adding the one relevant line to its response. Not by moving its block, not by
> computing an alert.
>
> **It does not settle Q7.** Both arms carry the line in the description, which is
> compatible with it being absent at interpretation time *and* with it being present
> and ignored.

> **REGISTERED 2026-09-22, BEFORE THE RUN.** Committed before any run is spawned.
>
> **DEPLOYED AND VERIFIED ON THE WIRE, 2026-09-22.** Both preflight steps done as far
> as they can be from the session that built it:
>
> - `mcpInlineOneline` live at `.../mcpInlineOneline`; a raw MCP `tools/call` on
>   3039WB/1 returns `temperatuuroverschrijding: 3.59`, **no `alerts` key**, and
>   `interpretation` = the single 181-character line and nothing else.
> - It stamps its own log rows: `summary.countByVariant` shows `inline-oneline`
>   under its own name, `paramsPresent: ["queryIntent"]`, `rowCount: 3`. No
>   `unknown` bucket. **Not a stale deploy.**
>
> **It could not be RUN from the session that built it — until it could.** For
> several hours the `.mcp.json` entry added that day was unreachable: the agent file
> appeared while a `ToolSearch` for its tool returned nothing. Later in the *same*
> session the MCP client reconnected and picked the arm up, and a live call returned
> the correct payload. So the rule is **not** "fixed at process start" — it is
> "established on connect, including reconnect". See the correction in
> `.claude/skills/run-eval/SKILL.md` step 1. The durable lesson is unchanged and is
> the one that matters: **the agent registry and the MCP connection move
> independently, so the agent list is never evidence either way.** Preflight with a
> real call.

### Why it matters, and why Q13 does not already answer it

Q13 moved the **whole** interpretation block into the response and took
`overheating` from 5/20 to 20/20. That is a real result and it is **not one a
production server can act on**, because "put your entire interpretation block in
every response" is an expensive instruction and nobody has checked whether it is a
*necessary* one.

Two answered questions say it probably is not:

- **Q2 measured volume twice and found it inert.** Pruning the response block to
  the record cost **zero** accuracy — 39/90 vs 39/90, then 30/30 vs 30/30 with two
  thirds of the block cut.
- **Q5 measured the cost of the rest.** Metadata that does *not* answer the
  question is charged at list price: `rich` went from 594 tokens cheaper to 1,172
  dearer the moment its alerts stopped being relevant.

So the payoff should come from **the lines that bear on the question**, not from
the volume. This is the limit case of that claim: **one line.**

It is also the exact question MCPSER-81 now turns on. The live Warmtebouw Duurzaam
server carries its threshold in the description and nothing in the response — the
`words` configuration, verified on the wire. The cheap fix there is to add one line
to the response, not to relocate a 5,020-character block.

### The arm

`inline-oneline`, deployed as `mcpInlineOneline`:

| | description | response |
|---|---|---|
| `words` | full prose, **incl. the threshold line** | nothing |
| **`inline-oneline`** | **identical, byte for byte** | **that one line, sliced** |
| `inline` | minimal (`schema`'s one-liner) | the whole block |

**`words` → `inline-oneline` is the single-variable comparison**: one line added to
the response, nothing else. The description is deliberately **not** stripped — this
is an ADDITION, not a move, because that is what a real server would ship and it is
strictly cheaper than relocating.

`inline` is the reference **ceiling**, not an adjacent rung: it differs in both the
description and the amount of response prose. Do not report `inline-oneline` →
`inline` as the value of a layer.

The line is sliced from `interpretationBlock` via `overheatingLine` and throws at
module load if the block is edited out from under it. Six tests pin that the
description is byte-identical to `words`', that the line is one line, and that it
carries the 1.5 threshold.

### Prediction

> **One line is enough. `inline-oneline` ≥ 16/20, i.e. it lands with `inline`
> (20/20) rather than with `words` (5/20).**
>
> - **P1 — `inline-oneline` ≥ 16/20.** Falsified if ≤ 10/20.
> - **P2 — it beats `words` by ≥ 8 runs.** Falsified if the gap is under 4, the
>   directory's noise bar.
> - **P3 — the threshold is cited in ≥ 16 of 20 runs**, against `words`' 0 of 20.
>   This is the mechanism check; falsified if ≤ 8.
>
> **Reasoning.** Q2 showed the block's volume does no work, twice. If volume is
> inert, then what Q13 moved into the response was one useful line and 5,000
> characters of ballast, and the line should carry the result alone.
>
> **The case against it**, which is real and is why this is worth running: nothing
> here has yet tested whether a response needs enough *substance* to be attended to
> at all. A single line beside a 40-field payload may simply not be noticed, in
> which case the effect Q13 found is partly about the block's bulk and "prune
> aggressively" becomes bad advice. That would also complicate Q2, which only ever
> pruned down to *several* notes, never to one.
>
> Note this repo's record: **six of seven registered predictions have been wrong.**

### What each outcome buys

| if | then |
|---|---|
| **≥16/20** | The production rule is cheap and precise: *put the line that answers the question in the response.* MCPSER-81 takes the one-line fix, and Q2's pruning result extends from "free" to "free down to a single line". |
| **≤10/20** | Bulk matters as well as placement, Q13's result is partly about the block not the line, and the honest advice for a plain MCP server becomes the expensive one. It would also put a floor under how far Q2's pruning can go. |
| **11–15** | Partial. Report as direction only and re-run at n=40 before anyone quotes it. |

### Protocol

`words` · `inline-oneline` · `inline`, haiku, **n=20 per arm, all three interleaved
in one batch**, on `overheating`. Same scoring rule as Q13, which is pinned in that
run's `scoring_rule` — fixed before looking at these answers this time. Record
`tool_uses`, `duration_ms`, `subagent_tokens` and the ANSWER character count, and
audit against `get_tool_call_log` unfiltered, `countByVariant` before any filter.

**Read the cost columns too.** If the prediction holds, `inline-oneline` should be
the cheapest arm in the set — it carries `words`' description plus ~180 characters,
where `inline` carries a 5,020-character block on every call.

### Known limits, stated up front

- **haiku only**, one question, one defect, one address. `overheating` is
  saturated at the `inline` and `rich` rungs, so this measures the gap between
  `words` and `inline-oneline` and nothing above it.
- **It cannot separate "one line" from "this particular line."** The overheating
  line is unusually self-contained — a field name, three bands, a threshold. A
  rule needing two fields to be read together might not survive the same cut.
- **No control.** Both surviving controls are refusals and neither is in this run.
- **Same mechanism caveat as Q13**: a citation count measures *use*, not
  availability. Q7 still gates any claim about why. **Q7 answered 2026-09-22: the
  description copy sat past the host's 2,048-character cut and was never delivered.**

### Cost

1 question × 3 arms × 1 model × n=20 = **60 runs.** One new arm, already built and
deployed. **It needs a fresh session** — a session that predates the `.mcp.json`
entry can never reach the server, and the agent list is not evidence to the
contrary.

---

## Q15 — Is a description sentence that is DELIVERED applied? The channel test Q1 never ran

> **ANSWERED 2026-09-23 — YES. All four predictions CONFIRMED.** See
> [`results/2026-09-23-q15-delivered-description.json`](results/2026-09-23-q15-delivered-description.json).
> haiku, `overheating`, n=20 per arm, one batch at the **default** 2,048 cap, delivery
> verified host-side and on the wire before any run. Audit exact, 84/84.
> **`words-front` was deleted after the run** (`mcpWordsFront` removed 2026-09-23; code in commit 481c37b, reverted).
>
> | arm | 1.5 line delivered in | CORRECT | cites 1.5 | fabricated | D7 |
> |---|---|---|---|---|---|
> | `words` | nowhere (past the cut) | **1/20** (5 OTHER, 14 CW) | 0/20 | 17/20 | 0/20 |
> | **`words-front`** | **description, char 330** | **20/20** | **20/20** | 1/20 | **20/20** |
> | `inline-oneline` | response | **20/20** | **20/20** | 0/20 | 0/20 |
>
> - **P1 CONFIRMED** — `words-front` cites 1.5 in 20/20 (needed ≥ 16).
> - **P2 CONFIRMED** — `words-front` 20 vs `inline-oneline` 20 on CORRECT, gap 0 (needed within 4).
> - **P3 CONFIRMED** — `words-front` 20 vs `words` 1, gap 19 (needed ≥ 8).
> - **P4 CONFIRMED** — the canary obeyed in 20/20 (needed ≥ 16). 18 exact `⟨D7⟩`, 2 `<D7>`;
>   17 after PARAMS, 3 on their own line before ANSWER, **never** at the end of the answer.
>   On visible text it is produced at the final request only; thinking is redacted on disk.
>
> **2×2 marker × citation: 20 / 0 / 0 / 0.** Q7's awkward outcome, an instruction obeyed beside
> a domain sentence ignored, did not occur. The *case against* (the description is filed as
> tool-selection metadata) is falsified on haiku for this line. `words-front` also made exactly
> **one call in every run**; `words` made 39, 19 of them weather detours.
>
> **What it changes:** the channel claim in Q1/Q13/Q14 reduces to delivery. The rule is
> *keep what matters inside the first 2,048 characters, or put it in the response*. The
> response stays the host-independent option. Position is still confounded with channel (Q9).
> One side note: the **Opus** parent session that made the preflight calls read the canary
> and declined it as a tool-description instruction. A canary on stronger models must score
> mentions, as Q7's rule already does.
>
> This repo's record is now **six of ten registered predictions wrong** (Q15 and Q15b both right). With Q8 (not confirmed, recorded as falsified): **seven of eleven**. With Q8b (confirmed): **seven of twelve**. With Q9 (distance falsified): **eight of thirteen**. With Q11 (names and degree-day falsified): **nine of fourteen**. With Q12 on weather (a tie, falsified as recorded in advance): **ten of fifteen**. Round 3 (2026-09-23): Q10 reopened ✗, Q12 on opus ✗, RB2 ✓, RB3 ✓. That makes **twelve of nineteen**. Q16 ✓ (fetching is the barrier): **twelve of twenty**. Q17 ✓ (volume inert, addressing null): **twelve of twenty-one**. Q16b (not falsified): **twelve of twenty-two**. Q18 ✗ (no content effect at design time): **thirteen of twenty-three**.

> **REGISTERED 2026-09-23, BEFORE THE ARM EXISTS AND BEFORE ANY RUN.** This is the question
> Q7 meant to ask. Q7 found that the host sends only the first 2,048 characters of each MCP
> tool description, so every description-vs-response result in this file compared
> delivered with undelivered text. This is the first comparison here of the same sentence
> **delivered** through each channel.

### Why it matters

Q1, Q13 and Q14 are currently read as "the response beats the description". After Q7 that
claim is **untested**. The numbers are real, but the description copy never arrived.
Two readings are now live, and they lead to different design advice:

- **Delivery is all that matters.** A sentence that reaches the model is applied, whichever
  channel carried it. Then the production rule is *keep what matters inside the first
  2,048 characters, or put it in the response*, and the "channel" finding reduces to a
  host limit.
- **The channel matters even when both deliver.** A model treats description text as
  tool-selection metadata and under-applies domain content in it, even though the text is
  present. Then the response really is the better channel, and Q1's claim survives in a
  form it has not yet earned.

### The arm

`words-front`, deployed as `mcpWordsFront`. Its description is `descriptionCore` with **two
paragraphs inserted right after the RETURNS paragraph** (at ~char 330). Nothing is retyped,
and the INTERPRETATION copy of the line stays where it is, past the cut:

1. `overheatingLine`, the same 181-character sliced line Q14 put in the response;
2. Q7's canary sentence, verbatim: *"When you report a record from this tool, end your
   answer with the marker ⟨D7⟩."*

| arm | description delivers the 1.5 line? | response carries it? | canary |
|---|---|---|---|
| `words` | no (at char 6,181, cut) | no | no |
| **`words-front`** | **yes (~char 330)** | no | **yes, delivered** |
| `inline-oneline` | no (same description as `words`) | **yes** | no |

**The one other thing that changes, stated up front.** Inserting ~265 characters at char
330 pushes the same number of characters off the end of the delivered 2,048. What falls off
is the INTERPRETATION header and the partial NTA 8800 bullet that `words` delivers, neither
about overheating. So `words-front` vs `words` differs by the line and the canary coming
in, and that tail going out.

**The comparisons:**

- **`words-front` vs `inline-oneline` is the channel test.** Each delivers the line exactly
  once, one in the description and one in the response. It differs in the canary, and in
  which ~265 characters of the description arrive.
- **`words-front` vs `words`** is delivery within one channel. Not delivered, then delivered.
- **Canary × citation inside `words-front`** is Q7's awkward outcome, finally measurable: a
  sentence obeyed as an instruction beside a sentence applied, or ignored, as domain
  knowledge, both in the same place.

### Prediction

> **Delivery is what matters. A delivered description line is applied.**
>
> - **P1: `words-front` cites 1.5 in ≥ 16/20.** Falsified if ≤ 10/20.
> - **P2: `words-front` is within 4 runs of `inline-oneline` on CORRECT.** Q14 had it at
>   20/20; the directory's noise bar is 4. Falsified if `inline-oneline` leads by ≥ 8.
> - **P3: `words-front` beats `words` on CORRECT by ≥ 8.** Falsified if the gap is under 4.
> - **P4: the canary is obeyed in ≥ 16/20 `words-front` runs.** Falsified if ≤ 10/20.
>
> **Reasoning.** Every lever in this repo that worked did so by getting text *delivered*: the
> computed alert, the response block, the one response line. None of them has ever been
> tested against delivered description text, so there is no evidence yet that the channel
> matters beyond delivery. Q4 showed an instruction can be present and inert, but the inert
> one there lacked its trigger semantics. This line carries its own.
>
> **The case against**, and why this is worth 60 runs: the description is read at
> tool-*selection* time, and a model may file it as "what this tool is for" rather than "how
> to read what it returns". If that is how haiku treats it, P1 fails and P4 holds. That is
> the sharpest outcome available here, and it would put Q1's channel claim back on its feet.
>
> This repo's record: **six of eight registered predictions wrong.**

### Scoring, fixed now

- **Domain:** CORRECT / CONFIDENTLY_WRONG / OTHER / FABRICATED / CITES_1_5, exactly as
  pinned in `results/2026-09-22-q13-overheating-response-channel.json` → `scoring_rule`,
  applied with the marker stripped.
- **Marker:** exactly as pinned in Q7's amendment. OBEYED = `D7`, bare or bracketed,
  anywhere in the returned text; a mention counts. EXACT vs VARIANT and position
  (`END_OF_ANSWER` / `IN_ANSWER` / `AFTER_PARAMS` / `OTHER`) are reported, not
  thresholded. The carried-or-produced check uses the transcript on disk.
- **Also recorded in `words` and `inline-oneline`**, where the canary is absent: any `D7`
  there is a contamination alarm and voids the run.
- **2×2 marker × citation** for `words-front`, whatever the counts.
- **Exclusions:** a run with no `get_building_profile` result is `NO_RECORD`, kept, and
  dropped from denominators. Not replaced.
- **Per run:** `tool_uses`, `duration_ms`, `subagent_tokens`, ANSWER characters with the
  marker stripped, and request-1 input from disk.

### Protocol

`words` · `words-front` · `inline-oneline`, **haiku**, `overheating`, **n=20 per arm**, all
three interleaved in one sitting: five waves of 12, four per arm. Only the `question` string
is passed. Audit against `get_tool_call_log` unfiltered, reading `countByVariant` first, and
exclude stray rows by timestamp.

**Delivery preflight, new and mandatory for this arm.** Before any run:

- this session's own listing of `mcp__eval-words-front__get_building_profile` must show the
  1.5 line and the canary before `… [truncated]`;
- a raw HTTP `tools/list` must show both inside the first 2,048 characters.

Verified from the protocol side *and* the host side, because Q7 is exactly what happens when
only the protocol side is checked.

### Known limits, stated up front

- **haiku only**, one question, one line. `overheating` is saturated at every response rung,
  so `inline-oneline` near 20/20 is expected. The interesting number is `words-front`.
- **Position is confounded with channel.** The line sits ~330 characters into a
  2,048-character description, and at the end of a JSON response. This compares *delivered
  here* with *delivered there*. It does not compare channels at equal position; that is Q9's
  axis.
- **The canary is present in only one arm.** If it changes how haiku reads the rest of the
  description, that change lands on `words-front` alone. It is content-free, but the
  possibility is noted rather than assumed away.
- **No control.** Both surviving controls are refusals, and neither is in this run.

### Cost

1 question × 3 arms × 1 model × n=20 = **60 runs.** One new arm, one deploy, deleted
afterwards unless the result makes it worth keeping.

### Q15b — the same question with the cap RAISED. Registered 2026-09-23, before either half runs

> **ANSWERED 2026-09-23 — delivery is what matters, here too. All three predictions CONFIRMED.**
> See [`results/2026-09-23-q15b-uncapped-channel.json`](results/2026-09-23-q15b-uncapped-channel.json).
> Every session started with `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`. Preflight: no
> `[truncated]` in any listing, `temperatuuroverschrijding` and the 1.5 line present, and every
> tail matching the raw text. Request-1 input `words` − `inline` = **+11,282** tokens (Q7's
> default-cap figure was about +3.7k). Audit exact, 63/63.
>
> | arm | block delivered via | CORRECT | cites 1.5 | fabricated |
> |---|---|---|---|---|
> | `words` (uncut, 37.6k chars of descriptions) | description | **20/20** | **20/20** | 0 |
> | `inline` | response | **20/20** | **20/20** | 0 |
> | `inline-oneline` | both | **20/20** | **20/20** | 0 |
>
> - **P1 CONFIRMED** — uncut `words` cites 1.5 in 20/20.
> - **P2 CONFIRMED** — `words` 20 vs `inline` 20, gap 0.
> - **P3 CONFIRMED** — `inline-oneline` 20/20.
>
> The registered volume risk did not fire. The cost did: in this batch uncut `words` runs
> **+23.7% tokens** against `inline`, and the extra is almost all render/weather/log
> descriptions (request-1 `words` 28,888 vs `inline-oneline` 19,826, and those two share the
> same uncut profile description). Raising the cap is a client-side fix that every MCP server
> in the session pays for on every request. `overheating` is saturated at 60/60 here, so a
> smaller channel effect would be invisible. **Not comparable with any Q15 cell.**

Q7 found that Claude Code 2.1.280 lets a session change the 2,048-character cap:
`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`. That makes the channel test Q1 and Q13 meant to
run possible with **no new arm and no edited description**. Deliver the whole block by
each channel, and compare.

**Session.** A fresh Claude Code session, **started with
`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`**, on this repo. It cannot run from a
session started without the variable, because the cap applies to every MCP server in the
session and is read when the session starts.

**Arms.** haiku, `overheating`, n=20 per arm, one batch, interleaved:

| arm | the 5,020-char INTERPRETATION block arrives via | 1.5 line delivered in |
|---|---|---|
| **`words`** | **DESCRIPTION** (full 6,779 chars, uncut) | description |
| **`inline`** | **RESPONSE** (description = `schema`'s one-liner) | response |
| `inline-oneline` | description (full) + one line in the response | both |

**`words` vs `inline` is the channel test.** It is the same comparison as Q13, whose
description copy never arrived. Now both channels deliver the same block.

**Delivery preflight, mandatory.**

- This session's listing of `mcp__eval-words__get_building_profile` must show
  `temperatuuroverschrijding` and must **not** end in `… [truncated]`.
- Request-1 input of `words` minus `inline` on disk must be larger than Q7 measured in a
  default session (+3,727-ish against `thin` on haiku), by roughly the uncut remainder of
  every long description.

If either check fails, stop.

**Prediction.**

> **Delivery is what matters, here too.**
>
> - **P1: uncut `words` cites 1.5 in ≥ 16/20.** Falsified if ≤ 10/20.
> - **P2: `words` is within 4 runs of `inline` on CORRECT.** Falsified if `inline` leads by
>   ≥ 8. That would put the channel claim back on its feet, measured properly.
> - **P3: `inline-oneline` ≥ 16/20** (both channels). A sanity check, not a test.
>
> **Why this could fail.** With the cap raised, `words` also delivers its full render-tool
> descriptions (`render_chart` alone is 7,977 chars). `inline` carries the minimal render
> tools. So `words` puts the 1.5 line inside ~30k characters of tool definitions, where
> `inline` puts it beside the data. If haiku drowns, P1 fails for a reason that is about
> volume and distance, not channel. That is reported as such, not as a channel effect.

**Scoring** as Q15 above. There is no canary in these arms, so any `D7` voids the run.
**Record, and do not compare across sessions:** Q15 and Q15b run in different sessions
with different caps, so their cells are never subtracted from each other. Each is read
within its own batch.

**Cost:** 60 runs, no deploy.

---

## RB1 — Re-baseline: `schema` → `words` on `total-vs-per-m2`, sonnet

> **RUN 2026-09-23 — DIRECTION ONLY. The prediction is neither confirmed nor falsified.** See
> [`results/2026-09-23-rb1-schema-words-total-vs-per-m2.json`](results/2026-09-23-rb1-schema-words-total-vs-per-m2.json).
> `schema` **4/20**, `words` **11/20**: a gap of 7, inside the registered 4–7 band. The NULL did
> not hold, and the falsifier (≥ 8) did not fire. Every miss led with 2,859 (the BAG 100 m²);
> no run reported 28.59 as the total. Same model ID as 2026-09-21 (`claude-sonnet-5`). Audit
> exact, 41/41.
>
> **What it does to the quoted claim.** The direction (`words` above `schema` on sonnet) now
> reproduces in two same-batch runs. The mechanism the old file gave (*the thermal-zone
> sentence carries it*) is **withdrawn**, because that sentence was never delivered. Whatever
> moves sonnet is in the first 2,048 characters. Candidates are QUERY STRATEGY 5's
> "VBO-level" sentence and the NTA 8800 bullet naming `gebruiksoppervlakte`; this run does
> not isolate which. The size is still not quotable (8/10, 2/10, 11/20 across three sittings).

> **REGISTERED 2026-09-23, BEFORE ANY RUN.** The first re-baseline Q7's `what_this_changes`
> asks for. It is not a new question: it re-measures the one `schema → words` gap this
> repo quoted as "the prose is the carrier", now that Q7 has shown what `words` actually
> delivers.

### What is being re-measured

`readable-ladder-co2` (2026-09-21, n=10) measured `schema` 2/10 → `words` 8/10 on sonnet
and read it as *"PROSE PAYS WHEN IT CARRIES THE SPECIFIC FACT THE QUESTION TURNS ON"*: the
thermal-zone vs BAG sentence. The variance audit downgraded that to direction-only, because
`words`/sonnet on the same question read **2/10** in `q1-response-channel` the same day.

Q7 changes the premise. The sentence that claim credits (*"gebruiksoppervlakte_thermische_zone_m2
… vs oppervlakte_m2 (BAG): two different scopes"*) sits at **char 4,311**, past the cut. It
was never delivered. What `words` delivers at the default cap, and `schema` does not, is the
first 2,048 characters. Measured on the wire today, those include QUERY STRATEGY 5 (*"oppervlakte_m2
is VBO-level and may represent only one unit"*, char ~1,617) and the start of the NTA 8800
bullet (*"… gebruiksoppervlakte populated"*, char ~1,938). Input and output schemas are
byte-identical between the two arms. `schema`'s output schema already describes
`gebruiksoppervlakte_thermische_zone_m2` as *"Usable floor area of the thermal zone in m²"*.

### The run

`schema` · `words`, **sonnet**, `total-vs-per-m2`, **n=20 per arm**, one sitting, five waves
of 8 (four per arm per wave, rotated). **Default cap** (`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`
unset), the host every quoted number came from. Only the `question` string is passed.
The preflight is the Q15 one: the host listing for both arms, one live call per arm, and
`countByVariant` unfiltered.

### Prediction

> **The quoted gap was not the prose. `words` − `schema` < 4 of 20 on CORRECT (NULL).**
>
> - **Falsified if `words` leads by ≥ 8 of 20.** That would mean the first 2,048 characters
>   carry a real effect on this question. The candidate carrier would be the VBO-level
>   sentence, not the thermal-zone sentence the old file credited.
> - A lead of 4–7 is **direction only**, reported as such.
>
> **Reasoning.** The fact the old file credited was never delivered, and the same cell read
> 8/10 and 2/10 on the same day. What is delivered is a warning that `oppervlakte_m2` may
> be one unit of a larger building. That is about which VBO, not about which area the label
> is expressed against, and here the VBO *is* the flat.
>
> **The case against.** "oppervlakte_m2 is VBO-level and may represent only one unit" is a
> sentence that makes BAG area look unreliable, and sonnet reads carefully. It could push a
> run toward the other area field without ever seeing the scopes sentence.

### Scoring, fixed now

- **CORRECT** = the figure the run LEADS WITH is in 2,570–2,690 kg/year (`exact_value`, 2,630 ± 60),
  as in `readable-ladder-co2`. **CONFIDENTLY_WRONG** = a figure outside the band, stated as
  the answer. **DECLINED** = no figure. Reporting 28.59 kg as the total counts as
  CONFIDENTLY_WRONG, and is also noted.
- **Denominator**, recorded per run from the answer: `thermal_zone` (92), `bag` (100), `other`.
  Route and value coincide on this question (2,630 only from 92, 2,859 only from 100), so
  it is reported, not scored separately.
- A run that gets no `get_building_profile` result is `NO_RECORD`, kept, and dropped from
  denominators.
- **Per run:** `tool_uses`, `duration_ms`, `subagent_tokens`, ANSWER characters, request-1 input
  from disk.

### Known limits, stated up front

- One question, one model, one address. This re-baselines ONE quoted number; Q8–Q12 are next.
- It measures `words` **as delivered at the default cap**. Whether the uncut description
  (the Q15b session setting) carries the thermal-zone sentence into an effect is a
  different run, in a different session, not compared with this one.

### Cost

40 runs, no deploy.

---

## Q16 — Is the weak model's barrier FETCHING the data, or APPLYING the rule?

> **ANSWERED 2026-09-23 — FETCHING.** See [`results/2026-09-23-q16-fetch-vs-apply.json`](results/2026-09-23-q16-fetch-vs-apply.json). haiku, n=20 per arm.
> Audit exact, 101/101.
>
> | arm | correct |
> |---|---|
> | rule only | **2/20** |
> | + server-computed reference quarter (1,231.3 HDD) | **15/20** |
> | + the computed factor (1.113) | **11/20** |
>
> P1 and P2 are **confirmed**. P3 is **partial**: 11, when it needed ≥ 16, but not ≤ 10.
> Give haiku the data it would have had to fetch and it applies the rule. The finished
> factor adds nothing on top. What still goes wrong in both arms is leading with a full-year
> extrapolation, which lands on the same 10,600 by another road.

> **REGISTERED 2026-09-23, BEFORE THE ARMS EXIST.**

### Why it matters

On `weather-single-quarter` haiku failed in every channel (Q12: 0/10) and in every form (Q10:
1 / 0 / 1 of 20), while sonnet and opus built a reference quarter from 4–31 prior years and
got it right. In all of those arms, following the rule required **fetching data the payload
does not contain** (a reference quarter). Q12 and Q10 cannot tell two explanations apart:

- **(a) Fetching is the barrier.** haiku reads and applies a rule, but does not go and get
  the data it needs. Give it the data and it succeeds.
- **(b) Applying is the barrier.** Even with the reference in hand, haiku reaches for the
  ready-made `gasNormalizationFactor`.

This decides the design advice for weak callers: *ship the reference data*, *ship the
computed factor*, or *neither is enough*.

### The arms

All of them are `q10-prose`: minimal descriptions, the Note stripped, and the partial-period
RULE as `interpretation.guidance`. They differ ONLY in what the server adds to
`summary.degreeDays` for a partial period inside one calendar year:

| arm | adds | key |
|---|---|---|
| `q10-prose` (**A**, reused) | nothing (rule only) | `eval-q10a` |
| `ref-data` (**B**) | `referencePeriodWeightedHDD`: the mean weighted HDD of the SAME calendar window over the 10 previous years (server-computed from Open-Meteo), with `referencePeriodNote` naming the years | `eval-q16b` |
| `ref-computed` (**C**) | B + `periodNormalizationFactor` = referencePeriodWeightedHDD / totalWeightedHDD, with a one-line formula | `eval-q16c` |

`gasNormalizationFactor` (2.53) stays in every arm, so the trap is always on offer.

### Run and scoring

- **Run:** `weather-single-quarter`, **haiku, n=20 per arm**, 60 runs, default cap, one batch.
- **CORRECT:** 4,200 × (reference-quarter HDD / 1,106.3), ≈ 4,675 m³ with the 2014–2023 mean,
  accepted within ± 100. A reference the run built itself from tool data also counts, as
  before.
- **CONFIDENTLY_WRONG:** a factor-based ~10,600 m³.
- **FABRICATED:** an unsourced reference quarter.

### Prediction

> **Fetching is the barrier.**
> - **P1: A ≤ 3/20** (a replication of Q10's 1/20).
> - **P2: B ≥ 10/20.** Falsified if B ≤ 4/20: then the reference in hand is ignored, and
>   (b) holds.
> - **P3: C ≥ 16/20.** Falsified if C ≤ 10/20: then even a computed, ready-to-multiply factor
>   loses to `gasNormalizationFactor`.
>
> **Reasoning.** Haiku applied delivered reading rules 20/20 (Q15) and failed only where the
> rule sent it to get more data (Q12, Q10). The case against: haiku reached for 2.53 even
> when told, for this very record, that the period is not a full year (Q10's trigger). A
> ready-made number beside it may just be one more number.

**Cost:** 60 runs, two new arms.

### Q16b — Does shipping the data also save the STRONG models work? Registered 2026-09-23, BEFORE the run

> **ANSWERED 2026-09-23 — yes: same accuracy, a fraction of the work.** See
> [`results/2026-09-23-q16b-strong-models-cost.json`](results/2026-09-23-q16b-strong-models-cost.json). Audit exact, 210/210.
>
> | | tool calls (median) | tokens | wall time | answer |
> |---|---|---|---|---|
> | sonnet, rule only | 7 | 53.1k | 65 s | 4,490–4,800 |
> | sonnet + reference | **1** (−86%) | **40.7k** (−23%) | **16 s** (−75%) | **4,675**, 10/10 |
> | opus, rule only | 7.5 | 52.2k | 36 s | 4,670–4,970 |
> | opus + reference | **1** (−87%) | **39.9k** (−24%) | **10.6 s** (−71%) | **4,675**, 10/10 |
>
> All six cells were 10/10 correct. P1 and P3 are **confirmed**. P2 is **partial**: calls fell
> far past the 30% bar, tokens only 23–24%. The haiku fix is a cost and consistency fix for
> sonnet and opus.
>
> The last three throwaway arms (`mcpQ10Prose`, `mcpQ16Ref`, `mcpQ16Computed`) were deleted afterwards (2026-09-23; code in git history). No research arms from this round remain deployed.

On `weather-single-quarter` sonnet and opus were already correct from the rule alone, but
they paid for it: 4–11 (sonnet) and 6–31 (opus) extra weather calls to build a reference
quarter themselves (Q12). If the server ships that reference, the fix Q16 found for haiku
should be a **cost** fix for the models actually in use.

- **Run:** the same three arms (`q10-prose`, `q16-ref`, `q16-computed`), `weather-single-quarter`,
  **sonnet and opus, n=10 per cell**, 60 runs, default cap.
- **Measured:** correctness (scored as Q16); per run `tool_uses`, `subagent_tokens` and
  `duration_ms` from the harness, and weather calls from the transcript.
- **P1:** correctness stays high in every arm, ≥ 8/10 per cell. Falsified if any cell ≤ 6/10.
- **P2:** `q16-ref` cuts median `tool_uses` and median `subagent_tokens` against `q10-prose` by
  ≥ 30% on both models. Falsified if either median falls by < 10% on either model.
- **P3:** `q16-computed` is within 10% of `q16-ref` on both medians (the finished factor saves
  nothing further).

## Q17 — Does addressing help when the relevant rule is ONE AMONG A HUNDRED?

> **ANSWERED 2026-09-23 — no, and 100 rules did not hurt either. All three predictions
> CONFIRMED.** See [`results/2026-09-23-q17-rules-at-scale.json`](results/2026-09-23-q17-rules-at-scale.json). 160 runs, haiku + sonnet, n=10. Audit exact,
> 186/186.
>
> | question / model | 2 rules | 10 | 100 | 100 addressed |
> |---|---|---|---|---|
> | overheating / haiku | 10/10 | 10/10 | 10/10 | 10/10 |
> | overheating / sonnet | 8/10 | 10/10 | 10/10 | 9/10 |
> | area / haiku | 2/10 | 3/10 | 0/10 | 2/10 |
> | area / sonnet | 10/10 | 10/10 | 10/10 | 10/10 |
>
> haiku found the overheating rule at position 41 of 100 in every run. There is no dilution
> up to ~16k chars of response guidance, so there is nothing for addressing to win back, and
> it won nothing back. (The four Q17 arms were deleted afterwards, 2026-09-23; the frozen rule list is in git history.) Caveat: haiku's area cells are at a floor this sitting (2/10 with the
> rule alone), which can hide dilution there; the overheating cells carry the result.

> **REGISTERED 2026-09-23, BEFORE THE ARMS EXIST.**

### Why it matters

Q10 put ONE rule next to the data, so there was nothing to route; the answer was that
labelling it changes nothing. The case `relates_to_fields` exists for is different:
**many** rules in one response, and the model must find the one that applies. That is the
production shape, a server that ships all its semantics, and nothing here has measured it.
It has to be measured on a model that could be misled by volume. **Sonnet, not only haiku:**
single-rule questions are at ceiling for sonnet, but 100 rules may not be.

### The arms

`get_building_profile`, `schema`'s one-liner description; all guidance is in the RESPONSE
(`interpretation`). There are two target rules, both sliced from `interpretationBlock`: the
overheating line and the scopes line.

| arm | `interpretation` carries |
|---|---|
| `q17-one` | the 2 target rules, as prose |
| `q17-many` | the same 2 among **98 real distractors**, 100 lines of prose; targets at fixed positions 41 and 63 |
| `q17-many-addressed` | the same 100, each as `{ relates_to_fields, meaning }` |

**The distractors** are real guidance bullets from this server's own tool descriptions
(building, weather, render, log), in a fixed order, frozen in `src/tools/q17-rules.json`.
Example-question lines are excluded, as is any line that mentions
`temperatuuroverschrijding`, the thermal zone, `co2_emissie`, per-m² or whole-building
totals, so no distractor helps or misleads either answer. `relates_to_fields` is extracted
mechanically: the identifiers each rule names, or `[]`.

### Run

- `overheating` and `total-vs-per-m2`, **haiku and sonnet**, n=10 per cell, 120 runs, default
  cap.
- Scoring as Q13 (overheating) and RB1 (lead figure).

### Prediction

> **Volume does not hurt, and addressing adds nothing.** The repo found volume inert every time
> it looked (Q2 pruning, Q15b 37k chars of definitions).
>
> - **P1:** `q17-many` within 3 of `q17-one` in every model × question cell. Falsified if any
>   cell drops by ≥ 5.
> - **P2:** `q17-many-addressed` within 3 of `q17-many` in every cell. Falsified if it recovers
>   ≥ 4 in a cell where `many` dropped.
> - **The outcome that would matter most:** P1 falsified (the dilution is real) together with P2
>   falsified (addressing wins it back). That would be the first evidence for addressable
>   semantics at scale.

### AMENDED 2026-09-23 — a fourth arm, BEFORE ANY RUN

A dose point is added so the curve reads 2 → 10 → 100. If a small selection beats the full
set, that is the argument for **selective semantics** (project only what applies):

- **`q17-ten`:** the 2 target rules among the FIRST 8 distractors of the same frozen list, as
  prose, targets at positions 3 and 6. Key `eval-q17d`.
- **P3: `q17-ten` within 3 of `q17-one` in every cell.** Falsified if any cell drops by ≥ 5.
- **Run:** 160 runs, all four arms in one batch.

## RB2 and RB3 — re-baselines with the description cap RAISED. Registered 2026-09-23, BEFORE either runs

> **RUN 2026-09-23 — both CONFIRMED.**
>
> - **RB2** ([`results/2026-09-23-rb2-opaque-naming-uncut.json`](results/2026-09-23-rb2-opaque-naming-uncut.json)): uncut `opaque-words` **20/20**, every run citing 1.5
>   via the neutral name `TO`; `opaque` 6/20, none of them via the indicator. **Q6's "the name
>   is the problem / prose will not fix it" was absence.** Delivered, the glossary fixes it
>   completely. Audit exact, 54/54.
> - **RB3** ([`results/2026-09-23-rb3-ladder-words-uncut.json`](results/2026-09-23-rb3-ladder-words-uncut.json)): on `total-vs-per-m2`, `schema` 1/10 vs uncut `words`
>   **10/10**. The scopes sentence arrives, and *"the prose is the carrier"* is restored,
>   mechanism included. On `gas-estimate`, route-correct is 0 vs 0: `schema` takes the EP2 road
>   7/10, while uncut `words` **declines 10/10** ("no meter data; calculated, not measured").
>   Audits exact, 25/25 and 20/20.

Both re-measure results whose description copy never arrived (Q7). Every session is
started with `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`, so the whole description is
delivered. Each result is read within its own batch only.

**RB2: Q6's naming result, uncut.** Q6 scored `opaque-words` (the neutral name `to` plus a
glossary with *"unitless … ABOVE 1.5 = significant"*) at 0/7. That glossary line sat at
char 3,105 and was never delivered.
- **Run:** `opaque` vs `opaque-words` on `overheating`, haiku, n=20 each, 40 runs.
- **Prediction:** uncut `opaque-words` ≥ 16/20 and `opaque` ≤ 10/20. Falsified if
  `opaque-words` ≤ 10/20.
- **Reasoning:** Q15 found delivered description text is applied, and the name was never
  the problem.

**RB3: the readable ladder's `words` rung, uncut.** The run is `schema` vs `words` on
`total-vs-per-m2` and `gas-estimate`, sonnet, n=10 each, 40 runs.
- **P1, `total-vs-per-m2`:** `words` ≥ `schema` + 5. The scopes sentence (char 4,311) now
  arrives. Falsified if the lead is < 2.
- **P2, `gas-estimate`:** `words` within 3 of `schema`. `descriptionCore` carries no gas
  conversion. Falsified if they differ by ≥ 6.
- **Stated confound:** uncut `words` also carries ~30k chars of render/weather descriptions.
  Q15b found that did not hurt.

## Q18 — Does an IMPROVING agent edit better from field-keyed semantics? Registered 2026-09-23, BEFORE any run

> **ANSWERED 2026-09-23 — no. Only provenance changed anything.** 276 runs, sonnet + opus.
> See [`results/2026-09-23-q18-authoring-form.json`](results/2026-09-23-q18-authoring-form.json).
>
> | pooled | A prose | B structured | C prose + same content |
> |---|---|---|---|
> | T1 attribution correct | 100% | 100% | 100% |
> | T2 orphan recall | 99.4% | 100% | 100% |
> | T3 coverage F1 | 100% | 100% | 100% |
> | T4 cites the recorded history | 0/16 | 16/16 | 16/16 |
>
> - **T2's one miss:** sonnet, large, arm A, one of the seven `gasNormalizationFactor` rules.
>   The abbreviated references ("EMG forfaitair", "gebruiksoppervlakte populated") were
>   found every time, by both models, in every form.
> - **T4:** every arm-A answer was read in full. **None invented a history.** opus said
>   explicitly that nothing is recorded (8/8). sonnet gave the rule's own rationale instead.
>   With the eval result on record, B/C chose "keep" 11/16. A chose "keep" 3/8 and
>   "test_first" 5/8.
> - **Predictions:**
>   - P1 ✗: B leads A by 0.6 pp on T2 recall.
>   - P2 ✓: B = C.
>   - P3 ✗: T3 F1 is 100 in every arm.
>   - P4 ✓: T1 is 100% in every arm.
>   - P5 ✓: B/C cite 16/16; A fabricates 0/16.
>   - P6 not confirmed: A dropped 1.2 pp, predicted ≥ 5.
> - **Decision rule, as registered:** A is within 5 pp of B on T1–T3, so **2c's authoring
>   case rests on provenance alone**. 2c is rewritten accordingly.
> - **Unscored:** the borderline fields were excluded before the run. There, prose readers
>   listed `gebouwklasse` and `gebruiksdoel` as uncovered 20/20, and labelled readers 0/20.
>   Explicit links carry coverage the author left implicit.
> - **Cost:** B's input is +29% to +89% over A (median, within model). C carries the same
>   information and is 6–18% cheaper than B.
> - **Ceiling:** at ≤ 112 rules and ≤ 42k characters, the whole source fits in one read.
>   That is the easy case, and it is this server's real case.

Design guidance 2c recommends keeping the source of all semantics as
`{ relates_to_fields, meaning, provenance }`. The reason given is the authoring side, not
runtime: Q10 and Q17 found that the form of a delivered rule does not matter to the
answering model. 2c's claim is marked *unmeasured*. This measures it.

**Design-time, not runtime.** No MCP server is involved. Each run is one headless
`claude -p` call with no tools, no settings and no MCP config, from an empty directory.
It gets the output-field list of both data tools, the semantics source in one of three
forms, and one improvement-loop task. It must answer from that material alone. The
fixture, the tasks and the harness are frozen in [`q18/`](q18/) before the first run:
- `rules.json` holds the real `get_building_profile` and `get_weather_context`
  INTERPRETATION bullets, verbatim. Their `relates_to_fields` are hand-labelled, and their
  provenance comes from git history where history recorded one; otherwise it says the reason
  was not recorded.
- The 80 padding rules are the non-building distractors frozen for Q17.
- `tasks.json` holds the tasks and `q18.py` the harness.

**Arms** (content identical, only rendering differs):

| arm | form |
|---|---|
| **A** prose | the INTERPRETATION bullets as the repo has them today. No field list, no provenance. |
| **B** structured | one `{ tool, relates_to_fields, meaning, provenance }` record per rule |
| **C** prose, same content | A's bullets, each followed by B's field list and provenance written as sentences |

B vs C isolates **form**. C vs A isolates **content**: explicit field links plus history.

**Sizes:** `small` has the 32 real rules. `large` adds the 80 padding rules, 112 in all,
which is the ceiling check.

**Tasks** (ground truth by rule id; T2 and T3 are computed from `relates_to_fields`):
- **T1, attribution** (4 failing traces): which field the failure points at, whether a rule
  already covers it, and whether to edit or add. One trace (T1b, the survey-date fields) has
  no covering rule.
- **T2, orphans** (3 schema changes): list every rule to update. T2a renames
  `gebruiksoppervlakte_thermische_zone_m2`. T2b removes the two EMG-forfaitair fields. T2c
  renames `gasNormalizationFactor`. Half of T2a/T2b's targets name the field only in
  abbreviated form ("gebruiksoppervlakte populated", "EMG forfaitair = null"). That is this
  repo's real prose, not a planted trap.
- **T3, coverage:** list the `get_building_profile` fields no rule says anything about.
  Six borderline fields whose coverage is a matter of judgment (gebouwklasse, gebruiksdoel,
  candidateCount, aantal_verblijfsobjecten, coordinaten.lat/lon) are excluded from scoring,
  so the author's labelling cannot manufacture the effect.
- **T4, provenance** (2 proposed edits):
  - T4a: delete the CALCULATED vs MEASURED rule. Its recorded history is benchmark-trap
    0/60 → 59/60.
  - T4b: revert the floor-area rule to "10–30% lower". That exact wording was replaced in
    #33.
  - Hand-scored. B/C are correct if they cite the recorded history. A is correct if it says
    nothing is recorded and invents none. **Fabricated** means any arm asserting a history
    detail the source does not contain.

**Scoring:**
- T1 is correct only if the field, the edit/add verdict and (where one exists) the covering
  rule are all right.
- T2 counts recall and precision over rule ids.
- T3 counts F1 over the scored fields.
- Quoted rules are mapped to ids by their first words, and unmatched quotes are counted.

**Run:** sonnet and opus, both sizes, all three arms. Reps: T1 ×2, T2 ×2, T3 ×5, T4 ×2.
That is 23 runs per cell and **276 runs**. Results are pooled over items and sizes unless
the size is named.

**Predictions:**
- **P1, T2 content:** B recall ≥ A recall + 10 pp, pooled. Falsified if the lead is
  < 5 pp.
- **P2, form:** |B − C| ≤ 5 pp on T2 recall AND on T3 F1. Falsified if either gap is
  ≥ 10 pp.
- **P3, T3 content:** B F1 ≥ A F1 + 15 pp. Falsified if the lead is < 8 pp.
- **P4, T1:** every arm ≥ 85% correct, spread ≤ 10 pp. Strong models find the rule a trace
  points at in either form. Falsified if any arm is < 75%, or the spread is ≥ 15 pp.
- **P5, T4a:** B and C cite the recorded evidence in ≥ 90%, and A fabricates a specific
  history in ≤ 10%. Falsified if A fabricates in ≥ 25%, or B or C cite in < 75%.
- **P6, size:** A's T2 recall drops ≥ 5 pp more from small to large than B's. Falsified if
  A drops no more than B.

**Decision rule, fixed now:**
- **B ≥ C + 10 pp on T2 or T3:** 2c stands as written. Structure itself helps the improving
  agent.
- **C within 5 pp of B, and both ≥ A + 10 pp:** 2c is rewritten as *record field links and
  provenance per rule, in any form*. The structured form becomes a convenience (it is what
  projection needs), not the finding.
- **A within 5 pp of B on T1–T3:** 2c's authoring case rests on provenance (T4) alone.

**Stated limits:**
- One-shot and without tools. A real improving agent can grep, which narrows the gap on
  explicitly named fields; the abbreviated references are where grep does not help.
- The fields were labelled once, by the experimenter, with no second rater.
- The loop's second half is not measured: whether the edit then fixes the eval answer.

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
2. **~~Q10 next.~~ SUSPENDED 2026-09-23** (see its amendment): once delivered,
   `overheating` is 20/20 through every channel, so no question in the set is left for
   `relates_to_fields` to fix. **Q8 moves up to next**, run with the cap raised.
   *Superseded text follows.* **Q10 next.** The highest-value open question now that Q4 has landed: it is the only
   untried mechanism aimed at this repo's most stubborn failure — 2 correct in 21 on
   `overheating`, with both prose and renaming already falsified (Q5, Q6) — and it is
   registered as a null, so a win would be the surprise and a loss retires a fashionable
   primitive before it reaches a guide.
3. **~~Q8, then Q9's distance half.~~ DONE 2026-09-23:** Q8, Q8b and Q9 are answered. Next
   is Q11's `select-blind`, then Q12. *Superseded text follows.* **Q8, then Q9's distance half.** Q8 builds the arm that Q9's distance protocol needs,
   so one deploy serves both. Q9's position half (`inline-head`) can ride along with
   anything; it is a one-line arm.
4. **~~Q11~~ DONE 2026-09-23. ~~Q12~~ RUN 2026-09-23 on weather: the first question had no headroom; the second (single quarter) replicated delivery-not-channel on sonnet and failed on haiku.** The register is closed except the external-validity gate, which needs a public second domain. Q10 is suspended
   and Q9's position half is retired.
   *Superseded text follows.* **Q11: the main half is answered by accounting on this host (see its amendment); only
   `select-blind` (built off `minimal`) and the meanings half remain.**
   *Superseded text follows.* **Q11 whenever there is spare batch capacity.** Cheap, and it tests an assertion the
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

---

## Q19 — Does the skill's reference arm (`best`) hold every answer the old reference won, and fix the ones it lost?

> **ANSWERED 2026-09-24 — a safe reference, with one new defect of its own.** See
> [`results/2026-09-24-q19-best-arm.json`](results/2026-09-24-q19-best-arm.json). 790 runs, audit exact.
>
> - **Confirmed:** P1, P2, P3, P5, P7, P8, P9, P10. **Partial:** P4 (16/20). **Falsified:** P6 (both
>   margins stated 10/20).
> - **P2 in numbers:** `best` 20/20 · 9/10 · 10/10 on `benchmark-trap`, `rich` 0/20 · 0/10 · 0/10. The
>   opus and sonnet cells follow the hand-read erratum in the results file: `rich`-opus's six
>   "correct" answers were hedged verdicts.
>   The old reference loses the question it was built to win, exactly where the audit said.
> - **Held-out:** `best` 19/20 · 10/10 · 10/10, `rich` 0/20 · 5/10 · 10/10.
> - **Unpredicted:** `weather-partial-normalization` `best` 0/10 against `rich` 10/10. The shipped
>   reference moves with the query year, so two periods are normalised to different denominators
>   (6.6% where 3.6% is right). *Shipped data must be comparable across calls*: a new rule, recorded
>   in the skill.
> - **Infrastructure:** `best`'s first reference fetch cost ~260 Open-Meteo weighted calls and
>   exhausted the quota mid-run. Fixed (window-sized, sequential, cached) and re-run.

> **REGISTERED 2026-09-23, BEFORE ANY RUN.** The arm was built and deployed first
> (`mcpBest`, verified live: variant stamped, reference period 1,231.3 for Q1 2024 and
> 2,188.4 for Oct 2023–Mar 2024, both matching independent computations). The held-out
> question `heating-season-held-out` was written after the build and before any run; it was
> not used to tune the arm. That is weaker than freezing it before the build, and is said here
> so nobody reads it as more.

### Why it matters

The `rich-domain-mcp-server` skill was rewritten on the eval evidence (its
`references/evidence.md` ledger) and then run, as its own audit flow, on this repo's `rich`
tools. The result is `best`: a COMPOSITE. It changes many layers at once on both data tools:

- renamed fields;
- descriptions of 1,719 and 1,680 characters (inside the 2,048 cut);
- `interpretation`-first responses from a rule registry;
- computed `derived` values;
- a shipped reference period for partial weather windows;
- no Paris Proof threshold anywhere.

This question cannot attribute an effect to any one layer; the one-variable arms already did
that. It asks whether the skill's output is a **safe reference**: does it keep every answer
`rich` got right, fix the ones `rich` gets wrong, and not break anything new — on the old
set, and on one question it was not built against.

The audit predicts one place where `rich` should now LOSE: its own computed alert compares
EP-1 with Paris Proof 70 kWh/m² on exactly the `benchmark-trap` record
(`docs/building-profile-findings.md` §7).

### Arms

- `best`.
- `rich`, the old reference.
- `inline` on three building questions only, as the token baseline: its neighbour tools are
  minimal, like `best`'s, so its token cost is the fair comparison.

The eval agent body is identical across arms. Default description cap throughout.

### Run

Headless `claude -p` parent per wave (the parent session predates `eval-best`). Every arm of
a wave is in the same parent, at most 3 subagents per arm per wave (rate limit). Only the
question string is passed.

| tier | model | n | questions | runs |
|---|---|---|---|---|
| A | haiku | 20 | benchmark-trap, absent-sizing-input, total-vs-per-m2, heat-pump-triage, building-size, weather-single-quarter, select-hides-the-evidence, heating-season-held-out | 320 (best + rich) |
| A′ | haiku | 10 | benchmark-trap, absent-sizing-input, total-vs-per-m2 | 30 (inline) |
| B | sonnet | 10 | benchmark-trap, total-vs-per-m2, gas-estimate, select-hides-the-evidence, weather-single-quarter, heating-season-held-out, metered-vs-model, invented-label | 160 |
| B′ | opus | 10 | benchmark-trap, gas-estimate, weather-single-quarter, heating-season-held-out | 80 |
| C | haiku | 10 | gas-estimate, wrong-unit, overheating, metered-vs-model, invented-label, weather-partial-normalization, solar-yield-check, forecast-normalization, select-blind, select-wrong-degree-day | 200 |

Total 790 runs.

### Scoring

- Each question's own `ground_truth` / `_judge_note`, in the parent session.
- A deterministic rubric per question (numbers within tolerance, forbidden figures,
  required caveats) is applied first, and every run the rubric cannot classify is read by
  hand.
- **Amendments, registered now:**
  - A scorer that matches a field name accepts the `best` name
    (`warmtebehoefte_berekend_kwh_m2` for `warmtebehoefte_kwh_m2`, and so on).
  - On `weather-single-quarter`, a `best` answer that normalizes by the shipped
    reference (≈ 4,675 m³, ± 100) is CORRECT; `rich` is scored as before.
  - On `weather-partial-normalization`, normalizing both quarters to the 10-year reference
    is CORRECT if the improvement comes out at 3.6 ± 1%.
- Tokens, calls and duration come from the child transcripts, and calls are reconciled
  against `get_tool_call_log`.

### Predictions

| # | prediction | falsified if |
|---|---|---|
| P1 | `best` ≥ 9/10 (haiku ≥ 18/20) in every building cell | any `best` building cell ≤ 7/10 (≤ 14/20) |
| P2 | `benchmark-trap`: `best` ≥ 9/10 on every model; `rich` ≤ 3/10 on haiku and sonnet (its alert asserts the verdict) | `best` ≤ 7, or `rich` ≥ 7 on either model |
| P3 | `absent-sizing-input`, haiku: `best` ≥ 18/20, ≤ 3 fabrications | `best` ≤ 14/20 |
| P4 | `weather-single-quarter`, haiku: `best` ≥ 17/20 (Q16's 15/20 plus the null factor); median 1 weather call on sonnet and opus | `best` ≤ 12/20 |
| P5 | `select-hides-the-evidence`, sonnet: `best` ≥ 9/10 against ~0/10 for `rich` | `best` ≤ 6/10 |
| P6 | `heat-pump-triage`, haiku: ≥ 18/20 with both small margins (2.73, 0.88) stated | < 15/20 |
| P7 | Controls (`metered-vs-model`, `invented-label`): `best` 10/10 on every model run | any miss, and it is reported before anything else |
| P8 | Median tokens: `best` within ± 10% of `inline` on the three shared questions, and below `rich` on at least 6 of the 8 tier-A questions | `best` > `rich` + 10% on 3 or more tier-A questions |
| P9 | No `best` result is replaced by a file notice | any |
| P10 | `heating-season-held-out`: `best` ≥ 16/20 on haiku and ≥ 9/10 on sonnet and opus | `best` ≤ 12/20 on haiku |

**Reasoning.** Every mechanism `best` carries was measured to work on its own: delivered
lines 20/20 (Q15), computed values 78/78 (L1), shipped reference data 15/20 on haiku (Q16),
null-field notes 18/20 (AS), calculated-vs-measured 59/60 (BT). The composite could still
fail by interaction. For example, renamed fields could break a question whose wording
names the old field, or a larger `interpretation` could crowd out the data. P1 and P7 are
there to catch that. P2 is the strongest claim, because it predicts the old reference
getting WORSE than `best` on a question the old reference was built to win.

**Cost:** 790 subagent runs.

### Q19b — Do the two fixes repair the two weather defects Q19 found? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24.** See [`results/2026-09-24-q19b-weather-fixes.json`](results/2026-09-24-q19b-weather-fixes.json).
> 60 runs, haiku; audit exact.
> - **P1 confirmed.** `weather-partial-normalization` `best` 8/10 (Q19: 0/10). The 2 misses asked
>   for an address without calling.
> - **P2 partial.** `weather-single-quarter` `best` 18/20, but 5 of the 18 still annualised
>   (predicted ≤ 3).
> - **P3 confirmed.** `rich` scores 8/10 and 0/20.

> **REGISTERED before any run.** The fixes are deployed and verified live:
> - Q1 2023 and Q1 2024 now share one reference (1,231.3, windows ending 2014–2023), and the live
>   two-period improvement is 3.6%.
> - Held-out is unchanged (2,188.4 → 9,899).

**What changed in `best`:**
1. The reference span is fixed (`REFERENCE_END_YEARS`) instead of "the 10 years before this
   window".
2. The partial-window alert, the normalization alert and the description say the corrected figure
   is for that window and must not be scaled to a year.

The measured Q19 values do not move. Only comparability between calls and the annualising
instruction change.

**Run.** haiku, `best` vs `rich`, one batch per wave, same harness as Q19 (the portable one in the
skill's `references/harness/`):
- `weather-partial-normalization`, n=10 per arm;
- `weather-single-quarter`, n=20 per arm.

60 runs.

**Scoring.** As in Q19:
- `weather-single-quarter` is scored on the lead figure. Every correct answer that also offers a
  full-year extrapolation is counted as `annualised`.
- `weather-partial-normalization` is CORRECT at 3.6 ± 1% (or ~4,434 ± 60 m³).

**Predictions**

| # | prediction | falsified if |
|---|---|---|
| P1 | `weather-partial-normalization`: `best` ≥ 8/10 (Q19: 0/10) | `best` ≤ 4/10 |
| P2 | `weather-single-quarter`: `best` ≥ 17/20, and ≤ 3 of its correct answers annualised (Q19: 16/20, 10 annualised) | `best` ≤ 12/20, or ≥ 8 annualised |
| P3 | `rich` replicates Q19 in the same batches: partial ≥ 8/10, single-quarter ≤ 3/20 | `rich` partial ≤ 5/10 or single-quarter ≥ 7/20 |

Comparisons with Q19's `best` cells are cross-sitting: quote the direction only. The within-batch
`best` vs `rich` gap is the controlled comparison.

### Q19c — Do the remaining misses disappear once the head says "call it directly"? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24.** See [`results/2026-09-24-q19c-call-it-directly.json`](results/2026-09-24-q19c-call-it-directly.json).
> - **P1 confirmed.** 0 of 20 `best` runs asked for an address; there was a weather call in 30/30.
> - **P3 confirmed.** The quarter questions scored 10/10 and 9/10.
> - **P2 partial.** `best` called in 10/10, but was correct in 5/10. With the call made, the
>   remaining miss is reading: 5 runs give a whole-window factor without mentioning the 7 forecast
>   days the response's alert names.
>
> The pre-call gap is closed by the head. What is left is the known limit of response guidance
> on haiku (Q12b).

> **REGISTERED before any run.** Deployed and verified live: 1,776 chars, containing "CALL IT
> DIRECTLY".

**Why.** Every miss that remained after Q19b happened BEFORE the first call:
- haiku asked for an address and called nothing (3 of 30 runs);
- on a window ending in the future it asked for the gas figure and called nothing (8 of 10 in
  Q19).

No response rule can fix a call that is never made. Only the description head can.

**Change.** Two sentences go in the head:
- no address is needed — use city coordinates or the Utrecht default;
- call the tool even when the window ends in the future, because the response separates archive
  from forecast days.

The stand-alone "never weather-correct against forecast days" line leaves the head. The
response's forecast alert still says it.

**Run.** haiku, `best` vs `rich`, n=10 per arm, on `weather-partial-normalization`,
`weather-single-quarter` and `forecast-normalization`. 60 runs, the skill's portable harness,
same scoring as Q19/Q19b.

| # | prediction | falsified if |
|---|---|---|
| P1 | No `best` run on the two quarter questions asks for an address without calling (Q19b: 3 of 30) | ≥ 3 of 20 |
| P2 | `forecast-normalization`: `best` calls the weather tool in ≥ 8/10 and is CORRECT in ≥ 6/10 (Q19: 2/10, 0 calls in 8) | CORRECT ≤ 3/10 |
| P3 | No regression: `best` ≥ 8/10 on both quarter questions | either ≤ 6/10 |

### Q19d — Does renaming the description heads to the eight canonical blocks break anything? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24 — no.** See [`results/2026-09-24-q19d-canonical-blocks.json`](results/2026-09-24-q19d-canonical-blocks.json).
> - **P1 confirmed:** 10/10, 10/10, 9/10.
> - **P2 partial:** the refusal was answered with no call in 6/10.

> **REGISTERED before any run.** Deployed and verified live: building 1,800 chars, weather 1,781,
> both opening with `WHEN TO USE:`.

**Change.** The same content as in Q19c, now under the talk's eight block names, in the talk's
order. Weather RETURNS now lists the literal record fields. The load-bearing lines therefore sit
later in the description (≤ 1,500), but still inside the cut.

**Run.** haiku, `best` vs `rich`, n=10 per arm, 60 runs, on the three questions that lean most on
the description head:
- `metered-vs-model` — a refusal answered from the head alone, median 0 calls in Q19;
- `benchmark-trap` — the rule for every record, now under INTERPRETATION, after RETURNS;
- `weather-single-quarter` — the reference rule, now after RETURNS.

| # | prediction | falsified if |
|---|---|---|
| P1 | No regression: `best` ≥ 9/10 on each question (Q19/Q19c: 10/10, 20/20, 9/10) | any `best` cell ≤ 7/10 |
| P2 | `metered-vs-model` is still answered without a building call in ≥ 7/10 `best` runs | ≤ 4/10 |

## Q20 — Does removing `rich`'s EP-1 vs Paris Proof alert fix `rich` on benchmark-trap? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24 — no.** See [`results/2026-09-24-q20-rich-alert-removed.json`](results/2026-09-24-q20-rich-alert-removed.json).
>
> **Falsified:**
> - P1 — `rich` haiku 0/10;
> - P2 — `rich` sonnet 1/10, +3 hedged. This is the failure mode the registration named.
>
> **Confirmed:**
> - P3 — no "Paris Proof" misnaming on heat-pump-triage, 9/10;
> - P4 — `best` 10/10, 10/10, 9/10.
>
> The removal takes the false claim out of `rich`'s output. It does not deliver the missing fact
> that stops a model making the comparison itself. That fact is in `best` (head and response). In
> `rich` it sits past the cut.

> **REGISTERED before any run.** Deployed and verified live: `rich` on Gustav Mahlerlaan 10
> returns only the overheating alert.

**Change.** `rich` loses its computed "EP-1 above Paris Proof 2040 target" and "> 150 above
benchmark" alerts. The Paris Proof promise also goes from its alerts paragraph, its instructions
and its ep1 schema describe. The shared `interpretationBlock` line stays, but it sits past `rich`'s
2,048 cut and is not delivered. No other arm changed; the hash freeze proves it.

**Run.** `rich` vs `best` in the same batches, the portable harness, 60 runs:
- `benchmark-trap` on haiku and on sonnet, n=10 per arm each;
- `heat-pump-triage` on haiku, n=10 per arm.

| # | prediction | falsified if |
|---|---|---|
| P1 | `benchmark-trap`, haiku: `rich` ≥ 7/10 (Q19: 0/20) | ≤ 3/10 |
| P2 | `benchmark-trap`, sonnet: `rich` ≥ 7/10 (Q19: 0/10) | ≤ 3/10 |
| P3 | `heat-pump-triage`, haiku: `rich` stays ≥ 9/10 and calls the 100 kWh/m² band boundary a "Paris Proof" target in ≤ 2/10 (Q19: 8 of 20) | correct ≤ 7/10, or Paris Proof named in ≥ 5/10 |
| P4 | `best` unchanged: ≥ 9/10 in every cell | any `best` cell ≤ 7/10 |

**Why P1 could fail.** Without the alert and without a delivered CALCULATED vs MEASURED line
(`rich`'s sits past the cut), haiku may compare 81.68 with 70 unaided. In that case the fix
removes a false claim, but it does not add the missing fact.

## Q21 — Once the correcting fact is DELIVERED, does `rich` pass benchmark-trap? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24 — yes, completely.** See [`results/2026-09-24-q21-rich-line-delivered.json`](results/2026-09-24-q21-rich-line-delivered.json).
> benchmark-trap `rich`: haiku **10/10** (Q20: 0/10), sonnet **10/10** (Q20: 1/10); building-size
> `rich` 10/10; `best` 10/10 in every cell. All four predictions confirmed. All 20 `rich`
> benchmark-trap answers hand-read: every one declines the comparison (two quote the figure while
> declining, CORRECT under the hand rule). Audit exact 12/12 (30 + 30 calls). Q20 → Q21 is
> cross-sitting, so read it as direction; a 10-of-10 gap is far past the bar either way.

> **REGISTERED before any run.** Deployed and verified live: in `rich`'s description the CALCULATED
> vs MEASURED line starts at char 766 and its instruction ends at ~1,445, inside the 2,048 cut.

**Why.** Q20 removed `rich`'s false alert and `rich` still scored 0/10 (haiku), because the
correcting line sat at char ~3,380 and was never delivered. This adds the delivered half, and
changes nothing else. The shared `descriptionCore` / `interpretationBlock` are byte-identical;
only `rich`'s tools hash moves. The cost is QUERY STRATEGY item 5 (large panden), which now falls
past `rich`'s cut. `rich`'s large-pand alert still carries it in the response.

**Run.** `rich` vs `best`, same batches, the portable harness, 60 runs:
- `benchmark-trap` on haiku and on sonnet, n=10 per arm each;
- `building-size` on haiku, n=10 per arm, as the check on the cost.

Same hand rule as Q20: CORRECT declines a verdict, PARTIAL hedges one, WRONG gives it.

| # | prediction | falsified if |
|---|---|---|
| P1 | `benchmark-trap`, haiku: `rich` ≥ 7/10 (Q20: 0/10) | ≤ 3/10 |
| P2 | `benchmark-trap`, sonnet: `rich` ≥ 7/10 (Q20: 1/10) | ≤ 3/10 |
| P3 | `building-size`, haiku: `rich` ≥ 9/10 (Q19: 20/20) with QUERY STRATEGY item 5 now past the cut | ≤ 7/10 |
| P4 | `best` ≥ 9/10 in every cell | any `best` cell ≤ 7/10 |

**If P1 holds,** Q20 + Q21 together are the cleanest two-step result in the set. Removing a wrong
line leaves the error in place; delivering the right one fixes it.

## Q22 — Does applying the skill to the APP tools help, and what does it cost? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24.** See [`results/2026-09-24-q22-app-tools.json`](results/2026-09-24-q22-app-tools.json).
> - **The trap:** `best` leaves the Paris Proof line off the EP-2 bars and says why: haiku 6/10
>   (+4 drew it with the caveat), sonnet 10/10. `best-v1` draws it in 20/20, always with a caveat,
>   and also states the verdict in 9/10 haiku and 5/10 sonnet answers (`best`: 1/10, 0/10).
> - **The table headers failed:** every energy header says calculated in `best` 1/10, `best-v1`
>   0/10. The models translate the field name and drop "berekend" (P3 falsified; see Q22b).
> - **Payload guidance only matters where the input schema does not already show the shape.**
>   Positional map markers: `best` 20/20, `best-v1` 4/20. Chart tuples 28/28 vs 29/30.
> - **Controls and cost:** both controls at 10/10, 0 render errors, and +2–4% median tokens.
>
> P2, P4–P7 confirmed, P1 partial, P3 falsified. Audit exact 25/25.

> **REGISTERED before any run.** Audit: `docs/app-tools-findings.md`. `best` now carries rebuilt
> app tools (descriptions of 781–1,541 chars, domain-correct annotation examples, checks on the
> finished call under `interpretation.alerts`, `fetch_image` registered). `best` as measured in
> Q19–Q19d is frozen as `best-v1` (same wire hash as before). `tools/list`: 67.7k → 72.5k chars.

**Why.** No eval question so far touched the app tools, so the skill's claims about them are
unmeasured. The audit found one defect of the worst class in the set: the delivered input schema
offers a Paris Proof line as the example annotation, on a server whose energy figures are all
calculated. And the new descriptions cost ~4.9k characters on every turn.

**Run.** `best-v1` vs `best`, same batches, interleaved, the portable harness, haiku n=10 per arm on
the four questions of `evals/questions-apps.json`, plus `chart-paris-proof-line` on sonnet n=10
per arm. 100 runs. Scored on the render call's arguments (the harness captures every MCP call's
input) and, for the trap, on the answer by hand (the Q20 rule: CORRECT declines the line, PARTIAL
draws it with the caveat, WRONG draws it).

| # | prediction | falsified if |
|---|---|---|
| P1 | `chart-paris-proof-line`, haiku: `best` ≥ 8/10 CORRECT; `best-v1` ≤ 5/10 | `best` ≤ 5/10, or `best-v1` ≥ 8/10 |
| P2 | same on sonnet: `best` ≥ 9/10; `best-v1` ≤ 6/10 | `best` ≤ 6/10 |
| P3 | `table-label-figures`: every energy header says calculated in `best` ≥ 7/10, `best-v1` ≤ 3/10 | `best` ≤ 4/10 |
| P4 | `chart-weighted-hdd-2024`: both arms ≥ 9/10 (control; the data tool is identical) | either arm ≤ 7/10 |
| P5 | `map-two-buildings`: both arms ≥ 9/10, no swapped coordinates (control) | either arm ≤ 7/10 |
| P6 | cost: `best` median tokens within +10% of `best-v1` on every question | `best` > +10% on 2+ questions |
| P7 | render calls that error: `best` ≤ `best-v1` | `best` more errors |

**Failure mode to expect.** P1 may fail the other way: `best-v1`'s `get_building_profile` already
delivers the CALCULATED vs MEASURED line, so the chart-tool fix may add nothing on top of it. That
would say the data tool's own semantics carry to the render call, which is worth knowing.

## Q22b — Does a check on the finished table call fix what the description could not? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24 — no.** See [`results/2026-09-24-q22b-table-alert.json`](results/2026-09-24-q22b-table-alert.json).
> - **The headers:** `best` 2/10, `best-v1` 0/10.
> - **No run re-rendered after the alert** (0/10).
> - **The prose:** the alert does reach it. 9/10 `best` answers say the figures are calculated
>   (`best-v1` 5/10).
>
> A response alert after a successful render is read as a note, not as a reason to redo the call.
> A fix that must happen needs the call refused with the fix in the message, or applied by the
> server. P1 and P2 falsified, P3 and P4 confirmed. Audit exact 5/5.

> **REGISTERED before any run.** Q22 found `table-label-figures` at `best` 1/10, `best-v1` 0/10:
> the models translate `ep2_primair_fossiel_berekend_kwh_m2` into "EP-2 primary fossil energy
> (kWh/m²)" and the provenance falls out, although `best`'s table description says to keep it.

**Change, one variable.** `best`'s render_table now answers with `interpretation.alerts` naming any
header (or transposed row label) that names a label energy figure without saying it is calculated
(`tableAlerts`, `src/tools/app-tools-best.ts`). The wire surface is unchanged, and the freeze hash
of `best` did not move. `best-v1` is unchanged.

**Run.** `table-label-figures`, haiku, `best-v1` vs `best`, n=10 each, same batches. Scored on the
LAST successful render_table call (a re-render after the alert counts).

| # | prediction | falsified if |
|---|---|---|
| P1 | `best` ≥ 7/10 CORRECT (was 1/10) | ≤ 4/10 |
| P2 | `best` re-renders after the alert in ≥ 6/10 runs | ≤ 3/10 |
| P3 | `best-v1` ≤ 2/10 (control) | ≥ 5/10 |
| P4 | `best` median tokens ≤ +25% of `best-v1` (a re-render costs a call) | > +40% |

## Q22c — Does REFUSING the call fix what the alert could not? Registered 2026-09-24, BEFORE the run

> **ANSWERED 2026-09-24 — yes.** See [`results/2026-09-24-q22c-table-refusal.json`](results/2026-09-24-q22c-table-refusal.json).
> - **Headers:** `best` 10/10 say calculated (Q22: 1/10, Q22b: 2/10); `best-v1` 0/10.
> - **How:** 6/10 runs were refused, retried and rendered. All 10 ended with a table.
> - **Cost:** +4.9% tokens.
>
> All four predictions confirmed. Audit 4/5 exact; the one extra call was rejected by the host as
> unparseable JSON before it reached the server.

> **REGISTERED before any run.** In Q22b the alert on a successful table render fixed 2/10 headers
> and triggered 0/10 re-renders. This tests the rule added to the skill from it — "a fix that must
> happen is a refusal, not an alert" — before the release.

**Change, one variable.** `best`'s render_table now refuses the call (`isError`, "Not rendered. …
say so in the header … and call render_table again") when a header or transposed row label names a
label energy figure without saying it is calculated. It uses the same check as Q22b. Wire bytes
unchanged. `best-v1` unchanged.

**Run.** `table-label-figures`, haiku, `best-v1` vs `best`, n=10 each, same batches. Scored on the
LAST successful render_table call.

| # | prediction | falsified if |
|---|---|---|
| P1 | `best` ≥ 8/10 CORRECT (Q22b: 2/10) | ≤ 5/10 |
| P2 | every refused `best` run retries, and ≥ 9/10 end with a rendered table | ≤ 7/10 rendered |
| P3 | `best-v1` ≤ 2/10 (control) | ≥ 5/10 |
| P4 | `best` median tokens ≤ +20% of `best-v1` (the retry costs a call) | > +35% |

## Q23 — Does the chart and table guidance make the model choose the right FORM from the data? Registered 2026-09-24, NOT YET RUN

> **ANSWERED 2026-09-24 — of 14 chart types, 2 are used, and the rules do one thing.** See
> [`results/2026-09-24-q23-chart-choice.json`](results/2026-09-24-q23-chart-choice.json). 240 runs.
>
> **Which forms were chosen.** Text 137, bar 50, line 26, table 24, pie 3, polarArea 2. Every chart
> was a bar or a line, apart from 3 pies and 2 polarArea (sonnet, on months, which the rules allow).
>
> **What the rules changed.** On 12 monthly shares, haiku without the per-type rules drew a
> 12-slice pie in 3/10 runs; with the rules, 0/10 in both arms. Every other cell was identical in
> all three arms: 10/10 no chart for a single number or two labels, 10/10 line or bar for the
> trend, sonnet 10/10 everywhere.
>
> **Cost.** Without the rules, 1.9–4.6% fewer tokens in all 8 cells.
>
> P2–P5 confirmed; P1 partial (3/10 without the rules, where ≥ 5 was predicted). The pies came
> back with the pie alert and were not re-rendered, the Q22b pattern again. Audit 38/40 exact: the
> two extra calls were validation refusals the handlers did not log, now fixed.
>
> **Caveat.** One domain. Its data is series, a few categories or single values; hierarchies, flows
> or distributions would give treemap, sankey and boxplot a chance this set does not.

> **REGISTERED before any run.** Question set: `evals/questions-chart-choice.json`. Arm C is built
> as the frozen variant `best-no-type-rules`: the `type` describe drops from 2,769 characters to 11
> ("Chart type."), and `tools/list` from 72.5k to 69.8k. The render tools now also log the shape
> they were called with (chart type, counts), so the demo's own traffic answers "which types are
> used" alongside this run.
>
> **Tiers (fixed now).** haiku n=10 per arm on all six questions (180 runs); sonnet n=10 per arm on
> `choice-share-per-month` and `choice-three-measures-two-buildings` (60 runs). 240 runs, waves of
> 3 arms × 2, interleaved.

**Why.** Q22 never tested the choice itself. Its questions named the form ("in a chart", "in a
table", "on a map"), and its chart question accepted line and bar alike. Three things are
unmeasured:
- the per-type REFUSE rules on `render_chart`'s `type` parameter (delivered in the input schema:
  pie at most 5 slices, no line on a categorical axis, radar at most 3 overlays, …);
- `rich`'s question-first decision path, which mostly falls past the 2,048 cut;
- whether the model renders at all when text or a small table would do.

**Questions.** Six questions where the data shape decides the right form and the question names
none: 12 shares of a year, a trend, 3 measures × 2 buildings, 2 labels, a list of dates, a single
number. Each has an acceptable and a wrong list, taken from the `type` rules themselves.

**Arms.** Three, to see where the guidance comes from:
- A — `best-v1`: no chart description, the REFUSE rules in the input schema;
- B — `best`: a short description, the same schema rules;
- C — `best` with the REFUSE rules stripped from `type` (to build; wire-frozen as its own
  variant). C separates "the schema rules work" from "models choose well on their own".

**Scoring.** From the captured arguments: the tool called (or none), `type`, the number of slices
or series. Each run scores CORRECT (acceptable form), WRONG (a listed wrong form), or OTHER
(hand-read).

| # | prediction | falsified if |
|---|---|---|
| P1 | `choice-share-per-month`, haiku: pie or doughnut in ≤ 2/10 with the rules (A, B), ≥ 5/10 without (C) | C ≤ 2/10 (the rules are not what prevents it) |
| P2 | `choice-single-number` and `choice-two-labels`: no render_chart in ≥ 9/10, every arm | any arm ≤ 7/10 |
| P3 | `choice-trend-over-year`: line or bar ≥ 9/10, every arm (ceiling) | any arm ≤ 7/10 |
| P4 | B ≥ A on every question (the description's WHEN NOT TO USE adds to the schema rules) | A > B by ≥ 3 on any question |
| P5 | sonnet chooses correctly ≥ 9/10 on every question in every arm | sonnet ≤ 7/10 anywhere |

**Failure mode to expect.** Models may choose well without any rules (C at ceiling). The honest
result is then that the `type` rules are volume, paid on every turn (~3k characters), and a
candidate to trim.

## Q24 — Can the decision tree reach all 14 chart types when the data calls for them? Registered 2026-09-24, BEFORE the pilot

> **PILOT ANSWERED 2026-09-24.** See [`results/2026-09-24-q24-chart-paths-pilot.json`](results/2026-09-24-q24-chart-paths-pilot.json).
>
> **Three paths were broken on every tier by the input schema, not by the choice.** The model
> picked scatter, bubble and boxplot correctly, and render_chart refused the call (every dataset
> required `data`; these types carry `scatterData` or `samples`). It then fell back to line or bar.
> Repaired: `data` is optional. After that, 3/3 in every arm.
>
> **The one real choice problem was polarArea.** On a weekly cycle, the decision-tree arm chose it
> 5/6; the other two arms chose bar 6/6.
>
> **Paths reached:** decision tree 14/14; `best` and no-rules 13/14. The per-type rules alone
> changed nothing measurable.
>
> **Why the schema defect stayed hidden.** A schema refusal happens in the SDK, before the handler,
> so it never reaches the server's call log: 54 calls in round 1 exist only in the transcripts.
>
> P1 and P3 confirmed, P2 and P4 falsified. Next: confirm at n=10 on haiku and sonnet.

> **REGISTERED before any run. Pilot first**, per the loop: find the broken paths, repair only
> those, then confirm at n=10 with new predictions.

**Why.** Q23 showed that this server's data only ever asks for bar or line, so whether the other
12 paths work was untested. This builds the data: `evals/questions-chart-paths.json` has one
question per chart type, with the data in the prompt and no type named. The structure of the data
is what should decide the type (a flow, a subset funnel, a network, a hierarchy, a grid, samples
per category, three measures, two measures, a trend, a cycle, shares, a profile, a ranking).

**Arms:**
- A — `best`: the per-type REFUSE rules on `type`.
- B — `best-no-type-rules`: the enum only.
- C — `best-decision-tree`: a question-first decision path ("decide from what the data IS: flows →
  sankey, subset stages → funnel, …") placed ABOVE the same rules on `type`, where it is delivered
  (3,829 characters). `rich` has a comparable path in its description, but that one falls mostly
  past the cut.

**Pilot.** haiku, n=3 per path per arm, 126 runs, waves of 9 (3 arms × 3). Scoring is by the type
of the last successful render_chart:
- CORRECT: the target type;
- ACCEPTABLE: a listed alternative;
- WRONG: any other type;
- FAILED: no chart was rendered.

A path counts as REACHED when at least 2 of its 3 runs are CORRECT.

| # | pilot expectation | falsified if |
|---|---|---|
| P1 | A reaches ≥ 9 of 14 paths | ≤ 6 |
| P2 | B reaches fewer paths than A, and the gap is in the structure paths (sankey, funnel, graph, treemap, matrix, boxplot, bubble) | B ≥ A |
| P3 | C reaches ≥ as many paths as A, and at least one path A misses | C < A |
| P4 | line, bar, scatter and sankey are reached by every arm (the data leaves little choice) | any of them missed by 2+ arms |

> **CONFIRMATION ANSWERED 2026-09-24.** See [`results/2026-09-24-q24-chart-paths-confirm.json`](results/2026-09-24-q24-chart-paths-confirm.json). 560 runs, audit exact 56/56.
> - **All 14 paths work when the data calls for them**, apart from polarArea without the tree. The
>   13 other paths score 9–10/10 in both arms on both models, including scatter, bubble and
>   boxplot. There were 0 schema refusals.
> - **polarArea on a weekly cycle:** `best` chose bar 20/20. The decision tree chose polarArea
>   16/20 (haiku 6/10, sonnet 10/10).
> - **The tree changes nothing else** (every other gap ≤ 1) and costs +0.7–1.6% tokens.
>
> P7–P9 confirmed. P5 and P6 partial: haiku's 6/10 falls short of the predicted 7 and of the 8
> that counts as reached.

**Confirmation, registered 2026-09-24 BEFORE its run.** Limited to the two arms that matter:
- A — `best`;
- C — `best-decision-tree`.

It runs on haiku AND sonnet, n=10 per path per arm per model: 14 × 2 × 2 × 10 = 560 runs, waves of
10 (5 + 5, interleaved), on the repaired schema. A path is REACHED at ≥ 8/10 CORRECT.

| # | prediction | falsified if |
|---|---|---|
| P5 | haiku: C reaches all 14 paths | any path ≤ 5/10 in C |
| P6 | polarArea: A ≤ 3/10 and C ≥ 7/10, on haiku; on sonnet A ≤ 5/10 and C ≥ 8/10 | C ≤ A + 3 on either model |
| P7 | the 13 other paths: A and C within 2 of each other on every path and model (the tree changes only the path it was written for) | a gap ≥ 4 on any other path |
| P8 | 0 schema refusals (-32602) on scatter, bubble and boxplot, in both arms | any |
| P9 | C costs ≤ +3% median tokens over A (the tree adds ~1,060 characters to `type`) | > +6% |

## Q25 — Do the lean app-tool input schemas lose anything, and what do they save? Registered 2026-09-24, BEFORE the run

> **REGISTERED before any run.** Input schemas are delivered in full and re-sent every turn
> (`results/2026-09-24-input-schema-delivery.json`). So their size is paid on every call, used or
> not. `best-lean` (temporary) has the same schema structure as `best`, and a test pins it; only
> the words differ. Chart input 21.7k → 10.6k characters, table input 20.2k → 5.9k, `tools/list`
> 73.6k → 48.3k (−34%). The decision tree stays; the per-type rules shrink to the caps.

**Run.** `best` vs `best-lean`, haiku, n=5 per cell, same batches, interleaved. 220 runs:
- the 14 chart paths of Q24;
- the six form-choice questions of Q23;
- `table-label-figures` and `chart-paris-proof-line` of Q22.

| # | prediction | falsified if |
|---|---|---|
| P1 | no loss: `best-lean` within 1 of `best` on every cell (n=5) | a cell with `best-lean` ≥ 2 below `best` |
| P2 | polarArea still reached by `best-lean` (the tree is unchanged) ≥ 3/5 | ≤ 1/5 |
| P3 | table headers still carry "berekend/calculated" in the final table: `best-lean` ≥ 4/5 (the refusal is unchanged) | ≤ 2/5 |
| P4 | cost: `best-lean` median tokens ≥ 10% below `best` on every question group | < 5% on any group |

**Amended 2026-09-24, still BEFORE any run: a third arm.** The owner questioned a large input
schema for a plain bar chart. `best-guided` (temporary) makes render_chart's schema small (4.9k):
the decision tree, plain labels and tuple datasets. Every other shape comes from a new
`get_chart_guidance(type)`, which the `type` describe makes a REQUIRED first call for anything but
a plain bar or line (a hint alone is not followed [Q8b]). The handler still checks the full shape
(the lean schema) and refuses a mismatch with the shape for that type in the message.
`tools/list` 41.4k (best 73.6k, lean 48.3k). Arms: `best`, `best-lean`, `best-guided`; 22
questions × 3 arms × n=5 = 330 runs, haiku.

| # | prediction | falsified if |
|---|---|---|
| P5 | no loss: `best-guided` within 1 of `best` on every cell (n=5), including the 12 non-bar/line paths | a cell ≥ 2 below `best` |
| P6 | the pointer is followed: get_chart_guidance is called before render_chart in ≥ 4/5 runs of every non-bar/line path, and in ≤ 2/5 of the plain bar/line questions | < 3/5 on any non-bar/line path |
| P7 | every shape refusal in `best-guided` is followed by a rendered chart | any refused run that ends without a chart |
| P8 | cost: on the Q23 questions (mostly text, bar, line), `best-guided` median tokens ≤ `best-lean`; on the 12 non-bar/line paths `best-guided` ≤ `best-lean` + 5% despite the extra call | guided > lean + 5% on the Q23 group |

> **ANSWERED 2026-09-24 — a smaller schema loses nothing measurable and saves a fifth to a third
> of every run.** See [`results/2026-09-24-q25-lean-vs-guided-schemas.json`](results/2026-09-24-q25-lean-vs-guided-schemas.json).
> 330 runs, haiku, n=5; audit 41/44 waves exact, 554 of 557 calls in the log (the 3 missing never
> reached a handler, or could not be traced).
>
> | | best | best-lean | best-guided |
> |---|---|---|---|
> | 14 chart paths correct | 66/70 | 70/70 | 67/70 |
> | 6 form-choice questions | 29/30 | 30/30 | 29/30 |
> | 2 traps (Paris Proof line, label headers) | 7/10 | 9/10 | 9/10 |
> | median tokens, 12 non-bar/line paths | 34.2k | 26.3k (−23%) | 24.4k (−29%) |
> | median tokens, form choice | 36.5k | 28.6k (−22%) | 26.3k (−28%) |
>
> P1–P5, P7, P8 hold. P6 mostly: the REQUIRED pointer was followed in 58/62 runs on the 12
> non-bar/line paths (pie 3/5, the rest 4–5/5) and 0/10 on plain bar/line. Guided's extra call is
> cheaper than the schema it replaces (−7% against lean). Guided missed three runs that lean did
> not (funnel drawn as sankey, boxplot as line without fetching guidance, polarArea as bar); at
> n=5 that is direction, not size. The lesson for the skill: the input schema is paid on every
> turn by every question, so it carries what forming a call needs and no more; a type-specific
> shape can move behind a REQUIRED guidance call without loss.

## Q25b — Is the guided schema as reliable as the lean one where it differs? Registered 2026-09-24, BEFORE the run

> **REGISTERED before any run.** Q25 left one question open: guided missed 3 of 70 chart-path runs
> where lean missed none (funnel as sankey, boxplot as line without fetching guidance, polarArea
> as bar). At n=5 that is noise or direction. This run decides which of the two goes into `best`.

**Run.** `best-lean` vs `best-guided`, haiku, n=10 per cell, the 12 chart paths other than bar and
line (the only paths where the two differ in what the model must do), interleaved 5+5 per wave, 24
waves, 240 runs.

| # | prediction | falsified if |
|---|---|---|
| P1 | both arms reach ≥ 9/10 on at least 11 of the 12 paths | either arm below 9/10 on 2 or more paths |
| P2 | no reliability gap: guided never ≥ 3 below lean on a path | a path with lean − guided ≥ 3 |
| P3 | the pointer is followed: get_chart_guidance before the first render_chart ≥ 8/10 on every path | < 6/10 on any path |
| P4 | cost: guided median tokens ≤ lean over the 12 paths, despite the extra call | guided > lean + 5% |

**Decision rule, fixed before the run:** guided goes into `best` if P1 and P2 hold for guided;
otherwise lean does. P3 and P4 inform the skill, not the choice.

> **ANSWERED 2026-09-25 — guided is as reliable as lean, and cheaper; guided goes into `best`.**
> See [`results/2026-09-25-q25b-lean-vs-guided-confirm.json`](results/2026-09-25-q25b-lean-vs-guided-confirm.json).
> 240 runs, audit 20/24 waves exact; the 4 missing calls never reached a handler (3 unparsable,
> 1 SDK schema refusal on lean). Correct: lean 118/120, guided 117/120; lean ≥ 9/10 on 12 of 12
> paths, guided on 11 of 12 (treemap 8/10: two runs answered in text, no chart). Largest gap 2.
> Pointer followed 114/120 (pie 6/10, where the small schema already shows the payload). Median
> tokens guided −7.6% against lean, at 2 calls instead of 1. P1, P2, P4 hold; P3 partly (pie).
> By the rule fixed before the run, guided goes into `best`.

## Q25c — Does the chart guidance need its own tool? Registered 2026-09-25, BEFORE the run

> **REGISTERED before any run.** `best` now sends the shapes of 12 chart types through a separate
> `get_chart_guidance(type)` (Q25b). That tool costs 935 characters in `tools/list`, on every turn.
> The owner asked whether the guidance could come from render_chart itself. `best-inline-guidance`
> (temporary) has no guidance tool. Its `type` describe says: for any chart other than a plain bar or
> line, first call render_chart with only `type`. That call renders nothing and returns the same
> guidance text. A wrong shape is still refused with the expected shape and an example.
> Everything else is byte-identical to `best`.

**Run.** `best` vs `best-inline-guidance`, haiku.
- The 12 non-bar/line chart paths at n=10 per cell.
- `path-bar` and `path-line` at n=5.
- 5+5 interleaved per wave, 26 waves, 260 runs.

| # | prediction | falsified if |
|---|---|---|
| P1 | no loss: inline ≥ 9/10 on at least 11 of the 12 paths, and never ≥ 3 below `best` on a path | inline below 9/10 on 2+ paths, or a gap ≥ 3 |
| P2 | the pointer is followed: a type-only render_chart call before the first rendering call ≥ 8/10 on every non-bar/line path; ≤ 1/5 on bar and line | < 6/10 on any non-bar/line path |
| P3 | cost: inline median tokens ≤ `best` over the 12 paths (one tool fewer on every turn, the same number of calls) | inline > `best` |
| P4 | a type-only call never renders a chart | any type-only call that renders (determinate; a test pins it) |

**Decision rule, fixed before the run:** the type-only call replaces `get_chart_guidance` in
`best` if P1 and P3 hold. Otherwise `best` keeps the tool. P2 informs the skill.

> **ANSWERED 2026-09-25 — the guidance keeps its own tool.** See
> [`results/2026-09-25-q25c-guidance-tool-vs-type-only-call.json`](results/2026-09-25-q25c-guidance-tool-vs-type-only-call.json).
> 260 runs, audit exact 26/26.
>
> | | best (`get_chart_guidance`) | inline (type-only render_chart call) |
> |---|---|---|
> | 12 non-bar/line paths correct | 119/120 | 113/120 (treemap 7, boxplot 8) |
> | guidance fetched before the first chart | 110/120 | 78/120 |
> | median tokens, 12 paths | 24.2k | 24.2k (+0.2%) |
>
> P1, P2 and P3 falsified, P4 holds. The model does not treat "call this tool with only `type`
> first" as a separate step: it tries the payload straight away, and when that is refused it
> sometimes falls back to bar or line. Saving one tool entry (932 characters) did not lower the
> cost. By the rule fixed before the run, `best` keeps `get_chart_guidance`.

## Q26 — Does the model use render_table's richer column types when the data calls for them? Registered 2026-09-25, BEFORE the run

> **REGISTERED before any run.** 227 tables were rendered in the Q22–Q25c runs. Their columns used
> only these types: number, text, date, badge, percentage and currency. Nine types never appeared:
> sparkline, progress, trend, rating, link, icon, image, multi_badge and boolean. Those questions
> seldom called for them, so absence is not proof. The Q24 lesson is to walk every branch with data
> built for it. Those types and their configs are about 2.6k of render_table's 7.9k characters in
> `tools/list`, paid on every turn. Before splitting them behind guidance (Q25), or cutting them from
> the menu (Q23), find out whether the model reaches them.

**Pilot.** `best`, haiku, n=5, 60 runs. 12 prompts in `evals/questions-table-paths.json`:
- the nine unused types;
- a badge control (energy labels);
- a footer total;
- search on 60 rows.

Each prompt carries its data and names no type. Scored on the last successful render_table call.

| # | prediction | falsified if |
|---|---|---|
| P1 | the menu works: at least 9 of the 12 paths reach the target or a listed alternative in ≥ 3/5 | fewer than 9 |
| P2 | the per-row shapes are reached: sparkline, progress and trend each ≥ 3/5 on the target itself | any of the three ≤ 1/5 |
| P3 | the controls hold: badge and footer ≥ 4/5 | either ≤ 2/5 |
| P4 | no path fails on a refusal: every refused render_table call is followed by a rendered table | a run that ends without a table after a refusal |

**What follows:**
- A path below 3/5 is traced to its cause: a refusal by the schema or the handler, the model's
  choice, or a chart drawn instead. The cause is fixed or recorded, then confirmed at n=10.
- Only if the menu works does a guidance split become a cost question for its own measurement.
- A type no prompt reaches is a candidate to cut.

Column types, footers and features are now logged in render_table's `shape`, never headers or values.

> **PILOT ANSWERED 2026-09-25 — the table menu works when the data calls for it; no guidance split.**
> See [`results/2026-09-25-q26-table-paths-pilot.json`](results/2026-09-25-q26-table-paths-pilot.json).
> 60 runs, audit exact 12/12, 0 of 54 render_table calls refused.
> - **Reached:** sparkline, trend, image, boolean and search 5/5; progress 4/5 (+1 percentage);
>   badge 5/5.
> - **Passed over for a simpler form that reads as well:** a 1–6 condition score went to a
>   coloured badge 5/5 (rating 0/5); installations per building went to a text list 5/5
>   (multi_badge 0/5); a status symbol went to badge 3/5 (icon 1/5). The schema itself names
>   badge for a status.
> - **Lost to form, not type:** link and footer runs sometimes answered in text without a table.
>   Every table drawn used the target: link 3/3, footer 2/2.
>
> P1, P2 and P4 hold; P3 is falsified on footer (2/5, no table drawn). The nine types were absent
> earlier because no question called for them. A split would be a cost question only: about 2.6k
> characters, a few percent per run after a guidance tool's own entry. `render_map` has four
> marker types of one line each and nothing to split.
