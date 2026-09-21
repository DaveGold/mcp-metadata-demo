---
name: run-eval
description: Run the eval set in evals/questions.json against the arm servers (thin/words/rich, or opaque/opaque-words) and score the results. Use when asked to run the eval, score an arm, compare arms or models on the building-profile eval, or reproduce the numbers for the talk.
---

# Run the eval

## Before running

1. **Check the arms' MCP TOOLS are connected.** Confirm the
   `mcp__eval-<arm>__get_building_profile` tools are actually available to this
   session — not that the arm appears in `.mcp.json`, and **not that the
   `eval-<arm>` agent appears in the agent list.**

   The agent list is NOT a proxy for this, and treating it as one will waste a
   whole run. Observed on 2026-09-21: after `eval-inline` was added mid-session,
   the harness picked up the new **agent** from `.claude/agents/` and announced it
   as available, while the **MCP server stayed unconnected**. Spawning that agent
   would have produced a subagent with zero tools, declining every question — a
   run that looks like a result and is an artefact of the harness.

   Skills reload mid-session. The agent registry can reload mid-session. **MCP
   connections do not.** A session that began before an arm's server was added to
   `.mcp.json` will never reach it, and no amount of retrying fixes it.

   The only check that counts: can you call
   `mcp__eval-<arm>__get_building_profile` right now? If not, STOP and tell the
   user to start a fresh session. Do not attempt the run.
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

**Pick the arms off the ladder.** Each rung adds ONE layer to the rung before
it, so a gap between ADJACENT rungs is attributable to that layer and a gap
between distant ones is not:

| rung | adds | answers |
|---|---|---|
| `thin` (minimal) | readable field names only | the floor |
| `schema` | typed + `.describe()`d input/output schemas | what the schema buys |
| `words` | the prose description | what the words buy |
| `rich` | server-computed `alerts`, incl. the derived gas figure | what computing it for them buys |

`opaque` / `opaque-words` are the orthogonal FIELD-NAMING axis: the same payload
with names stripped to terse codes, without and with the glossary. Never compare
across the two axes — they differ in field naming as well as metadata.

Compare adjacent rungs. `thin` vs `rich` measures four changes at once and tells
you nothing about which one mattered; that conflation is what the `schema` rung
was added to break.

`mcpSchema` is deployed and the `eval-schema` arm answers; it was first measured
on 2026-09-21 over 20 runs. Its description is byte-identical to `thin`'s, so if
the two arms ever return different prose, the deploy is stale — check that rather
than assuming the schema layer did it.

**`inline` is a FORK, not a rung.** It hangs off `schema` beside `words`, carrying
the same prose by a different channel:

```
thin → schema → words → rich
            \
             → inline      (same bytes as `words`, in the RESPONSE)
```

So the comparisons that mean anything are `schema → inline` (the channel, against
the same base `schema → words` is measured from) and `inline` vs `words` (the two
channels head to head). `inline → rich` is NOT an adjacent-rung comparison and
must not be reported as one: it crosses both the channel and the computation.

`inline` was **deployed on 2026-09-21** and verified on the wire: description
byte-identical to `schema`'s, `interpretation` present in the response (4,338
chars), no `alerts`, same building data as the other arms. Its description is
byte-identical to `schema`'s, enforced by `get-building-profile-inline.test.ts`.
Read `evals/open-questions.md` Q1 for the predictions registered BEFORE it runs —
they are there so the result can contradict them.

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

## Instrumentation — not optional

Every result file before 2026-09-21 carries the caveat *"CALLS/TOOLS/PARAMS are
self-reported and were not audited against `get_tool_call_log`."* It stayed open
for every one of them because it lived in prose. It does not any more.

**Record per run, in the results file, alongside the answer:** `tool_uses`,
`duration_ms`, `subagent_tokens`, and the character count of the `ANSWER` line.
The harness returns the first three with every subagent result; copy them, do not
reconstruct them from a transcript afterwards.

**Audit the call counts.** After each batch, call `get_tool_call_log` on the arms
in it and reconcile against what the subagents reported. That is a server-side
count that does not depend on the system under test describing its own behaviour.
Record the reconciliation — including "they matched" — and only then may a
results file say anything about call counts.

This exists because `open-questions.md` Q3 turns on it: `rich` costs FEWER tokens
per run than `words` despite carrying strictly more, and the two candidate
explanations (fewer round trips vs. shorter output) are told apart only by these
numbers. Q3 needs no new arm and no deploy, so it rides along with whatever you
are running anyway. There is no reason to skip it and no excuse for another file
carrying the same caveat.

CALLS/TOOLS/PARAMS as *self-reported by the subagent* remain too weak to headline
on their own — say so — but they are now checkable, so check them.

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
