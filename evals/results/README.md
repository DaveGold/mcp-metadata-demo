# Results

What happened when the set was run. Each file records its own caveats.

**This header used to say "none of these are measurements yet — n is 2–3 per cell
and mostly Haiku." That stopped being true on 2026-09-21 and was not updated.** The
files now split into two tiers: the 2026-09-21/22 runs are **n=10–20 per cell across
up to three models with server-side call audits**, and the earlier sweeps are still
n=1–3 and directional. Which tier a claim sits in, and whether its gap is large
enough to quote as a size, is settled file-by-file in
[`2026-09-22-variance-audit-of-prior-results.json`](2026-09-22-variance-audit-of-prior-results.json).
Read that before quoting any number from this directory.

| file | what it answers |
|---|---|
| [`2026-09-21-haiku-sweep.json`](2026-09-21-haiku-sweep.json) | Which questions separate the arms at all. Ran every core question thin-vs-rich before committing to a full matrix, and reshaped the set. |
| [`2026-09-21-n3-separators.json`](2026-09-21-n3-separators.json) | Do the separations reproduce? Found the variance effect the n=1 sweep could not see. |
| [`2026-09-21-opaque-prose.json`](2026-09-21-opaque-prose.json) | What interpretation guidance buys once field naming stops doing its job for it. |
| [`2026-09-21-guide-ablation.json`](2026-09-21-guide-ablation.json) | Which half of the guide does the work — glossary, or the derived-figure recipe. |
| [`2026-09-21-shape-replication.json`](2026-09-21-shape-replication.json) | Does that decomposition hold across question shapes? It does, and becomes a rule. |
| [`2026-09-21-first-harness-run.json`](2026-09-21-first-harness-run.json) | The first end-to-end run of the run-eval skill. Found the skill out of sync with the set, and records a retracted n=1 interpretation. **Its `finding_1_the_control_holds` is VOID — see the control-audit banner below.** It read `overheating` not separating as a control passing; the arms did not separate because all three were failing it. |
| [`2026-09-21-per-question.json`](2026-09-21-per-question.json) | Per-question outcomes and per-regime results, kept out of `questions.json` so the set reads as a spec. |
| [`2026-09-21-opaque-live.json`](2026-09-21-opaque-live.json) | Does the shape replication survive live tool calls? It does not — five of six cells disagree, and the derived-figures recipe scores 0 of 3. |
| [`2026-09-21-opaque-live-sonnet-n10.json`](2026-09-21-opaque-live-sonnet-n10.json) | The confirmation pass for that run — sonnet, n=10, 60 runs. Confirms the recipe failure and shows the other two questions saturate on a stronger model. |
| [`2026-09-21-readable-ladder-gas.json`](2026-09-21-readable-ladder-gas.json) | The readable ladder on the one question with headroom, and the first measurement of the `schema` rung. 80 runs, two models. Server-computed beats everything at either tolerance; the ladder looked non-monotonic at tolerance 20 and that wobble does not survive the retightening to 8. |
| [`2026-09-21-readable-ladder-co2.json`](2026-09-21-readable-ladder-co2.json) | Is the gas result a property of the SHAPE? 120 runs, three models incl. opus. rich replicates at 30/30; the prose rung reverses sign and the reason is legible; opus needs no metadata here. **DOWNGRADED 2026-09-22:** its `schema` 2/10 → `words` 8/10 on sonnet — the "prose is the carrier" claim — is **direction only**. That `words`/sonnet cell is the one the variance warning was built from and reads 2 in q1-response-channel, which would erase the gap entirely. The rich-rung numbers are unaffected. See the [variance audit](2026-09-22-variance-audit-of-prior-results.json). |
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
| [`2026-09-22-q13-overheating-response-channel.json`](2026-09-22-q13-overheating-response-channel.json) | **Q13 — the alertless tiers CAN be fixed, for free, and all three registered predictions are wrong.** #48's computed verdict reaches only `rich`. Q6 concluded prose could not carry this threshold — but every arm Q6 tested carries its guidance in the DESCRIPTION. `inline` carries the byte-identical line in the RESPONSE and had never been run on this question. 60 runs, haiku, n=20, one batch, no deploy and no source change. **`words` 5/20, `inline` 20/20, `rich` 20/20.** The cleanest number in the file: the 1.5 threshold is present verbatim in both `words` and `inline`, and `words` cited it **0 times in 20** against `inline`'s **20 of 20** — same sentence, same model, same sitting, only the channel differs. `words` invents a unit in 9 of 20 runs and every invented unit (hours/year, K, °C, %) makes 3.59 sound negligible, which is why 10 of 20 conclude low or no risk. **`inline` is also the CHEAPEST arm** — −9.7% tokens against `words`, −12.3% against `rich` — **the first arm measured here that is simultaneously cheapest and best.** So Q1's channel finding generalises from recipes to plain facts, **Q6's "prose will not fix it" is corrected to "prose in the DESCRIPTION will not fix it"**, and #48 was the expensive fix to a defect that had a free one. Audit reconciled exactly: 84 rows in window, words 29/29, inline 23/23 + 1 preflight, rich 31/31, zero stray rows; 7 of 60 self-reported CALLS counts understated the harness, which the log contradicts. |
| [`2026-09-22-variance-audit-of-prior-results.json`](2026-09-22-variance-audit-of-prior-results.json) | **The variance bar, finally applied backwards. No new runs.** The warning below was written on 2026-09-22 and then never carried back through the directory. Every claim that compares two cells is classified SAFE / NULL / DIRECTION-ONLY / NOT-MEASURED. **Three downgraded, everything else holds.** The weakest load-bearing claim in the directory is *"the prose rung is the carrier on sonnet"* (`schema` 2/10 → `words` 8/10 in readable-ladder-co2): it rests on the **exact cell the variance warning was built from**, which reads 8 there and 2 in q1-response-channel — if the true level were nearer 2 the claim would not shrink, it would vanish. Also records the sharper version of the rule: the same-batch halves of one run gave 8-v-7 and 10-v-3, so **same-batch protects a comparison's DIRECTION but not its SIZE**. Large-n nulls (39/90 vs 39/90, 30/30 vs 30/30, 20/20 vs 20/20) come out as the most robust results here, because noise would have to CREATE agreement rather than destroy it. |
| [`2026-09-22-q14-one-line-response.json`](2026-09-22-q14-one-line-response.json) | **Q14 — ONE line is enough, and all three registered predictions are CONFIRMED.** The second confirmed prediction in this repo, after Q5. `words`' description byte for byte, plus the single 181-char `temperatuuroverschrijding` line in the response. 60 runs, haiku, n=20, one batch. **`words` 8/20, `inline-oneline` 20/20, `inline` (whole block) 20/20.** The line is in the DESCRIPTION of both `words` and `inline-oneline`; the only difference is the response copy — cited **0 of 20** without it, **20 of 20** with it. The registered counter-case (a response needs enough bulk to be noticed) did not fire: one line was used exactly as often as 5,020 characters, which extends Q2's pruning result down to a single line. **Adding 181 characters cut tokens 14.7%** against `words` (median) with answer lengths within 10 chars — every `words` run invented a unit for 3.59 (fabricated 20/20). Against `inline` it is a tie (~2%). For MCPSER-81 this is the answer: add the one line to the response. Does **not** settle Q7. Also: `words` on this question has now read 2/7, 3/10, 7/10, 5/20 and 8/20 across five sittings — the level is not a quantity this repo can state; the direction is. Audit reconciled exactly, 106/106. Run from the session that built the arm, after its MCP client reconnected on its own — see the correction in the run-eval skill. |
| [`2026-09-22-q7-description-truncation.json`](2026-09-22-q7-description-truncation.json) | **Q7 — the description was ABSENT, because the host cuts every MCP tool description at 2,048 characters.** 7a: tool definitions ARE re-sent every request (1,012/1,012 runs re-read request 1's full cached prefix). But `words`' description is 6,779 chars and the 1.5 line starts at 6,181 — `eval-words` subagents on haiku and sonnet, asked what their description ends with, both quote it stopping at exactly character 2,048 with `… [truncated]`. Same-session token accounting agrees: `words-recipe`'s appended recipe adds +12/+24 tokens (tool-name length only). **7b not run** — the canary sits past the cut and would have scored 0/10 by construction. Q1, Q13, Q14 and Q6 compared delivered with undelivered text; the channel question itself is untested. No eval subagent runs. |
| [`2026-09-23-q15-delivered-description.json`](2026-09-23-q15-delivered-description.json) | **Q15 — a DELIVERED description sentence is applied, and all four registered predictions are CONFIRMED.** The channel test Q1 never ran. `words-front` inserts the 181-char overheating line (and Q7's canary) at char ~330, inside the 2,048-char cut; host listing and raw `tools/list` both verified. 60 runs, haiku, n=20, one batch, **default cap**. **`words` 1/20, `words-front` 20/20, `inline-oneline` 20/20** — the same line cited **20/20 in the description and 20/20 in the response**, 0/20 when it sits past the cut. The canary was obeyed 20/20 beside it (always after PARAMS or before ANSWER, never at the end of the answer), so Q7's "instruction obeyed, domain sentence ignored" outcome did not occur. `words-front` made exactly one call in every run (words 39, 19 of them weather). Q1/Q13/Q14's channel claim reduces to delivery: **keep it inside the first 2,048 chars, or put it in the response.** Audit exact, 84/84. Spawned from headless default-cap `claude -p` sessions (see file). |
| [`2026-09-23-q15b-uncapped-channel.json`](2026-09-23-q15b-uncapped-channel.json) | **Q15b — the same test with the cap RAISED (`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`), and all three registered predictions are CONFIRMED.** Uncut `words` delivers the whole 5,020-char block in the DESCRIPTION; `inline` delivers it in the RESPONSE. 60 runs, haiku, n=20, one batch. **`words` 20/20, `inline` 20/20, `inline-oneline` 20/20**, all citing 1.5, zero fabrications — Q13's comparison run properly, and a tie. The registered volume risk (the line inside ~37.6k chars of tool definitions) did not fire. But the raised cap ships every long description uncut on every request: **`words` +23.7% tokens against `inline`**, almost all of it render/weather descriptions, not the block. Audit exact, 63/63. **Never subtract a cell of this file from a Q15 cell** — different sessions, different caps. |
| [`2026-09-23-rb1-schema-words-total-vs-per-m2.json`](2026-09-23-rb1-schema-words-total-vs-per-m2.json) | **RB1 — the first re-baseline Q7 asked for: `schema` → `words` on `total-vs-per-m2`, sonnet, n=20, default cap.** It re-measures the one gap quoted as "the prose is the carrier" (2/10 → 8/10), which credited a sentence at char 4,311 that was never delivered. Registered NULL (< 4 of 20), falsified at ≥ 8. **`schema` 4/20, `words` 11/20, gap 7: direction only.** Neither confirmed nor falsified. The direction reproduces; the mechanism is withdrawn, because whatever moves sonnet here is in the first 2,048 characters (candidates: the VBO-level sentence, and the NTA 8800 bullet naming `gebruiksoppervlakte`). Size still not quotable: `words`/sonnet on this question has read 8/10, 2/10 and 11/20. Audit exact, 41/41. |
| [`2026-09-23-q8-guidance-call.json`](2026-09-23-q8-guidance-call.json) | **Q8 — the guidance-call channel works if it is CALLED, and only sonnet called it.** The DERIVED FIGURES recipe returned by a no-argument `get_building_profile` call, beside the same bytes in the description (`words-recipe`, cap raised so it delivers) and the response (`inline-recipe`). 60 runs, haiku + sonnet, n=10, `gas-estimate`. **sonnet made the call 10/10, first, and scored 10/10; haiku made it 0/10 and scored 0/10 route-correct** (5/10 by value, all lucky or wrong-road, 3 invented efficiencies). Given the recipe the channel does not matter: sonnet 10/10 in all three arms, and `words-recipe` 17/20 vs `inline-recipe` 17/20 by value, the third tie after Q15/Q15b. Prediction not confirmed and recorded as falsified; the registration's /30 thresholds against a 20-per-arm design are disclosed and scored both ways. The falsifier's reading ("proximity to the data matters") does not hold. Audit exact, 80/80. |
| [`2026-09-23-q8b-guidance-discovery.json`](2026-09-23-q8b-guidance-discovery.json) | **Q8b — haiku CAN be made to make the guidance call, by wording alone. All three registered predictions CONFIRMED.** Same recipe bytes, three pointers, haiku, n=10, `gas-estimate`. **Soft pointer (Q8's): 0/10 called. "REQUIRED: before any lookup, call this tool once with no arguments …": 10/10. A separate parameterless `get_derivation_guide` tool (the `start_duurzaam` shape): 10/10.** All 20 callers route-correct, all 10 non-callers improvised (8 invented a conversion constant). The extra call costs ~0.5% tokens. So Q8's haiku failure was the pointer, not the model, and it explains why Q15's canary was obeyed: explicit imperatives are, soft hints are not. Audit exact, 52/52. |
| [`2026-09-23-q9-position-distance.json`](2026-09-23-q9-position-distance.json) | **Q9 — distance is FLAT, position NOT MEASURED AT SCALE, and a response-side host cut found on the way.** haiku. **Distance** (`guidance-strong`, `gas-estimate`, fixed call order): route-correct **10/10, 10/10, 9/10** at 0, 1 and 3 intervening quarterly weather calls (up to ~62k chars of records between the guidance and the lookup). The registered "≥ 5 lost" is falsified: a recipe fetched once survives that distance. **Position** (`inline-head` vs `inline`, `weather-partial-normalization`): all 20 runs chose `summaryOnly`, so there was nothing to be first or last in (10/10 vs 9/10). **Host finding:** the first distance run was VOID, because Claude Code **replaced** each 79k-char result with a 1.7k "saved to file" notice (the 25k-token MCP output limit). Guidance inside an over-limit response never reaches the model. Two further failures, a protocol paragraph that displaced the guidance call and the server's own rate limiter, are recorded, and the redesign was fixed before it ran. Audits exact (38/38, 101/101; the void run's 13-call gap is exactly the 13 rate-limited calls). |
| [`2026-09-23-q11-select.json`](2026-09-23-q11-select.json) | **Q11 — `outputSchema` is not delivered, field names leak from the question, and delivered semantics change the explanation, not the choice.** 110 runs, haiku + sonnet, cap raised. The main half is answered by accounting: a 7,659-char schema difference costs +181–336 tokens, so `outputSchema` is not in the request. **Names:** with the `select` field list removed, sonnet sent the exact names 8/10 by camel-casing the question's own words. That falsifies the prediction by the letter, not its stated meaning. haiku got 2/10, never recovered, and falsely told the user the field does not exist in 5 of 8 misses. **Degree-day:** `weightedHdd` chosen 20/20 on uncut `words` and 18/20 on `thin` (falsified). Without the weighting semantics sonnet invented a rationale 8/10 times. **Fighting days:** the registered silent `tempMean` failure never happened (0/40). sonnet selected the right fields and still scored 0/20, misreading boundary values; haiku scored 13/20 (partial). Audits reconcile: names exact on weather calls; meanings within one row. |
| [`2026-09-23-q12-weather-replication.json`](2026-09-23-q12-weather-replication.json) | **Q12 on weather — no headroom, not scored.** Both registered second domains (Artikelbeheer, Ketenstandaard) are closed APIs, and an eval publishes its records. So Q12 ran on the only other public source, Open-Meteo: partial external validity (a different data domain, same server and author), not the gate. The weather tool's own partial-period rule went in the description, in the response, or nowhere. 60 runs, haiku + sonnet, n=10: **18/20 · 19/20 · 19/20**. The channels tie, but the no-rule control is at ceiling. Both models compare two quarters' degree-days unaided, and only 1 of 60 took the forbidden `gasNormalizationFactor` road. Recorded as measuring nothing, as the amendment fixed before the run. Audit exact, 126/126. |
| [`2026-09-23-q12b-weather-single-quarter.json`](2026-09-23-q12b-weather-single-quarter.json) | **Q12 re-run with headroom: the channel ties again, and haiku ignores the rule.** `weather-single-quarter` asks to normalise ONE quarter to an average year, where 4,200 × 2.53 ≈ 10,600 m³ is the trap. Same three arms, 60 runs, haiku + sonnet, n=10. **No rule: 3/20 (16 took the factor road). Rule in the description: 10/20. Rule in the response: 10/20.** sonnet goes from 3/10 to 10/10 by either channel and builds a reference quarter from 4–11 prior years. haiku scores 0/10 in every arm, still multiplying by 2.53 or inventing a reference. The tie was recorded in advance as the registered falsification. Audit: 266 of 268 rows, 2-row residual on `wx-desc`. |
| [`2026-09-23-q12c-weather-single-quarter-opus.json`](2026-09-23-q12c-weather-single-quarter-opus.json) | **Q12 on opus: it does not need the rule.** Same arms and question, 30 runs. **No rule 9/10, description 9/9, response 10/10.** Opus builds a reference quarter from prior years unaided. The rule is worth 0 on haiku, 7/10 on sonnet and 0 on opus: it only helps the middle model. Prediction falsified. The audit page caught 225 of 246 rows (the log tool pages at 500 with no offset). |
| [`2026-09-23-rb2-opaque-naming-uncut.json`](2026-09-23-rb2-opaque-naming-uncut.json) | **RB2: Q6 re-run uncut, and the name was never the problem.** With the cap raised, `opaque-words` delivers its glossary ("unitless … ABOVE 1.5 = significant"). **20/20**, all citing 1.5 via the neutral field name `TO`, against `opaque` 6/20 (none via the indicator). Q6's 0/7 was absence. Confirmed. Audit exact, 54/54. |
| [`2026-09-23-rb3-ladder-words-uncut.json`](2026-09-23-rb3-ladder-words-uncut.json) | **RB3: the `words` rung, uncut, sonnet.** On `total-vs-per-m2`: `schema` **1/10**, uncut `words` **10/10**. The delivered scopes sentence carries it, so "the prose is the carrier" is restored with its mechanism. On `gas-estimate`: route-correct 0 vs 0; `schema` guesses via EP2 and uncut `words` declines 10/10. Both predictions confirmed. Audits exact. |
| [`2026-09-23-q10-addressed-semantics.json`](2026-09-23-q10-addressed-semantics.json) | **Q10 reopened: targeted semantics is not a lever for haiku.** The same sentence in the response as prose, as `relates_to_fields`, or with a server-computed `triggered_by`. 120 runs, n=20. **Weather: 1 / 0 / 1 of 20**, even with a trigger saying "91 days, not a full calendar year". **Area: 11 / 14 / 14**, a +3 within noise. Addressing-alone null confirmed; activation prediction falsified (weather) / partial (area). Audit exact, 170/170. |
| [`2026-09-23-q16-fetch-vs-apply.json`](2026-09-23-q16-fetch-vs-apply.json) | **Q16: haiku's barrier is fetching the data, not applying the rule.** Same partial-period rule in the response in all three arms, with `gasNormalizationFactor` on offer. **Rule only: 2/20. Plus a server-computed reference-quarter HDD: 15/20. Plus the computed factor: 11/20.** Ship the data a rule needs and a weak model applies it; the finished factor adds nothing beyond that. Residual misses lead with a full-year extrapolation (≈ 4,200 × 2.53 by another road). P1 and P2 confirmed, P3 partial. Audit exact, 101/101. |


> ### ⚠️ DESCRIPTION TRUNCATION — read before quoting ANY description-channel number
>
> Found 2026-09-22 by Q7. The host every run here used sends only the **first 2,048
> characters** of each MCP tool description. `words`, `rich` and `words-recipe` lose
> 70–72% of theirs — almost the whole INTERPRETATION block, including CALCULATED vs
> MEASURED (char 3,377), the Paris Proof line (3,194), the overheating threshold (6,181),
> `rich`'s ALERTS paragraph and `words-recipe`'s recipe (6,781). `opaque-words` loses 57%,
> including `to` (3,105) and its recipe. **The response-channel arms are unaffected.**
>
> So every file that credits or blames "prose in the description", or compares a
> description arm with a response arm, measured guidance that was **not delivered**:
> Q1's 4/30, Q13 and Q14's 0-of-20 citations, Q6's 0/7, the `schema → words` rung, and
> the definition half of Q3/Q5's input penalty. Their numbers are real; what they are
> numbers *of* is not what their files say. See
> [`2026-09-22-q7-description-truncation.json`](2026-09-22-q7-description-truncation.json) → `what_this_changes`.
>
> **The channel test itself has now been run (2026-09-23).** With the sentence DELIVERED
> in both channels, they score the same on haiku: Q15 (line inside the cut) 20/20 vs 20/20,
> Q15b (cap raised, whole block uncut) 20/20 vs 20/20. What the files above measured was
> delivery, not channel. See [`2026-09-23-q15-delivered-description.json`](2026-09-23-q15-delivered-description.json)
> and [`2026-09-23-q15b-uncapped-channel.json`](2026-09-23-q15b-uncapped-channel.json).

> ### ⚠️ `overheating` WAS NEVER A WORKING CONTROL — audit, 2026-09-22
>
> It was built as a *non-separation* control: no alert covered it, so `rich` should
> hold no advantage over `words`. It has now failed in that role **twice, in
> opposite directions**, and it is re-designated in `questions.json` as a
> computation discriminator. Every file in this directory was checked for what it
> leaned on. Five mention it; **one is void, one is frozen, three are unaffected.**
>
> | file | how it used `overheating` | status |
> |---|---|---|
> | [`first-harness-run`](2026-09-21-first-harness-run.json) | as a **passing control** — "THE CONTROL DID NOT SEPARATE, which is what a control is for… The other findings in this set are not undermined" | **VOID.** The arms did not separate because *all three were wrong*: thin inverted, rich inverted, words 1 right / 1 wrong / 1 partial. A question every arm fails is a floor, not a control, and it licenses no conclusion about the other findings. Nothing else in that file depends on it. |
> | [`q5-deliberation-control`](2026-09-22-q5-deliberation-control.json) | as a question **`rich`'s alerts do not answer** — the whole design of the Q3 attack | **MEASUREMENT STANDS, PREMISE NOW FALSE.** Verified on the wire *at the time*: five alerts, none about overheating. The computed alert landed afterwards, so the numbers are sound but **the run can never be reproduced on this question.** A replication needs a different alert-free field; after #48 the only substantive one left is `compactheid`. |
> | [`haiku-sweep`](2026-09-21-haiku-sweep.json) · [`per-question`](2026-09-21-per-question.json) | as a **measurement** question — the prose-only "model cliff", outcome class C | **UNAFFECTED**, and independently corroborated: Q6 reached the same conclusion at 21 runs where these were n=1–2. Neither claims the control held. |
> | [`readable-ladder-co2`](2026-09-21-readable-ladder-co2.json) | names its outcome class in passing | **UNAFFECTED.** |
>
> [`q1-response-channel`](2026-09-21-q1-response-channel.json) and
> [`q2-conditional-interpretation`](2026-09-21-q2-conditional-interpretation.json) ran
> **no** controls and say so. Those caveats stand as written — and are in fact
> understated, since the control they would have run would not have worked.
>
> **What this costs the set going forward.** Both surviving controls
> (`metered-vs-model`, `invented-label`) are refusals every arm should pass. There is
> now **no non-separation control at all**, so no run can currently detect an arm
> separating for a reason other than the layer under test on a question it is
> supposed to win. State that in the caveats of any new run rather than letting the
> word "controls" imply cover that is not there.

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
> **And same-batch is weaker protection than it sounds.** The two same-batch halves of
> [`absent-sizing-input-haiku-n20`](2026-09-22-absent-sizing-input-haiku-n20.json) gave
> **8-v-7 and 10-v-3** — identical protocol, minutes apart, inside one run. So being in
> one batch protects a comparison's **direction**; it does not stabilise its **size**.
>
> **This bar has now been applied backwards through the whole directory** — see
> [`2026-09-22-variance-audit-of-prior-results.json`](2026-09-22-variance-audit-of-prior-results.json).
> Three claims are downgraded to direction-only; the rest hold.
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

Then read the co2 file — but read its `schema` → `words` gap as a direction only, per the
[variance audit](2026-09-22-variance-audit-of-prior-results.json). It is the same ladder on the other `derived_number`
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
