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
3. Confirm the `agg-01` gas formula question is resolved (see `evals/README.md`) —
   otherwise arm C scores wrong on its own flagship question.

## Running

There is ONE set: `evals/questions.json`, 9 questions. Each carries a `shape`,
an `outcome_class` and per-regime results in `regimes`.

**Pick the arms by regime.** The readable regime is thin / words / rich; the
opaque regime is opaque / opaque-words. A question's `regimes` block says which
have been run and what happened. Do not compare a readable-arm result against an
opaque-arm one — they differ in field naming as well as metadata.

Read `_the_rule` before scoring: semantics handle interpretation, classification,
prevention and refusal; recipes are needed only for derived numbers. A result
that contradicts it is the interesting one, so report it rather than smoothing it.

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
