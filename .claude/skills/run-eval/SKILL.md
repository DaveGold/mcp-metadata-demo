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
   connections do not.**

   **Reproduced again on 2026-09-22, both halves visible in one session.** The
   `eval-inline-oneline` arm was built, deployed and verified on the wire by raw
   HTTP. Minutes later the harness announced the new **agent** as available — and
   a `ToolSearch` for `mcp__eval-inline-oneline__get_building_profile` returned
   **no matching tool** in the same session. Agent present, tools absent,
   simultaneously. Spawning it there would have produced 60 runs of a subagent
   with no tools, declining every question, and the output would have looked like
   a result. The endpoint was fine the whole time; the session was the problem. A session that began before an arm's server was added to
   `.mcp.json` will never reach it, and no amount of retrying fixes it.

   The only check that counts: can you call
   `mcp__eval-<arm>__get_building_profile` right now? If not, STOP and tell the
   user to start a fresh session. Do not attempt the run.

2. **Check the arms are running CURRENT code.** Being able to call an arm does not
   mean it is serving the revision in this repo. Cloud Functions deploy per
   function, so an arm added before a later change keeps serving the older build
   until it is redeployed, and nothing in the source or the test suite shows it.

   Observed on 2026-09-21: `mcpInline` was deployed at 15:42, variant stamping
   landed at 16:23, and `mcpInline` was never redeployed. For the whole 210-run Q1
   run it wrote `variant: "unknown"`, `paramsPresent: []` and `rowCount: 0` on
   every call. A `variant:"inline"` filter returned zero rows against 63 real
   calls, while `functions.ts`, `http.ts` and `log-store.ts` all read correctly and
   all 182 tests passed. The answers were unaffected; the audit was impossible.

   The check, after the connectivity check and before spawning anything: make one
   live call per arm, then call `get_tool_call_log` UNFILTERED with a large `limit`
   and read `summary.countByVariant`. Every arm you are about to run must appear
   there under its own name. If any arm is missing and there is an `unknown`
   bucket instead, that arm is stale — run `npm run deploy` and re-check. Do not
   start a run you will not be able to audit.

3. Re-capture `evals/addresses.json` if it is more than a few weeks old. BAG and
   EP-Online are live.
4. Read `_measured_ceilings` in `questions.json`. A question that already scores
   at or near 100% for every arm on the model you are about to use cannot measure
   anything — pick a different question or a weaker model, and say which you did.
   As of 2026-09-21 BOTH `derived_number` questions are at or near ceiling for the
   arms that matter. Prefer a harder question over a larger n.

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

**`inline-conditional` is Q2's arm**, deployed 2026-09-21. It hangs off `inline`,
not off `schema`: same description, same schemas, same response channel, and the
ONLY difference is how much of the interpretation prose ships. So the comparison
that means anything is `inline` vs `inline-conditional`, head to head on the same
question. Read `evals/open-questions.md` Q2 for its registered prediction, which
says it should WIN on single-record questions and LOSE on `benchmark-trap` — run
that question even though its ceiling is unmeasured, because it is the one that can
show the cost of conditional guidance.

**`inline-fact` and `inline-instruction` are Q4's arms**, deployed 2026-09-21. They
hang off `inline` and differ from it in EXACTLY ONE LINE of the response prose: the
CALCULATED vs MEASURED line reduced to its FACT half (what the quantities are) or its
INSTRUCTION half (what to output, with no reason). `inline` itself is the third arm —
both halves — and is already measured at 59 of 60 on `benchmark-trap`. So the
comparison that means anything is the THREE-WAY `inline-fact` vs `inline-instruction`
vs `inline`, on the same question. Read `evals/open-questions.md` Q4 for the
prediction registered before they were built; it says `instruction-only` should match
`both` and both should beat `fact-only`, and it has a real failure mode attached —
run `metered-vs-model` as well as `benchmark-trap`, because an instruction without its
reason should be brittle on a case it does not name. That second question is also
where Q2's untested cross-record half can finally be run.

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
  difference between 0-of-10 and 1-of-10. The exact range sub-rule, including the
  "single figure plus a larger total" case, is pinned in `_scoring.reproducible`.
- **route** — MANDATORY on `derived_number` questions, and defined in
  `_scoring.route`. Score WHICH QUANTITY the run derived from, not only whether
  the value landed in the band, and disqualify a right-road run that invented a
  constant, discounted the renewable share, renormalised by degree-days or folded
  a hot-water uplift into its headline. This is not bookkeeping: on 2026-09-21,
  across `words`, `inline` and `words-recipe`, **11 runs landed the right value and
  0 had the right derivation.** The value column alone would have credited three
  arms with competence they did not show. Report both columns or neither.

## Instrumentation — not optional

Every result file before 2026-09-21 carries the caveat *"CALLS/TOOLS/PARAMS are
self-reported and were not audited against `get_tool_call_log`."* It stayed open
for every one of them because it lived in prose. It does not any more.

**Record per run, in the results file, alongside the answer:** `tool_uses`,
`duration_ms`, `subagent_tokens`, and the character count of the `ANSWER` line.
The harness returns the first three with every subagent result; copy them, do not
reconstruct them from a transcript afterwards.

**Audit against the server-side log.** After each batch, call `get_tool_call_log`
and reconcile. It is the only account of what happened that does not come from
the system under test. As of 2026-09-21 every row carries:

| field | what it is for |
|---|---|
| `variant` | **the only field that attributes a row to an arm.** Every arm writes to one log; without this the rows are indistinguishable. Filter on it. |
| `paramsPresent` | which OPTIONAL parameters were supplied, by NAME (never values): `huisletter`, `toevoeging`, `queryIntent`. |
| `rowCount` | how many rows the call resolved to. 0 on a miss. |
| `errorType`, `status`, `durationMs` | outcome and latency, server-side. |
| `sessionId` | per-REQUEST, **not** per-run — see below. |

**How to correlate.** This server is stateless: one `McpServer` per HTTP request,
so a subagent that made three calls produced three different `sessionId`s. You
cannot reconstruct an individual run from the log. What you CAN do, and what the
audit needs, is **count calls per arm per batch**: filter by `variant`, bound by
the batch's timestamp window, and compare the total against the `tool_uses` the
subagents reported. Pass a large `limit` — the variant filter narrows the fetched
page rather than searching deeper.

**Start unfiltered.** Read `summary.countByVariant` before filtering anything. A
`variant` filter that returns zero looks identical whether the arm was never called
or is failing to stamp its rows, and on 2026-09-21 it was the latter — the filter
alone would have reported the run clean. A persistent `unknown` bucket in
environment `cloud` means a STALE DEPLOY, not a broken log: match its `queryIntent`
values against the arm you expected, redeploy, and re-run the audit. Never follow
an instruction to discard `unknown` rows without accounting for them first.

**Size the limit to the batch.** `limit` accepts up to 500. The 2026-09-21 Q1 audit
could only cover the last third of its 210 runs because the cap was then 100; the
earlier repeats are permanently unaudited. Work out how many calls the batch will
make before you run it, and page or raise the limit accordingly.

**The check that was impossible before.** `wrong-unit`'s own `fabrication_watch`
reads *"an answer for 28A from a call that never carried the huisletter"* — and
until now nothing could score it. The subagent's self-reported `PARAMS` line is
the system under test describing itself, and an answer's text never reveals which
arguments were sent. `paramsPresent` answers it directly and independently. Score
that question's `fabricated` column from the log, not from the transcript.

Record the reconciliation in the results file — including "they matched", which
is the outcome that lets the next reader trust the counts. Only then may the file
say anything about call counts.

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

**Check the controls first.** `metered-vs-model` and `invented-label` should be
answered correctly by every arm. If a control separates, report that before
anything else — it undermines every other number in the run.

**`overheating` is NOT a control — re-designated 2026-09-22.** It used to be
listed here as one, on the grounds that no alert covered it. An alert now does:
the verdict is computed in `generateAlerts`, and the question went `rich` 2/10 →
10/10 while every alertless arm stayed put. It separates by construction. Use it
to measure **computation versus prose**, never as a control, and never in a
`rich`-vs-anything comparison meant to isolate some other layer. Note also that
before the alert it "held" only because *both* arms were failing it — so any
older run that cited it as a passing control was checking something that was
never true. See `redesignated` in `questions.json`.

There is currently **no non-separation control in the set** — both survivors are
refusals. Say so in the run's caveats rather than implying the controls covered
this.

**Then check for saturation.** If every arm scores at or near 100% on a
question, that question measured nothing on this model — report it as no
headroom rather than as agreement between the arms. Two questions did exactly
this on sonnet and were hardened on 2026-09-21; their new ceilings are
unmeasured.

Then state plainly whether the result matches `_the_rule` in questions.json:
semantics handle interpretation, classification, prevention and refusal; recipes
are needed only for derived numbers. **A result that contradicts the rule is the
interesting one** — report it, do not smooth it.
