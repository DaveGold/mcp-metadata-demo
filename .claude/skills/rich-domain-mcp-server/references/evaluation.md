# Evaluation — measuring whether a metadata change worked

Expert validation ([`validation.md`](validation.md)) tells you whether the metadata is *true*.
It cannot tell you whether a model *uses* it. That needs a measurement, and this repo's eval set
is a worked, reusable method for one. In this repo the execution steps live in the `run-eval`
skill ([`.claude/skills/run-eval/SKILL.md`](../../run-eval/SKILL.md)); this file is the method,
portable to any server.

Why bother: most registered predictions in this repo were **wrong**, including ones written by
the person who built the tool. Intuition about what a model reads is not reliable [P].

---

## 1. Questions

- **A question separates arms only if its answer needs something the payload does not state** — a
  constant, a convention, a comparison rule, a scope. Questions the payload answers directly
  saturate on every arm and measure nothing [L2].
- **Write the ground truth as a derivation, not only a value**, and test it: re-derive every
  expected value from frozen fixture data in a unit test (`evals/ground-truth.test.ts`). Score the
  **route** too — a strong model lands in the accept band by the wrong road [L1].
- **Include refusals** (`correct_tool: none`, a field that does not exist). They are the controls
  every arm should pass.
- **A question every arm fails is a floor, not a control** [C].
- Keep one **held-out** question written before the arm is built — the only partial answer to
  "the author wrote the metadata and the questions".
- Question strings must not leak field names or the rule being tested (a test can enforce it).

## 2. Arms

- **One variable per arm.** Build variants that differ by exactly one surface (the same sentence
  in the description vs the response; with vs without one line), and pin that with a test that
  asserts byte-identity everywhere else.
- **Freeze measured arms.** Hash each arm's `tools/list` + instructions in a snapshot test; a
  change to a measured arm makes its results unreproducible.
- A **composite** arm (everything applied at once, like `best`) is a ceiling and a reference, not an
  attribution: compare it to the arms that isolate each layer.
- Give the eval agent **only** the arm's tools and the question string — nothing about the
  experiment.

## 3. Before the run

1. **Register the prediction** in `open-questions.md`: the expected outcome per cell, and the
   result that would falsify it. Written before, never edited after.
2. **Verify the arm is reachable** — call its tool from the session that will run the eval. An
   agent definition existing is not evidence of a connection; MCP connections are fixed when a
   session starts.
3. **Verify the arm runs current code** — one live call, then read the server's call log; an
   unstamped/`unknown` row means a stale deploy [D].
4. **Verify delivery** — the description is inside the host cut, the response is under the
   limit ([`delivery.md`](delivery.md)).
5. Mind rate limits: run in small waves.

## 4. Scoring

Score each run on more than correct/incorrect:

| outcome | meaning |
|---|---|
| `correct` | right value **and** right route |
| `confidently_wrong` | a wrong answer asserted as fact — the dangerous one |
| `declined` | refused or flagged uncertainty — safe, often right on refusals |
| `fabricated` | invented a constant, unit, threshold or field |
| route | which derivation it used |
| calls / tokens / duration | from the harness and the server log, not from the model's self-report |

Stable wrong answers are more dangerous than scattered ones, because they survive a spot check
[S1].

## 5. Reading the numbers

- **The variance bar** [V]: at n=10, a per-cell gap ≥8 is a size; 4–7 is direction only; <4 is
  noise. The same cell measured twice on one day read 8/10 and 2/10.
- **Same batch, interleaved arms**, or it is not a comparison. Same batch protects direction, not
  size.
- **Never subtract a number in one results file from a number in another.** Different sittings,
  different caps, different deploys.
- **Large-n nulls are the most robust results** — noise has to create agreement to fake one.
- **Audit against the server log.** Reconcile every run's calls with the log rows; self-reported
  call counts were wrong more than once [A].
- Report per model. Effects in this repo were routinely haiku-only (absent-sizing [AS]) or
  middle-model-only (partial-period rule [Q12]).

## 6. Recording

A new `evals/results/<date>-<slug>.json` per run, never edited afterwards: date, models, arms, n,
protocol (live calls vs payload-in-prompt — not comparable), one row per run with answer and
outcome, the log audit, and an explicit caveats list. Then add the result to the skill's
[`evidence.md`](evidence.md), and to the rule's provenance line in source.
