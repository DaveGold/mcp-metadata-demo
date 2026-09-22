# Results

What happened when the set was run. Each file records its own caveats; none of
these are measurements yet — n is 2–3 per cell and mostly Haiku.

| file | what it answers |
|---|---|
| [`2026-09-21-haiku-sweep.json`](2026-09-21-haiku-sweep.json) | Which questions separate the arms at all. Ran every core question thin-vs-rich before committing to a full matrix, and reshaped the set. |
| [`2026-09-21-n3-separators.json`](2026-09-21-n3-separators.json) | Do the separations reproduce? Found the variance effect the n=1 sweep could not see. |
| [`2026-09-21-opaque-prose.json`](2026-09-21-opaque-prose.json) | What interpretation guidance buys once field naming stops doing its job for it. |
| [`2026-09-21-guide-ablation.json`](2026-09-21-guide-ablation.json) | Which half of the guide does the work — glossary, or the derived-figure recipe. |
| [`2026-09-21-shape-replication.json`](2026-09-21-shape-replication.json) | Does that decomposition hold across question shapes? It does, and becomes a rule. |
| [`2026-09-21-first-harness-run.json`](2026-09-21-first-harness-run.json) | The first end-to-end run of the run-eval skill. Found the skill out of sync with the set, confirmed the overheating control does not separate, and records a retracted n=1 interpretation. |
| [`2026-09-21-per-question.json`](2026-09-21-per-question.json) | Per-question outcomes and per-regime results, kept out of `questions.json` so the set reads as a spec. |
| [`2026-09-21-opaque-live.json`](2026-09-21-opaque-live.json) | Does the shape replication survive live tool calls? It does not — five of six cells disagree, and the derived-figures recipe scores 0 of 3. |
| [`2026-09-21-opaque-live-sonnet-n10.json`](2026-09-21-opaque-live-sonnet-n10.json) | The confirmation pass for that run — sonnet, n=10, 60 runs. Confirms the recipe failure and shows the other two questions saturate on a stronger model. |
| [`2026-09-21-readable-ladder-gas.json`](2026-09-21-readable-ladder-gas.json) | The readable ladder on the one question with headroom, and the first measurement of the `schema` rung. 80 runs, two models. Server-computed beats everything at either tolerance; the ladder looked non-monotonic at tolerance 20 and that wobble does not survive the retightening to 8. |
| [`2026-09-21-readable-ladder-co2.json`](2026-09-21-readable-ladder-co2.json) | Is the gas result a property of the SHAPE? 120 runs, three models incl. opus. rich replicates at 30/30; the prose rung reverses sign and the reason is legible; opus needs no metadata here. |
| [`2026-09-21-readable-ladder-wrong-unit.json`](2026-09-21-readable-ladder-wrong-unit.json) | The question the `schema` rung exists for: `thin` has no `huisletter` parameter, so the call cannot be expressed. 72 runs, three models. thin 0/18, schema 18/18 — and the two ways thin fails are not the same. |
| [`2026-09-21-q1-response-channel.json`](2026-09-21-q1-response-channel.json) | **Q1 from `open-questions.md`, and both registered predictions are wrong.** Same guidance, description vs response. 210 runs, three models. The recipe in the RESPONSE scores 29/30 where the same 438 bytes in the DESCRIPTION score 4/30. **Its "+8 on sonnet" figure is a within-batch direction, not a stable size — see the variance warning below.** Also the first run to complete the `get_tool_call_log` audit — which found that the `inline` arm does not stamp its own log rows. |
| [`2026-09-21-q2-conditional-interpretation.json`](2026-09-21-q2-conditional-interpretation.json) | **Q2 from `open-questions.md`. Pruning the interpretation to the record is free, and saves almost nothing.** `inline` vs `inline-conditional`, 180 runs, three models. Accuracy 39/90 vs 39/90; tokens −1.84%, cheaper in all nine cells but never by more than ~1k. The question picked to show the cost, `benchmark-trap`, scored **0 of 10 in all six cells** — because the sentence the prediction feared the pruner would delete is not in the block at all, while the `ep1`↔70 line that causes the error survives pruning in both arms. First run whose call counts are fully reconciled against `get_tool_call_log` rather than caveated. |
| [`2026-09-21-benchmark-trap-calculated-vs-measured.json`](2026-09-21-benchmark-trap-calculated-vs-measured.json) | **The repair, and the biggest single effect in this directory.** The Q2 run found `benchmark-trap` scoring 0/60 because `interpretationBlock` never said the NTA 8800 figures are CALCULATED while Paris Proof is MEASURED. One sentence added, arms redeployed, same 60 runs: **0/60 → 59/60**, fabrications 22 → 0, confidently-wrong 1 → 0, `named_mismatch` 13/60 → 60/60, at a cost of ~260 tokens a call. Also records that the LIVE Warmtebouw Duurzaam server has the same defect and **server-computes the wrong verdict as an alert**. |
| [`2026-09-22-q4-fact-vs-instruction.json`](2026-09-22-q4-fact-vs-instruction.json) | **Q4 from `open-questions.md`, and the registered prediction is falsified on both of its own criteria — in the same direction on both questions.** The sentence that took `benchmark-trap` from 0/60 to 59/60 bundles a FACT and an INSTRUCTION; this splits them. 180 runs, three models, two questions. On `benchmark-trap`: both **30/30**, fact-only **25/30**, instruction-only **10/30**. The prediction was that instruction-only would match both and fact-only would trail badly. It is the other way round, and the mechanism is legible: the instruction is conditional ("where a question asks about a METERED benchmark…") and its trigger condition IS the withheld fact, so it cannot fire on a question that never says "metered". The control proves it — on `metered-vs-model`, where the question itself contains the word, instruction-only scores **30/30**, the exact inverse of the second registered prediction. So on this line semantics carry the behaviour and the behavioural clause is inert without them; the "specify behaviour, not semantics" reframing gets no support. Cheapest arm (−0.4%) is also the worst, so quality and cost still do not point the same way. opus is 10/10 on all three arms — the whole signal is haiku and sonnet. Audit reconciled 180/180, `unknown` bucket fully accounted for (all 9 rows predate the run). |
| [`2026-09-22-q2-cross-record-pruning.json`](2026-09-22-q2-cross-record-pruning.json) | **Q2's cross-record half — and the preflight overturned the premise it was commissioned on.** Three files in this directory claimed the CALCULATED vs MEASURED line is pruned on a NEN 7120 record. Measured on the wire, it is **not**: it is present, instruction clause and all, in BOTH arms on BOTH records. The pruner treats it as unconditional, so that test cannot be run. What was measured instead is the strongest version available: on Middenwetering 1 `inline-conditional` cuts the block **5,020 → 1,668 chars (−66.8%)**, the most aggressive pruning in the set. 60 runs, three models. Accuracy **30/30 vs 30/30** — pruning two thirds of the interpretation costs nothing. Tokens **−4.78%**, uniform across models (−4.73 / −4.81 / −4.79). So Q2's original conclusion survives and strengthens: pruning is free, and prose length is a weak cost lever. Consistent with Q4, where 516 chars moved cost by 0.4%. Audit reconciled 60/60, zero `unknown` rows on the page. |
| [`2026-09-22-absent-sizing-input-pilot.json`](2026-09-22-absent-sizing-input-pilot.json) | **SUPERSEDED — how the question was found, and an overclaim.** Found by reading the `GATES` table, not the data: every note is gated on its own field being non-null, so pruning removes exactly the guidance about **absent** fields. On Middenwetering 1 (NEN 7120) the three heat-pump sizing notes are all pruned together. Its 9/10-vs-4/10 headline came from 20 runs in two unequal, non-interleaved batches and did not survive a proper re-run — see the row below. Kept for the derivation and as a record of the overclaim. |
| [`2026-09-22-absent-sizing-input-haiku-n20.json`](2026-09-22-absent-sizing-input-haiku-n20.json) | **The first CONFIRMED case of conditional pruning being worse — and the variance warning that comes with it.** haiku, n=20 per arm, same-batch, audited 20/20 per arm. `inline` **18/20** correct with 3 fabrications; `inline-conditional` **10/20** with 10. The conditional arm invents heating-fraction splits and W/m² rates and returns kW figures. **But the two same-batch halves of this very run gave 8-v-7 and 10-v-3** — identical protocol, minutes apart. Four passes at n≤10 this session produced four different answers (9v4, 2v2, 8v7, 10v3), so on this question n=10 in one sitting can show anything from level to 3×. That is a caution for every n=10 result in this directory: large stable effects (0/60→59/60, Q4's 10/30 vs 30/30) are far outside this band, few-run gaps are not. Honest limit: pruning removes the note but not the null FIELD, so the model can still see the absence — hence 10/20, not 0. **haiku only; sonnet and opus were at ceiling on both arms.** |
| [`2026-09-22-absent-sizing-input-sonnet-n20.json`](2026-09-22-absent-sizing-input-sonnet-n20.json) | **The deciding cell — and the haiku effect does not survive it.** Same question, same protocol, sonnet, n=20 per arm, same-batch: **20/20 for BOTH arms, zero fabrications in 40 runs.** Against haiku's 18/20 vs 10/20, that settles it: conditional pruning's failure mode is real and large on the weakest model and **absent on sonnet** (opus 3/3 both arms, consistent). So the one-line `GATES` inversion proposed after the haiku run is **not warranted** — it would fix a defect only haiku shows, at the cost of the 66.8% prose saving on every record for every model. Why: the null FIELD is in the payload under both arms; sonnet reads `warmtebehoefte_kwh_m2: null`, knows unaided that it is the sizing input, and declines. The note supplies domain knowledge the stronger model already has. All 40 runs named the field explicitly, including the 20 where its note was pruned. Audit: 20 conditional rows for 20 runs; 21 inline rows because one run made a second 'duplicate check' call — identified, not absorbed. Four stray `rich` demo rows from outside this run were found in the first window and excluded. |
| [`2026-09-22-absent-sizing-input-opus-n20.json`](2026-09-22-absent-sizing-input-opus-n20.json) | **Completes the ladder — 120 runs across three models, and the effect is haiku-only.** opus, n=20 per arm, same-batch: **20/20 both arms, zero fabrications**, identical to sonnet. Full picture: haiku **18/20 vs 10/20** (fabrications 3 vs 10), sonnet **20/20 vs 20/20**, opus **20/20 vs 20/20**. So conditional pruning's failure mode is real on the weakest model and absent above it, now measured at full n rather than inferred from a 3-run check — and the `GATES` inversion stays unwarranted. Why: pruning removes the note, not the null FIELD; all 80 sonnet+opus runs name `warmtebehoefte_kwh_m2` and say it is null, including the 40 where its note was pruned. **This guidance buys nothing where the model already knows the domain, and a lot where it does not.** Audit: 41 rows for 41 completed runs — and the first concrete case here of a subagent's self-reported `CALLS: 3` being contradicted by the log, which is why the log is authoritative. One run lost to a classifier timeout; its partner discarded to keep pairs same-batch. |
| [`2026-09-22-q3-cost-decomposition.json`](2026-09-22-q3-cost-decomposition.json) | **Q3 answered — and the mechanism is neither of the two it registered.** Why does `rich` cost less than `words` despite carrying more? First, measured with **no runs at all**: `rich` pays **more** on input — tool definition +725 chars, response +788 (the alerts) — **~378 tokens every call**. So the saving must exceed the gap. 40 runs, two models, n=10, recording the ANSWER character count no earlier file here captured. haiku: gap 594 tokens, must save 972, ANSWER explains **11**. sonnet: gap 505, must save 883, ANSWER explains **40**. **Residual 99% and 95%.** Round trips confirmed as a rounding error (call counts differ in 1 of 20 pairs). Shorter output is real but explains 2–8%. **The mechanism is a third one: less to THINK** — identical call counts, comparable answer lengths, and `words` takes **1.63×/2.01× longer**. Quotable: richer metadata can be cheaper per run even though it is strictly larger on the wire, because the dominant cost is the model working out what it was not told. Caveat: `subagent_tokens` does not split input from output, so the residual is an inference. Audit reconciled exactly — 45 rows = 41 runs + 4 preflight. |
| [`2026-09-22-q5-deliberation-control.json`](2026-09-22-q5-deliberation-control.json) | **The attack on Q3 — and the first registered prediction in this repo to be CONFIRMED.** If the saving is deliberation it should vanish on a question `rich`'s alerts do not answer. `overheating`: `temperatuuroverschrijding` 3.59 is in both arms, and none of `rich`'s five alerts mention it. **The sign flips** — `rich` goes from **594 tokens cheaper** to **1,172 dearer**, and the duration ratio collapses from **1.63× to 1.01×**. So Q3's line needs its qualifier: the saving comes from metadata that answers *the question being asked*; irrelevant metadata is charged at list price on every call. Magnitude ran 3.3× over prediction because the alert payload is carried every turn, not once. **Separately and seriously: `overheating` is not working as a control** — 8/10 `rich` and 7/10 `words` asserted no-or-low risk against a ground truth of *significant*, inventing thresholds ('below the 40-hour standard', 'below 5 K') instead of using the one in the prose. That is README §2 again, and this time it defeats prose present in **both** arms. |
| [`2026-09-22-q6-overheating-naming.json`](2026-09-22-q6-overheating-naming.json) | **Is the `overheating` failure a naming problem? No — and the answer is worse than that.** Prediction falsified: `opaque-words`, which names the field `to` (no connotation) *and* says **"unitless"** with the 1.5 threshold in capitals, scored **0/7** against `words`' 2/7. Three of its runs ignored the field entirely and invented `ahe` (the renewable share) as an overheating indicator. The regimes fail differently — the readable name gets the model to the right field then misleads it on units (3.59 read as hours, or as degrees); the terse name loses it altogether. **This contradicts `_the_rule`:** interpretation-shape question, semantics explicit in two arms, **2 correct out of 21**. Third failure to replicate the rule and the clearest, since the guidance here is spelled out rather than merely present. **Conclusion: a defect in the shipped tool that prose will not fix.** `generateAlerts` computes the gas figure and heat-pump suitability but nothing for `temperatuuroverschrijding` — which is why Q5 found `rich` no better than `words`. The fix is the `benchmark-trap` playbook: compute it server-side. |
| [`2026-09-22-overheating-alert-verification.json`](2026-09-22-overheating-alert-verification.json) | **The fix, deployed and re-run — `rich` 2/10 → 10/10.** Q6 showed prose could not carry the overheating threshold, so the verdict is now computed in `generateAlerts`. Deployed, verified live, re-run haiku n=10 per arm. **All ten `rich` runs use the alert's own framing** — 'significant', 'exceeds the 1.5 threshold', several naming TOjuli/GTO — language that did not exist in any arm before the deploy. The benchmark-trap playbook reproducing on a harder defect: harder because there prose worked and here it demonstrably did not. **Caution reported alongside: `words` moved 3/10 → 7/10 with no code change**, so part of the gain may be the same n=10 drift found earlier today. `rich`'s +8 is twice that and mechanistically attributable, but the alert is not worth *exactly* 8 runs. This does **not** fix the alertless tiers, and `overheating` is now unusable as a control — it separates `rich` from the rest. |

> ### ⚠️ SITTING-TO-SITTING VARIANCE — read before comparing any two files
>
> Found 2026-09-22 while assembling a model-by-mechanism summary. **The same cell,
> measured twice on 2026-09-21, gave two very different answers:**
>
> | cell | file | score |
> |---|---|---|
> | `words` / sonnet / `total-vs-per-m2` | [`readable-ladder-co2`](2026-09-21-readable-ladder-co2.json) | **8 of 10** |
> | `words` / sonnet / `total-vs-per-m2` | [`q1-response-channel`](2026-09-21-q1-response-channel.json) | **2 of 10** |
>
> Same question, same arm, same model, same n, same day, same live-tool-call protocol.
> A six-run swing.
>
> **What this does NOT invalidate.** Both of those runs spawn every arm/model cell of a
> repeat in ONE batch, precisely so transient API weather hits all arms alike. A
> difference measured *inside* one batch is therefore still a controlled comparison.
> Q1's `words` 2/10 vs `inline` 10/10 is such a comparison and its DIRECTION stands.
>
> **What it does invalidate.** The absolute level of any single cell, and therefore the
> MAGNITUDE of any gap quoted from it. Q1's headline "+8 on sonnet from moving the same
> bytes into the response" is computed against that 2; against the 8 the same gap is
> +2. The effect is a property of that sitting, not a constant. Quote the direction,
> not the size, and never subtract a number in one file from a number in another.
>
> **The bar this implies at n=10:** treat a per-cell difference of fewer than ~4 runs as
> noise unless the two cells were run in the same batch.
>
> Results that clear the bar comfortably, and can be quoted as sizes:
> - recipe in the RESPONSE vs the same 438 bytes in the DESCRIPTION — 29/30 vs 4/30
> - `rich` on `gas-estimate` — 30/30 against ~2/30 for every other arm combined
> - `thin` → `schema` on `wrong-unit` — 0/18 → 18/18
> - the CALCULATED vs MEASURED sentence on `benchmark-trap` — 0/60 → 59/60
> - the Q2 pruning NULL — 39/90 vs 39/90, both arms interleaved in one batch
>
> Results that do NOT clear it, and should be quoted as direction only: every
> single-cell gap under ~4 runs, including the exact size of the channel effect on any
> one cell, and anything computed by comparing two of the files in the table above.

> **2026-09-21, `interpretationBlock` CHANGED** — a `CALCULATED vs MEASURED` line was
> added (4,338 → 5,020 chars); see
> [`2026-09-21-benchmark-trap-calculated-vs-measured.json`](2026-09-21-benchmark-trap-calculated-vs-measured.json).
> The block feeds `descriptionCore`, so this moved the DESCRIPTION of `words`, `rich`
> and `words-recipe` and the RESPONSE of `inline`, `inline-recipe` and
> `inline-conditional` — **six arms, not two**. Every file above predates it and is
> **not comparable** with anything scored afterwards on a question touching `ep1`,
> `ep2` or `berekend_energieverbruik`: that is `benchmark-trap`, `gas-estimate` and
> `heat-pump-triage`. The ep1↔70 Paris Proof line was deliberately left in place.

> **gas-estimate tolerance changed on 2026-09-21**, from 20 to 8 (accept range
> 233–273 → 245–261). Files above that record `accept_range: 233-273` —
> `2026-09-21-opaque-live.json`, `2026-09-21-opaque-live-sonnet-n10.json`,
> `2026-09-21-n3-separators.json` — were scored under the old tolerance and are
> left as they were. Do not compare their gas-estimate counts against anything
> scored afterwards. `2026-09-21-readable-ladder-gas.json` carries both scorings.

The three readable-ladder files are the ones to read for the design question. Start
with the gas file: it is the only run scored on the DERIVATION as well as the value,
and that is where its result lives — requiring both, `rich` is 20 of 20 and every
other arm combined is 2 of 60. Read its `the_tolerance_problem` and `route_scoring`
before quoting any number from the three lower rungs; six of their apparent wins on
sonnet are the wrong derivation landing in the band by coincidence.

Then read the co2 file: it is the same ladder on the other `derived_number`
question, and it is the better instrument — its accept range cannot be reached from
the wrong denominator, so no route metric is needed. The two disagree about what the
PROSE rung is worth, and the co2 file explains why.

Read the wrong-unit file last, and read it for the `declined` column rather than the
accuracy column. It is the only question where the SCHEMA rung does anything (0/18 →
18/18), because it is the only one where the correct call cannot be expressed without
it. It is also where `thin` fails in two entirely different ways that a single
accuracy number would have hidden: asserting the forbidden answer on haiku, refusing
cleanly on sonnet and opus.

Across the three, the `rich` rung is 78 of 78.

**Start with `What the runs support so far` in
[`../open-questions.md`](../open-questions.md).** It is the synthesis across every run
in this directory, added 2026-09-21: volume of metadata is close to irrelevant, while
placement and precision are nearly everything (half the prose cut changed 0 answers;
one sentence added changed 59), the leverage runs in BOTH directions, and there is a
per-model rule set — capability substitutes for metadata only where the payload already
carries the quantity. It also lists what the runs do NOT establish. Q1 and Q2 are
answered there with their predictions left as registered; **Q3 and Q4 are open**, Q4
being the fact-vs-instruction ablation this directory's newest result raises. The token
figures live there too. The *Design guidance* section that follows the synthesis turns
it into what to build — including why per-model tailoring is not worth doing, and the
one assumption that conclusion rests on.

**Q1 has since been run and both its predictions were falsified** — see
[`2026-09-21-q1-response-channel.json`](2026-09-21-q1-response-channel.json). A fact
moved into the response gained +8 on sonnet where the prediction said it would gain
nothing; a procedure in the response scored 29/30 where the prediction said it would
stay near zero. The channel, not the amount of metadata, is what moved. Read its
`route_scoring` before quoting any lower-rung number: all 11 correct answers from the
three non-recipe arms took the wrong derivation road.

**Q2 has since been run.** Its cost half is falsified as stated and its accuracy half
holds only in the weak form the prediction was written to exclude — see
[`2026-09-21-q2-conditional-interpretation.json`](2026-09-21-q2-conditional-interpretation.json).
Cutting 37–50% of the interpretation prose changed accuracy by zero runs in 180 and
tokens by −1.84%, because the block is only ~2% of a subagent run's token bill. The
structural argument for conditional guidance — a description cannot be conditional on
data, a response can — is untouched; what this run shows is that the mechanism is
*free*, not that it is a large saving. Read
`why_benchmark_trap_could_not_test_the_prediction` before reusing that question: its
post-hardening ceiling is zero for both arms, and the cause is the tool's own
`ep1`↔70 Paris Proof line, not the pruner. **Q2's cross-record half remains
untested.** Read `scoring._provenance_warning` too — three of five scoring rules were
fixed during the run rather than before it.

That file is also the first to carry out the `get_tool_call_log` audit the skill now
mandates, and the audit earned its keep immediately: the `inline` arm writes every row
with `variant: "unknown"`, `paramsPresent: []` and `rowCount: 0`, so it is invisible to
any server-side count — and the log's own alert told the reader to discard exactly
those rows. The cause is a **stale deploy, not a code fault**: `mcpInline` shipped at
15:42, variant stamping landed at 16:23, and it was never redeployed, while the repo
source and all 182 tests stayed green. **That redeploy has since been done and
verified**: the Q2 run's preflight found `inline` stamping its own rows correctly, and
its audit reconciled every call on both arms with no unexplained rows — see
`log_audit` in the Q2 file. The log tool, the set and the skill have since
been changed so the same miss cannot happen quietly again; see
`fixes_applied_after_this_run` in that file.

Read the sweep first — it is the one that changed the design, and it is a useful
record of how easily a single run misleads. Then read `2026-09-21-opaque-live.json`:
it is the first live-tool-call run of the opaque regime, and it does not reproduce
the payload-in-prompt result the rest of these files rest on. Its sonnet n=10
confirmation pass sharpens the point: the one finding that survives both models is
that a recipe in a tool description goes unused.

## Format for a new run

Write a new file rather than editing these. At minimum record: the date, the
model, the arms, n, one row per run with the answer and whether it matched, and
an explicit caveats list. State the protocol — live tool calls or
payload-in-prompt — because the two are not comparable.
