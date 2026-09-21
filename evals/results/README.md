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
| [`2026-09-21-q1-response-channel.json`](2026-09-21-q1-response-channel.json) | **Q1 from `open-questions.md`, and both registered predictions are wrong.** Same guidance, description vs response. 210 runs, three models. The recipe in the RESPONSE scores 29/30 where the same 438 bytes in the DESCRIPTION score 4/30. Also the first run to complete the `get_tool_call_log` audit — which found that the `inline` arm does not stamp its own log rows. |

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

Two experiments these runs make obvious but do not answer — guidance in the
response rather than the tool description, and conditional interpretation sized to
the record — are written up in [`../open-questions.md`](../open-questions.md), each
with a prediction registered in advance and the result that would falsify it. The
token figures from these runs live there too.

**Q1 has since been run and both its predictions were falsified** — see
[`2026-09-21-q1-response-channel.json`](2026-09-21-q1-response-channel.json). A fact
moved into the response gained +8 on sonnet where the prediction said it would gain
nothing; a procedure in the response scored 29/30 where the prediction said it would
stay near zero. The channel, not the amount of metadata, is what moved. Read its
`route_scoring` before quoting any lower-rung number: all 11 correct answers from the
three non-recipe arms took the wrong derivation road.

That file is also the first to carry out the `get_tool_call_log` audit the skill now
mandates, and the audit earned its keep immediately: the `inline` arm writes every row
with `variant: "unknown"`, `paramsPresent: []` and `rowCount: 0`, so it is invisible to
any server-side count — and the log's own alert told the reader to discard exactly
those rows. The cause is a **stale deploy, not a code fault**: `mcpInline` shipped at
15:42, variant stamping landed at 16:23, and it was never redeployed, while the repo
source and all 182 tests stayed green. **Redeploy before running Q2** — until then no
run involving `inline` can be audited. The log tool, the set and the skill have since
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
