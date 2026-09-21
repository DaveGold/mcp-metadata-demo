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

> **gas-estimate tolerance changed on 2026-09-21**, from 20 to 8 (accept range
> 233–273 → 245–261). Files above that record `accept_range: 233-273` —
> `2026-09-21-opaque-live.json`, `2026-09-21-opaque-live-sonnet-n10.json`,
> `2026-09-21-n3-separators.json` — were scored under the old tolerance and are
> left as they were. Do not compare their gas-estimate counts against anything
> scored afterwards. `2026-09-21-readable-ladder-gas.json` carries both scorings.

The readable-ladder file is the one to read for the design question, because it is
the only run where an arm is correct by the ground-truth route rather than by
coincidence. Read its `the_tolerance_problem` block before quoting any number from
the three lower rungs.

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
