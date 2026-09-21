---
name: run-eval
description: Run the eval set in evals/questions.json against the arm servers (thin/words/rich, or opaque/opaque-words) and score the results. Use when asked to run the eval, score an arm, compare arms or models on the building-profile eval, or reproduce the numbers for the talk.
---

# Run the eval

## Before running

1. **Check the arms are CONNECTED, not merely configured.** Confirm the
   `mcp__eval-thin__*`, `mcp__eval-words__*` and `mcp__eval-rich__*` tools are
   actually available to this session, and that `eval-thin` / `eval-words` /
   `eval-rich` appear in the agent list.

   Their presence in `.mcp.json` and `.claude/agents/` proves nothing: skills
   reload mid-session but **MCP connections and the agent registry are fixed when
   the session starts**. A session that began before those files existed — for
   example one where they arrived via a merge or a branch switch — will load this
   skill and still have no arms. That is not a deploy problem and no amount of
   retrying fixes it.

   If either is missing, STOP and tell the user to start a fresh session in a
   checkout where the files are already present. Do not attempt the run.
2. Re-capture `evals/addresses.json` if it is more than a few weeks old. BAG and
   EP-Online are live.
3. Read `_measured_ceilings` in `questions.json`. A question that already scores
   at or near 100% for every arm on the model you are about to use cannot measure
   anything — pick a different question or a weaker model, and say which you did.

## Running

There is ONE set: `evals/questions.json`, 9 questions. Each carries a `shape`,
the `question` string, `ground_truth`, `must_not_say` and `scoring`. It carries
NO per-question results — `ground-truth.test.ts` actively fails if `regimes` or
`outcome_class` reappear there. What happened on previous runs lives in
`results/`, starting with `results/README.md`.

**Pick the arms by regime.** The readable regime is thin / words / rich; the
opaque regime is opaque / opaque-words. Do not compare a readable-arm result
against an opaque-arm one — they differ in field naming as well as metadata.

Before scoring, read `results/2026-09-21-shape-replication.json` for `_the_rule`
(semantics handle interpretation, classification, prevention and refusal; recipes
are needed only for derived numbers) AND the two live runs that failed to
replicate it. Treat the rule as an open question, not a finding. A result that
contradicts it is the interesting one, so report it rather than smoothing it.

For each (question, arm, model, repeat):

- Spawn the `eval-<arm>` subagent with `model` set to `haiku`, `sonnet` or `opus`.
- Pass **only the `question` string** from `questions.json`. Never pass
  `ground_truth`, `must_not_say`, `required_params` or any category tag — the
  subagent must not see what it is being scored against.
- Spawn independent runs in parallel, but keep every arm/model of the same
  question in the same batch so transient API weather hits them alike.

Default matrix: 9 questions × 3 readable arms × 3 models × 3 repeats = 243 runs. When
asked for a smaller slice, say which slice you ran.

## Scoring

Score each returned ANSWER against the question's record, in the parent session.
The four metrics are defined in `_scoring` in questions.json:

- **correct** — matches `ground_truth`. For `scoring: "exact_value"`, within
  `tolerance`. For `"judge"`, decide whether the answer is closer to
  `ground_truth` or to `must_not_say`; if neither, score it `other`.
- **confidently_wrong** — asserts `must_not_say`. The headline number: an answer
  can be incorrect without being confidently wrong, and that distinction is the
  whole point.
- **declined** — said it could not answer, without asserting `must_not_say`.
  Its own column, never folded into `correct` or `confidently_wrong`. A refusal
  and a fabrication are different failures and the argument turns on the
  difference.
- **fabricated** — invented a constant, unit or threshold not in the payload.
  Each question's `fabrication_watch` says what to look for. This replaced a
  call-count metric, which carried no signal: `get_building_profile` is one-shot,
  so almost every run is a single call.
- **reproducible** — how many of n runs land in range, and the SPREAD of the
  answers. Report it alongside `correct`, never instead: one arm scored 1-of-4
  at a 44% spread where the other scored 3-of-3 at 0%, and neither number alone
  says that. Where a run answers with a RANGE, score the MIDPOINT against the
  tolerance and record the width. Fix that rule before you look at the answers —
  stronger models answer in ranges far more often, and on one run it was the
  difference between 0-of-10 and 1-of-10.

CALLS/TOOLS/PARAMS are self-reported by the system under test. Usable for
spotting thrashing, too weak to headline — say so when reporting them.

## Reporting

Write results to `evals/results/<date>-<slice>.json`, one row per run, with an
explicit caveats list and the protocol used (live tool calls, or
payload-in-prompt — the two are not comparable). See `evals/results/README.md`.

Report **by `shape`, never as one pooled number.** The shapes are where the
argument lives:

1. arm × model on `derived_number` questions
2. arm × model on everything else, split by shape
3. confidently-wrong and fabricated counts, arm × model

**Check the controls first.** `overheating` is covered by no alert, so rich
should hold no advantage over words; `metered-vs-model` and `invented-label`
should be answered correctly by every arm. If a control separates, report that
before anything else — it undermines every other number in the run.

**Then check for saturation.** If every arm scores at or near 100% on a
question, that question measured nothing on this model — report it as no
headroom rather than as agreement between the arms. Two questions did exactly
this on sonnet and were hardened on 2026-09-21; their new ceilings are
unmeasured.

Then state plainly whether the result matches `_the_rule` in questions.json:
semantics handle interpretation, classification, prevention and refusal; recipes
are needed only for derived numbers. **A result that contradicts the rule is the
interesting one** — report it, do not smooth it.
