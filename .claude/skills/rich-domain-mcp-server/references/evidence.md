# Evidence — why each rule in this skill exists

The skill applies its own rule here: **every rule carries its provenance** [Q18]. When you are
about to delete, weaken or reverse a rule, read its row first; when a new eval result lands, add
or amend a row and date it.

All files are under [`evals/results/`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results). The synthesis they feed is in
[`evals/open-questions.md`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/open-questions.md) ("What the runs support so far",
"Design guidance") and [`evals/research-frame.md`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/research-frame.md).

**Status key.** `settled` — a large, stable effect or a large-n null. `direction` — the sign
reproduces, the size does not (gap of 4–7 of 10, or different sittings). `null` — measured, no
effect. `reversed` — a later run showed the earlier reading was wrong. `open` — not measured.

**Variance bar** (from the variance audit): at n=10, a gap of ≥8 is quotable as a size, 4–7 is
direction only, <4 is noise. Same-batch protects a comparison's direction, not its size. Large-n
nulls are the most robust results in the set.

**Standing caveat on every row:** one author wrote the metadata, questions, ground truth and
scoring; one domain family (Dutch building + weather data); one host (Claude Code); one model
family (Claude haiku / sonnet / opus).

---

## Delivery

| id | rule | evidence | result | status |
|---|---|---|---|---|
| Q7 | The host sends only the first 2,048 chars of each tool description (and of server instructions), on every request | [`2026-09-22-q7-description-truncation.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q7-description-truncation.json) | subagents quote their description stopping at exactly char 2,048; 1,012/1,012 runs re-read the cached prefix | settled (Claude Code) |
| Q15 | A delivered description sentence is applied as often as the same sentence in the response | [`2026-09-23-q15-delivered-description.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q15-delivered-description.json) | line at char ~330: 20/20; same line in response: 20/20; past the cut: 1/20. haiku n=20 | settled |
| Q15b | Raising the client cap delivers the block but taxes every tool | [`2026-09-23-q15b-uncapped-channel.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q15b-uncapped-channel.json) | 20/20 = 20/20; +23.7% tokens | settled |
| Q1 | (historical) response 29/30 vs description 4/30 for the same 438-byte recipe | [`2026-09-21-q1-response-channel.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-q1-response-channel.json) | the description copy was past the cut | **reversed** → delivery, not channel |
| Q11 | outputSchema is not in the model-facing request | [`2026-09-23-q11-select.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q11-select.json) | 7,659-char schema difference = +181–336 tokens | settled (by accounting) |
| Q9 | A result over ~25k tokens is replaced by a "saved to file" notice; guidance inside it is lost to a model without file tools. Under the limit, distance is flat | [`2026-09-23-q9-position-distance.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q9-position-distance.json) | 79k-char results replaced; recipe applied 10/10, 10/10, 9/10 after 0/1/3 intervening calls (~62k chars) | settled (distance, haiku); position within a response: open |
| Q8 | A guidance call works when made; whether it is made depends on the model | [`2026-09-23-q8-guidance-call.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q8-guidance-call.json) | sonnet called 10/10, correct 10/10; haiku called 0/10 | settled |
| Q8b | Word the pointer as a requirement, or give the guidance its own tool | [`2026-09-23-q8b-guidance-discovery.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q8b-guidance-discovery.json) | soft pointer 0/10 called; "REQUIRED: …" 10/10; own tool 10/10; +0.5% tokens | settled |
| Q13 | The overheating threshold that "prose could not fix" was fixed free by delivering the same line | [`2026-09-22-q13-overheating-response-channel.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q13-overheating-response-channel.json) | `words` 5/20 (cited 0/20), `inline` 20/20, cheapest arm | settled (mechanism: delivery, per Q7) |
| Q14 | One line is enough | [`2026-09-22-q14-one-line-response.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q14-one-line-response.json) | one 181-char line 20/20 = whole 5,020-char block 20/20; −14.7% tokens vs none | settled |

## Naming

| id | rule | evidence | result | status |
|---|---|---|---|---|
| N1 | Readable field names do much of the work prose would do — a readable-name arm is not a "no metadata" arm | [`src/domain/obfuscate.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/obfuscate.ts) header; [`2026-09-21-per-question.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-per-question.json) | binary heat-pump triage saturated on readable names, needed the glossary on opaque codes; a capable model inferred from `berekeningstype: "NEN 7120"` that `warmtebehoefte` is not populated, with no prose | direction |
| N2 | A name that implies a different quantity is anti-metadata: it overrides the prose next to it | [`evals/README.md`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/README.md) §2 | `berekend_energieverbruik_kwh_m2` benchmarked as real consumption despite prose; renamed `bev`, the same model consulted the guide and declined | direction (payload-in-prompt, small n) |
| N3 | An unrecognised code is not treated as unknown — it is confidently misread to the nearest plausible meaning | [`2026-09-21-guide-ablation.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-guide-ablation.json) | every unguided run read `f_ga` (thermal-zone area) as gas | direction |
| N4 | "Magnet" names attract the wrong question | [`2026-09-21-opaque-live.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-opaque-live.json), [`…-sonnet-n10.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-opaque-live-sonnet-n10.json) | `ahe` (renewable share, %) anchored as heat demand in 6/6 haiku runs; sonnet 0/20 | settled for haiku only |
| N5 | A readable name without a unit gets a unit invented for it | [`2026-09-22-q6-overheating-naming.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q6-overheating-naming.json), [Q14] | `temperatuuroverschrijding` 3.59 read as hours/K/°C/%; `words` invented a unit 20/20 in Q14 | settled (the invention); cause was the undelivered unit line |
| N6 | Once the glossary is delivered, a neutral name works — the name was not the *cause* | [`2026-09-23-rb2-opaque-naming-uncut.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-rb2-opaque-naming-uncut.json) | `opaque-words` uncut 20/20 via neutral `TO`; `opaque` 6/20 | settled. Implication: names are the cheapest *guaranteed-delivered* carrier, not the only one |
| N7 | Field names leak from the user's own words | [Q11] | without the list, sonnet camel-cased the question to the exact `select` names 8/10; haiku 2/10 and told the user the field does not exist in 5/8 misses | settled. Keep the valid-name list in the INPUT description |
| N8 | `hdd` vs `weightedHdd` naming did not cause wrong picks | [Q11] | `weightedHdd` chosen 20/20 (uncut words), 18/20 (thin) | null — do not rename for this reason |

## Content — what to ship

| id | rule | evidence | result | status |
|---|---|---|---|---|
| BT | State whether a quantity is CALCULATED or MEASURED and what it may be compared with; audit the guidance you already ship | [`2026-09-21-benchmark-trap-calculated-vs-measured.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-benchmark-trap-calculated-vs-measured.json) | one sentence: 0/60 → 59/60, fabrications 22 → 0, ~260 tokens/call. The failure came from a plausible line (`ep1 … Paris Proof kantoor: 70 kWh/m²`) | settled — largest effect in the set |
| Q4 | Ship the FACT with the instruction; an instruction whose trigger is the withheld fact is inert | [`2026-09-22-q4-fact-vs-instruction.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q4-fact-vs-instruction.json) | both 30/30, fact only 25/30, instruction only 10/30; opus 10/10 everywhere | settled. Falsified "specify behaviour, not semantics" |
| L1 | Compute determinate derived figures server-side | [`2026-09-21-readable-ladder-gas.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-readable-ladder-gas.json) | `rich` 20/20 on value AND derivation; every other arm combined 2/60 | settled |
| L2 | Capability substitutes for metadata only when the quantity is already in the payload | [`2026-09-21-readable-ladder-co2.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-readable-ladder-co2.json) | opus 40/40 on every arm (fact present); opus 1–3/10 on gas (constant absent) | settled for `rich` 30/30; `schema→words` gap direction only |
| L3 | A typed input schema is for expressibility and validation, not meaning | [`2026-09-21-readable-ladder-wrong-unit.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-readable-ladder-wrong-unit.json) | `thin` 0/18 → `schema` 18/18 where the call cannot be expressed without `huisletter`; ≈0 elsewhere; a postcode regex stopped silent wrong-building lookups | settled |
| RB3 | Delivered prose carries a fact the payload has but the model misreads | [`2026-09-23-rb3-ladder-words-uncut.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-rb3-ladder-words-uncut.json) | `schema` 1/10 → uncut `words` 10/10 (sonnet) | settled |
| Q16 | If a rule needs data the payload lacks, ship the data | [`2026-09-23-q16-fetch-vs-apply.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q16-fetch-vs-apply.json) | rule only 2/20; + server-computed reference-period HDD 15/20; + finished factor 11/20 (haiku) | settled. Ship data, not the finished factor |
| Q16b | Shipped data also makes strong models fast and consistent | [`2026-09-23-q16b-strong-models-cost.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q16b-strong-models-cost.json) | 10/10 either way; −86% calls, −23% tokens, −75% wall time, answers converge to one value | settled |
| Q12 | A rule that requires fetching more data helps only the middle model | [`q12b`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q12b-weather-single-quarter.json), [`q12c`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q12c-weather-single-quarter-opus.json) | no rule 3/20; rule in either channel 10/20 — sonnet 3→10, haiku 0, opus 9/10 unaided | settled |
| AS | Keep notes about NULL decision fields; pruning removes the note, not the field | [`haiku-n20`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-absent-sizing-input-haiku-n20.json), [`sonnet-n20`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-absent-sizing-input-sonnet-n20.json), [`opus-n20`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-absent-sizing-input-opus-n20.json) | haiku 18/20 unpruned vs 10/20 pruned (fabrications 3 vs 10); sonnet and opus 20/20 both | settled, haiku-only |
| Q11b | Compute a thresholded result and return it complete | [Q11] | sonnet chose the right fields and still scored 0/20 misreading near-boundary days; the alert truncated with "(+6 more)" | direction |
| S1 | Score stable wrong answers as the dangerous ones | [`2026-09-21-n3-separators.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-n3-separators.json) | `rich` 253 ×3; `thin` 44% spread; an obvious-but-wrong path gives "perfectly stable and perfectly wrong" | direction |

## Volume, form and cost

| id | rule | evidence | result | status |
|---|---|---|---|---|
| Q2 | Pruning interpretation to the record is free, not cheap | [`q2-conditional`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-q2-conditional-interpretation.json), [`q2-cross-record`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q2-cross-record-pruning.json) | 39/90 = 39/90, −1.84% tokens; −66.8% of the block: 30/30 = 30/30, −4.78% | settled null |
| Q17 | Volume is inert for response guidance up to 100 rules | [`2026-09-23-q17-rules-at-scale.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q17-rules-at-scale.json) | target rule among 100 (~16k chars) found as easily as alone | settled null |
| Q10 | The FORM of a rule (prose, `relates_to_fields`, computed trigger) does not matter at runtime | [`2026-09-23-q10-addressed-semantics.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q10-addressed-semantics.json) | 1/0/1 and 11/14/14 of 20 | null |
| Q18 | For the agent that IMPROVES the server, only provenance changes the outcome | [`2026-09-23-q18-authoring-form.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-23-q18-authoring-form.json) | attribution, orphan recall, coverage ~100% in every form; history cited 16/16 with provenance vs 0/16 without, none invented | settled (sonnet + opus, ≤42k-char source) |
| Q3 | Metadata that answers the question can be cheaper despite being larger: less to think | [`2026-09-22-q3-cost-decomposition.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q3-cost-decomposition.json) | ~378 more input tokens/call yet cheaper; `words` takes 1.63×/2.01× longer | settled |
| Q5 | Irrelevant metadata is charged at list price on every turn | [`2026-09-22-q5-deliberation-control.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-q5-deliberation-control.json) | +1,172 tokens on a question the alerts do not answer | settled |

## Model differences

| id | rule | evidence | status |
|---|---|---|---|
| M1 | Do not tailor per model: the top rung saturates every model, so tailoring buys ≤~2% tokens | `open-questions.md` "If you COULD target the model" | settled while a determinate top rung exists |
| M2 | Haiku is where delivery, explicitness and shipped data matter most; all format violations (29/240) were haiku | same | settled |
| M3 | Noticing is not acting: opus named the calc-vs-measured trap 7/10 and still gave the forbidden verdict 10/10 before the fix | [BT] | settled |

## The composite reference (Q19)

| id | rule | evidence | result | status |
|---|---|---|---|---|
| Q19 | The rules in this skill, applied together (the `best` arm), keep what the old reference won and fix what it lost; the audit predicts where the old one loses | [`2026-09-24-q19-best-arm.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19-best-arm.json) | benchmark-trap `best` 20/20 · 9/10 · 10/10 vs `rich` 0/20 · 0/10 · 0/10 (hand-read); held-out 19/20 vs 0/20 (haiku); solar 10/10 vs 1/10; controls 10/10; cheaper in 30/32 cells (median −5.9%). 790 runs, 8 of 10 predictions confirmed | settled for this composite, these questions |
| Q19b | Shipped data must be comparable across calls | same; fix measured in [`q19b`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19b-weather-fixes.json) | a reference that moves with the query year: two-period normalisation `best` 0/10 vs `rich` 10/10 (6.6% instead of 3.6%). With a fixed span: `best` 8/10 = `rich` 8/10 | settled (defect and fix) |
| Q19c | Shipped data has an upstream cost: fetch only what the computation needs, respect the source's metering and concurrency, cache what cannot change | same, `infrastructure_incidents` | one un-cached 10-year fetch per call (~260 Open-Meteo weighted calls) exhausted the hourly quota; every call of the arm then failed with 429 | settled (incident) |
| Q19d | Say what NOT to do with shipped data when the question invites misuse — and expect it to reduce, not remove, the misuse | same; [`q19b`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19b-weather-fixes.json) | with the correct quarter figure in hand, 10 of 16 correct haiku answers extrapolated it to a year (= the forbidden 4,200 × 2.53); with a "do not scale it to a full year" clause, 5 of 18 — several quoting the caveat and annualising anyway | direction (cross-sitting) |
| Q19e | A prohibition in the description head can suppress the call that would show the problem | same | forecast window: `best` haiku made no call in 8/10 and asked for data; `best` 2/10 vs `rich` 4/10 | not measured (gap < 4); behaviour observed |
| Q19g | Pre-call misses are fixed in the description head, not the response: "call it directly" | [`q19c`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19c-call-it-directly.json) | weather calls 30/30, 0 address requests (was 3/30); forecast question called 10/10 (was 2/10) — its remaining miss moved to reading (5/10) | settled for the call; reading open |
| Q20 | Removing a wrong sentence is not the same as delivering the right one: after a defective line goes, check that the correcting fact is DELIVERED | [`q20`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q20-rich-alert-removed.json) | `rich` without its false Paris Proof alert still ranks calculated against measured: haiku 0/10, sonnet 1/10 (+3 hedged) vs `best` 10/10, 10/10 — its CALCULATED vs MEASURED line sits past the 2,048 cut | settled (gap 10 and 9, same batch) |
| Q21 | …and delivering the correcting fact fixes what removing the defect did not | [`q21`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q21-rich-line-delivered.json) | only change: `rich`'s CALCULATED vs MEASURED line moved from char ~3,380 to 766. benchmark-trap haiku 0/10 → 10/10, sonnet 1/10 → 10/10, all hand-read; building-size unchanged 10/10 | settled (gap 10 and 9; cross-sitting vs Q20, same-batch `best` 10/10) |
| Q22 | Apply the audit to app (render) tools too: an example in their input schema is delivered and invites misuse; payload guidance counts only where delivered and not already shown by the schema | [`q22`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q22-app-tools.json) | Paris Proof line on calculated bars: `best` left it out 6/10 haiku, 10/10 sonnet; `best-v1` drew it 20/20. Positional map markers 20/20 vs 4/20; chart tuples equal (the schema shows them). Cost +2–4% tokens | settled on the trap (gap 6 and 10), direction on shapes |
| Q22b | An alert after a successful render is read as a note, not a reason to redo the call | [`q22b`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q22b-table-alert.json) | table headers dropping "calculated": alert on the response fixed 2/10, 0/10 re-rendered; the fact moved into the prose 9/10 | settled (n=10, 0/10 re-renders) |
| Q22c | …and a refusal with the fix in the message does it | [`q22c`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q22c-table-refusal.json) | same check, call refused: headers right 10/10 (instruction 1/10, alert 2/10); 6/10 refused → retried → rendered, 10/10 ended rendered; +4.9% tokens | settled (gap 8 over the alert, same batch control 0/10) |
| Q23 | Size a render tool's type guidance to the tempting mistakes the data invites, not to the menu it supports | [`q23`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q23-chart-choice.json) | 240 runs, forms chosen: text 137, bar 50, line 26, table 24, pie 3, polarArea 2. Rules for 14 types (2,769 chars): the only effect was no 12-slice pie (3/10 → 0/10, haiku); cost 1.9–4.6% tokens | settled on this domain (series, few categories); untested on hierarchical or flow data |
| Q24 | Walk every branch of an input schema with data built for it: a branch the model chooses right can still be unreachable, and the server log will not show it | [`q24`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q24-chart-paths-pilot.json) | scatter/bubble/boxplot chosen right, refused by the schema (`data` required), fallback to line/bar, on every tier; 54 refused calls absent from the server log. A decision path fixed the one choice problem (polarArea 0/6 → 5/6) | pilot (haiku n=3); the schema defect is determinate |
| Q19h | The eight canonical block names cost nothing | [`q19d`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19d-canonical-blocks.json) | same content under the talk's names and order: 10/10, 10/10, 9/10, no regression | settled (regression check) |
| Q19f | Renaming fields did not break questions worded in the old vocabulary | same | every building cell ≥ 18/20 or 10/10 with 16 renamed fields | settled |

## Field reading (probe)

| id | rule | evidence | result | status |
|---|---|---|---|---|
| FP1 | Test which fields need explanation with a field-reading probe, not an eval per field; read the flagged meanings, do not trust the auto-score | [`field-probe-best`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-field-probe-best.json) | 44 building + 20 weather fields, haiku, 3 records × 3: calculated energy fields never read as measured (0/99); after rescoring, 7 weather fields stayed flagged on unit spelling / kind choice with correct meanings, while the auto-score PASSED a real scope misread (below) | direction (one author, one probe) |
| FP2 | A native-language term in a name may not carry its meaning to the model; keep the response rule | same | `oppervlakte_bag_verblijfsobject_m2` read as the building's area 2/9; the rename alone did not fix the scope, the `bp.area.one_unit` rule does | direction |
| FP3 | Fields outside the six risk classes need no explanation | same | all 14 `UNCOVERED_BY_DESIGN` fields read right 9/9 or 8/9 | direction |

## Method

| id | rule | evidence |
|---|---|---|
| V | Apply the variance bar; never subtract numbers from different files | [`2026-09-22-variance-audit-of-prior-results.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-variance-audit-of-prior-results.json) |
| P | Register the prediction before the run; most registered predictions here were wrong | `open-questions.md` preamble |
| A | Audit every run against the server's own tool-call log; self-reported call counts were wrong | [Q1], [`opus-n20`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-22-absent-sizing-input-opus-n20.json) |
| D | Being able to call an arm does not prove it runs current code (stale deploy wrote `variant: "unknown"`) | [Q1] |
| H1 | An eval harness can fail silently in ways that look like model behaviour: a headless session's MCP server not yet connected (the host refused tool-less subagents), a server rate limiter, an upstream quota. Detect it per run and re-run the WHOLE batch | [`q19`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19-best-arm.json) `infrastructure_incidents`: 57 of 156 waves discarded and re-run |
| H2 | A deterministic rubric is a first pass, not a score: it misclassified correct answers on 5 questions ("does not contain heat demand", "Apr 6", "only below 70% warrants investigation") | [`q19`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19-best-arm.json) `scoring`: 46 hand verdicts, each with a reason |
| H3 | Calls rejected by input validation never reach the handler, so they are missing from the server log; the audit explains them, it does not ignore them | [`q19`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-24-q19-best-arm.json) `log_audit`: 245/251 exact, the 6 = logless `render_table` rejections |
| C | A question every arm fails is a floor, not a control | [`2026-09-21-first-harness-run.json`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/evals/results/2026-09-21-first-harness-run.json) (void control) |

---

## Rules that were refuted or narrowed — do not reintroduce

| old rule | what replaced it | by |
|---|---|---|
| "Put output-reading knowledge in the description" | only the first 2,048 chars arrive; prefer the response for interpretation | Q7, Q15 |
| "The response beats the description" | delivery, not channel | Q7, Q15, Q15b, Q12b |
| "Prose will not fix overheating" | prose in the description *past the cut* will not | Q13, RB2 |
| "The field name caused the overheating failure" | the glossary was absent | RB2 |
| "A recipe in a description goes unused" | a truncation artefact | Q7, Q8 |
| "Returning the computed figure is the only thing that works" | delivered guidance works; computation is the most model-uniform | Q1, Q15 |
| "Specify behaviour, not semantics" | ship the fact; the instruction alone is inert | Q4 |
| "Define stable meaning in the output schema" | not delivered on this host | Q11 |
| "Meta-tools are never called" | called 10/10 behind a REQUIRED pointer | Q8b |
| "`relates_to_fields` improves attention" | null at runtime and at design time | Q10, Q17, Q18 |
| "Metadata matters most on the weakest model" | false for rules that need fetching; shipping the data fixed haiku | Q12c, Q16 |
| "Richer metadata is always cheaper" | only when it answers the question asked | Q5 |
| "Pruning is a substantial saving" | −1.84% | Q2 |
| "Invert the pruning gates for absent fields" | haiku-only effect; keep null-field notes instead | AS |

## Unmeasured claims still in this skill

Kept because they are useful practice, labelled so nobody quotes them as findings: "roughly 90%
of AI-discovered metadata holds up under expert review", "3–4 passes per tool is normal", the
row-count thresholds for confidence levels, "one afternoon clears three weeks of async". They come
from production work on the Warmtebouw servers, not from this eval set.
