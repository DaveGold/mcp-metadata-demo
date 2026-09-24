# Evaluation — measure inside the loop, guard after it

> **Local overlay:** REQUIRED — if `<repo-root>/.skill-local/rich-domain-mcp-server/evaluation.md` exists, read it
> before the rest of this file (SKILL.md → *Local overlays*).

Expert validation ([`validation.md`](validation.md)) tells you whether the metadata is *true*.
It cannot tell you whether a model *uses* it. Only a run can, and in this repo runs did more than
score: they found the defects that no test, review or server log showed. Most registered
predictions here were wrong [P], so intuition about what a model reads is not a substitute.

Two roles, two places in the loop (SKILL.md):

- **Inside the loop (Validate):** a small measurement after each Encode pass — did the change
  arrive, and did the model use it?
- **After the loop (Harden):** the questions, fixtures and checks become a regression suite (§7).

Tags like `[Q7]` resolve in [`evidence.md`](evidence.md). The execution details of THIS repo's eval
are in its `run-eval` skill
([`.claude/skills/run-eval/SKILL.md`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/.claude/skills/run-eval/SKILL.md));
this file is the portable method, and [`harness/`](harness/) is a portable harness.

---

## Why bother: what only a run found

| found by an eval run | what tests, review and logs showed |
|---|---|
| Descriptions are cut at 2,048 chars; 70% of the richest description never arrived [Q7] | `tools/list`, tests and logs all showed the full text |
| The output schema never reaches the model [Q11] | the schema is right there in `tools/list` |
| The server's own computed alert compares a CALCULATED figure with a MEASURED target: 0/60 [BT], and still 0/20 in [Q19] | every test green — the code does what it says |
| A stale deploy wrote `variant: "unknown"` for a whole run [D] | 182 tests green, source correct |
| A result over ~25k tokens is replaced by a file notice and its guidance lost [Q9] | the server returned a valid response |
| A "control" question every arm failed [C] | it looked like a passing control |
| Self-reported call counts were wrong [A] | only the server log was right |
| The tool's own upstream fetch exhausted the data provider's quota; every call then failed [Q19c] | unit tests with a stubbed fetch passed |
| Shipped reference data was not comparable between two calls: 0/10 [Q19b] | the values were individually correct |
| Headless sessions spawned eval agents before their MCP server connected [H1] | the agent was listed as available |

The pattern: **the server side cannot see what the model received, and a unit test cannot see
what happens under load.** Check the model side, and run it for real.

---

## 0. The minimal eval — for any server, inside every loop pass

Enough to catch the defects above. About an hour of runs.

1. **5–10 questions** from real usage (or `queryIntent` logs) whose answer needs something the
   payload does NOT state outright: a constant, a scope, a comparison rule, a refusal. Add 2
   refusals (data the server does not have; a question inviting an inference). Write each
   question's ground truth as a derivation, and one line for what counts as wrong.
2. **Two variants side by side:** the one you have, and the one you just encoded. Build the new one
   BESIDE the old (a second endpoint or a flag), never in place.
3. **n = 10 per variant per question, one model you expect to be called by** (plus the weakest
   plausible one if you can afford it), both variants interleaved in the same batch.
4. **Before the run:** one live call per variant, check the call log shows it stamped with its
   own name (current code), and ask one subagent to quote the end of its tool description (the
   cut). Write down what you expect.
5. **Read every answer that a simple rule cannot classify** (§5). Count calls from the log, not
   from the model.
6. **Record** a dated results file and one line in the findings doc (§8).

Escalate to the full method (§1–§6) when a gap is below the variance bar, when you want to
attribute an effect to one layer, or before you publish a claim.

## 1. Questions

- **A question separates variants only if its answer needs something the payload does not
  state.** Questions the payload answers directly saturate everywhere and measure nothing [L2].
- **Ground truth as a derivation**, re-derived from frozen fixtures in a unit test
  (`evals/ground-truth.test.ts` in this repo). **Score the route too** — a strong model lands in
  the accept band by the wrong road [L1].
- **Controls:** refusals every variant should pass. A question every variant fails is a floor, not
  a control [C].
- **One held-out question**, written before the variant is built and never used to tune it.
- Question strings must not leak field names or the rule under test (a test can enforce it).
- Watch for questions that **invite misuse of correct data** ("in a normal, average year" invited
  annualising a quarter) — decide in advance how that is scored [Q19d].

## 2. Variants (arms)

- **One variable per variant** when you want attribution; pin it with a test that asserts
  byte-identity everywhere else.
- **A composite variant** (everything at once) is a reference and a ceiling, not an attribution.
- **Freeze every measured variant**: hash its `tools/list` + instructions in a snapshot test.
- The eval agent gets **only** that variant's tools and the question string — nothing about the
  experiment. Same agent body for every variant.

## 3. Before the run

1. **Register the prediction**: expected outcome per cell and what would falsify it. Written
   before; never edited after.
2. **Reachable:** call the variant's tool from the session that runs the eval. An agent definition
   being listed is not evidence of a connection [H1].
3. **Current code:** one live call, then the call log must show it under the variant's own name [D].
4. **Delivered:** description inside the host cut, worst-case response under the limit
   ([`delivery.md`](delivery.md)).
5. **Upstream budget:** estimate how many upstream calls the run makes, **including what the models
   will fetch on their own** (a strong model on an arm without shipped data made 7–8 multi-year
   weather calls per run), against the provider's quota and concurrency limits [Q19c].

## 4. The harness — and its failure modes

A portable harness is in [`harness/`](harness/):

| file | does |
|---|---|
| `run_wave.sh` | one wave: a fresh headless `claude -p` parent that waits for the MCP tools (ToolSearch), then spawns the eval subagents in parallel with only the question |
| `extract.py` | reads the parent's transcript: verbatim answer, tokens, duration, and every MCP call with result size, error, rate-limit and file-notice flags — idempotent per wave |
| `check_wave.py` | a wave with any missing run, empty answer or rate-limited call is incomplete |
| `run_all.sh` | runs waves sequentially and re-runs an incomplete wave WHOLE, up to 3 times |
| `field_probe.py` | the field-reading probe (`discovery.md`): a tool-less model reads one bare response; per field kind + unit scored against a ground-truth file. For deciding WHICH fields need explanation, before any eval |

Why a fresh headless parent per wave: an MCP connection is fixed when a session starts, so a
running session may not reach a variant added after it began; a new `claude -p` loads the current
`.mcp.json`. It is also the only way to control the host's description cap for a run.

**Checklist — each item has cost a run in this repo:**

- [ ] **Tool-less subagents.** The parent can spawn an agent before its MCP server connects; the
      host refuses it (or worse, the agent answers without tools). `run_wave.sh` waits via
      ToolSearch; `check_wave.py` catches what still slips through [H1].
- [ ] **Your own rate limiter.** Keep waves small (≤ 3 subagents per variant); multi-call questions
      trip it first.
- [ ] **The upstream provider's quota** — shared by every variant on the same egress, and consumed
      by the models' own extra fetches. Treat a 429 as NO_RECORD, never as model behaviour [Q19c].
- [ ] **Re-run whole batches.** Replacing only the failed runs breaks the same-batch comparison;
      re-run the whole wave, or re-run as same-batch pairs.
- [ ] **Stale deploy.** Check the variant stamp in the log after every deploy [D].
- [ ] **Self-reported counts.** Use the harness metrics and the server log [A].
- [ ] **Log gaps.** Calls rejected by input validation never reach the handler and are not logged;
      explain them in the audit, do not absorb them [H3]. A log tool that pages without an offset
      cannot audit a big run — query the store directly.
- [ ] **Timestamps.** Record wave windows with file mtimes or a real clock; `date +%N` does not exist
      on macOS.
- [ ] **Scripts must be idempotent** — a manual re-extract must not duplicate rows.

## 5. Scoring

| outcome | meaning |
|---|---|
| `correct` | right value **and** right route |
| `confidently_wrong` | a wrong answer asserted as fact — the dangerous one |
| `declined` | refused or flagged uncertainty — correct on refusals |
| `fabricated` | invented a constant, unit, threshold, field or reference |
| `partial` | right direction, incomplete (e.g. 9 of 11 dates) |
| `other` | none of the above (asked for data the question did not give) |
| `NO_RECORD` | infrastructure failure — excluded, and the batch re-run |

- **A deterministic rubric first, then read by hand everything it cannot classify, plus a random
  sample of what it did classify.** In Q19 the rubric misclassified correct answers on five
  questions; unread, it would have reversed one comparison (heat-pump-triage: 13 vs 2 instead of
  18 vs 20) and shown gaps that are not there on two others [H2].
- Keep borderline classes visible in the results (e.g. "states the gap, then rejects the
  comparison") instead of folding them silently into correct.
- Score on the **lead** figure when an answer gives several, and flag the rest.
- Stable wrong answers are more dangerous than scattered ones [S1].

## 6. Reading the numbers

- **Variance bar** [V]: at n=10 a per-cell gap ≥ 8 is a size; 4–7 is direction only; < 4 is noise.
- **Same batch, interleaved variants**, or it is not a comparison. Same batch protects direction,
  not size.
- **Never subtract a number in one results file from a number in another.**
- **Large-n nulls are the most robust results.**
- **Audit against the server log**: every run's calls against the log rows of its time window [A].
- **Report per model.** Effects here were routinely haiku-only [AS] or middle-model-only [Q12].

## 7. Harden — the eval becomes a regression suite

Once the loop stabilises, keep these running (CI where possible, a scheduled re-run otherwise):

- [ ] **Budget tests:** description and instructions ≤ 2,048 (ceiling ~1,800), load-bearing
      sentences before fixed offsets, worst-case response under the size guard.
- [ ] **Name and rule tests:** units in names, provenance on every rename and rule, each rule on a
      fixture record that triggers it, no numeric threshold that compares calculated with measured.
- [ ] **Ground-truth tests:** every question's expected value re-derived from frozen fixtures.
- [ ] **Frozen variants:** hash snapshots of every measured variant's wire surface.
- [ ] **Upstream-cost tests:** the fetches a shipped computation makes are window-sized and cached.
- [ ] **Deploy check:** one live call per variant, stamped in the log, after every deploy.
- [ ] **Scheduled re-run** of the eval set: registers and APIs drift, hosts change their cuts,
      models change. Re-capture the fixtures first.

## 8. Recording

A new `evals/results/<date>-<slug>.json` per run, never edited afterwards: date, models, variants,
n, protocol, infrastructure incidents, one row per run (answer, verdict, manual flag + reason,
calls, tokens), the log audit, and a caveats list. Then:

- a line in the findings doc for every **defect** the run found, with its repro;
- the rule's **provenance line** in source updated with the result;
- a row in [`evidence.md`](evidence.md) when the result changes a rule of this skill.
