---
name: run-eval
description: Run the thin/words/rich eval set (evals/questions-core.json, or the full evals/questions.json) against the three arm servers and score the results. Use when asked to run the eval, score an arm, compare arms or models on the building-profile eval, or reproduce the numbers for the talk.
---

# Run the eval

## Before running

1. All three arms must be connected in `.mcp.json` as `eval-thin`, `eval-words`,
   `eval-rich`. If `eval-words` is missing, arm B has not been built — stop and say so.
2. Re-capture `evals/addresses.json` if it is more than a few weeks old. BAG and
   EP-Online are live.
3. Confirm the `agg-01` gas formula question is resolved (see `evals/README.md`) —
   otherwise arm C scores wrong on its own flagship question.

## Running

**Default to `evals/questions-core.json` (9 questions, 243 runs).** Use the full
`evals/questions.json` (21 questions, 567 runs) only when asked for the complete
set or for the final numbers. Always say which file you ran.

For each (question, arm, model, repeat):

- Spawn the `eval-<arm>` subagent with `model` set to `haiku`, `sonnet` or `opus`.
- Pass **only the `question` string** from `questions.json`. Never pass
  `ground_truth`, `must_not_say`, `required_params` or any category tag — the
  subagent must not see what it is being scored against.
- Spawn independent runs in parallel, but keep every arm/model of the same
  question in the same batch so transient API weather hits them alike.

Default matrix: 9 questions × 3 arms × 3 models × 3 repeats = 243 runs. When
asked for a smaller slice, say which slice you ran.

## Scoring

Score each returned ANSWER against the question's record, in the parent session:

- **correct** — matches `ground_truth`. For `scoring: "exact_value"`, the number
  must be within `tolerance`. For `scoring: "judge"`, decide which of
  `ground_truth` and `must_not_say` the answer is closer to; if neither, mark
  `other`.
- **confidently_wrong** — the answer asserts `must_not_say`. An answer can be
  incorrect without being confidently wrong; that distinction is the point.
- **calls** — from CALLS, against `max_calls`.
- **right_tool_first** — first entry in TOOLS equals `correct_tool`. When
  `correct_tool` is `none`, correct means no tool call, or a call followed by an
  explicit statement that the server cannot answer it.

Treat CALLS/TOOLS/PARAMS as self-reported by the system under test — usable, but
weaker evidence than the correctness scores. Say so when reporting them.

## Reporting

Write results to `evals/results/<date>-<slice>.json`, one row per run.

Report **three tables, never one pooled number**:

1. arm × model, `model_sensitivity: "discipline"` questions only
2. arm × model, `model_sensitivity: "arcane"` questions only
3. confidently-wrong counts, arm × model

Then the per-category split. Read the split before the headline: the total is just
the headline, the categories are where the argument lives.

State plainly whether thin-Opus, rich-Haiku and thin-Haiku fell in the predicted
order, including when they did not.

When running the core set, check the control (`overheating`) first: arms B and C
should score the same on it. If they do not, report that before anything else —
it undermines every other number in the run.
