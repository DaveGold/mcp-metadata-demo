# Eval set — does the metadata layer change what the agent does?

Ten questions against Dutch building data (BAG + EP-Online), asked of the same
server deployed at different metadata tiers. Same data, same questions — the
arms differ only in how much the tool explains itself.

- **[`questions.json`](questions.json)** — the set. Start here.
- [`research-frame.md`](research-frame.md) — why these experiments: the axes, the
  coverage, the claim boundaries
- [`addresses.json`](addresses.json) — the frozen profiles every answer derives from
- [`ground-truth.test.ts`](ground-truth.test.ts) — proves it, under `npm test`
- [`results/`](results/) — what happened when it was run

---

## The set

| shape | question | what it asks for |
|---|---|---|
| **derived number** | `gas-estimate` | a value the payload does not contain |
| | `total-vs-per-m2` | a total, where the obvious denominator is the wrong one |
| **classification** | `heat-pump-triage` | a three-way ordering against named thresholds |
| **prevention** | `building-size` | stop an answer — the unit area is not the building |
| | `benchmark-trap` | stop a comparison — the field name lies about the unit |
| **selection** | `wrong-unit` | reach a specific unit the thin arm cannot address |
| **interpretation** | `overheating` | read one value against its threshold |
| **refusal** | `metered-vs-model` | the server has no meter data |
| | `invented-label` | a 1653 building with no registered label |
| | `absent-sizing-input` | the field the answer needs is null, and only one arm says which |

`metered-vs-model` and `invented-label` are **controls**. `overheating` was
designed as one — it is covered by no alert, so the rich arm should have no
advantage — but **it does not hold**: on 2026-09-22 both arms asserted no-or-low
risk in 7–8 runs of 10 against a ground truth of *significant*, by inventing
thresholds instead of using the one in the prose. Treat it as a live defect, not
a control, until that is fixed. The two refusals should be answered correctly
by every arm. A set containing only questions the thin arm fails is selection,
not evidence — if the controls ever separate, something other than the metadata
is driving the result and the run is suspect.

## The arms

| regime | arms | differ by |
|---|---|---|
| **readable** | `thin` · `words` · `rich` | prose, schemas, computed alerts |
| **opaque** | `opaque` · `opaque-words` | the description, and nothing else |

The opaque pair exists because the thin arm was never metadata-free: it still
returns `gebruiksoppervlakte_thermische_zone_m2` and `berekeningstype`, and a
model reads straight through those names. The opaque arms rename everything to
what a legacy register actually emits (`f_ga`, `calc_t`, `st: 2`), so the
description is the only variable left.

**Never compare across regimes** — they differ in field naming as well as
metadata.

## Running it

Ask each arm the `question` verbatim. Pass nothing else — not the ground truth,
not `must_not_say`, not the shape.

**n=3 is not enough, and n=10 is often not either.** One arm answered 140,
240–260, 200–220 and 200–250 to the same question; and on `absent-sizing-input`
four separate passes at n≤10 gave four different verdicts, from level to 3×.
Use **n≥10 per cell**, keep every arm of a question **in the same batch** so
transient API weather hits them alike, and treat a gap of a few runs in one
sitting as unmeasured. Record `tool_uses`, `duration_ms`, `subagent_tokens` and
the answer's character count per run — the last one is what told Q3 apart from
its own prediction.

Score four things, and report **per shape**, not just a total:

| metric | |
|---|---|
| **correct** | matches `ground_truth`, within `tolerance` where given |
| **confidently wrong** | asserts `must_not_say` — the difference between a wrong answer and an honest "I can't" |
| **fabricated** | invented a constant, unit or threshold; `fabrication_watch` says what to watch for |
| **reproducible** | how many of n runs land in range, and the spread |

`.claude/agents/eval-*.md` and `.claude/skills/run-eval/` automate this against
the deployed endpoints.

**Audit every run against `get_tool_call_log`**, unfiltered, reading
`summary.countByVariant` before applying any filter. It is the only account of
what happened that does not come from the system under test — and self-reported
call counts have been caught disagreeing with it.

## Trusting the answers

Every expected value is re-derived from `addresses.json` by
`ground-truth.test.ts`, which also asserts the traps are real — that the BAG
denominator gives a *different* answer from the thermal-zone one, that the three
triage addresses fall in three *different* bands. Nothing in the set is
invented, and a stale re-capture fails the build instead of passing quietly.

BAG and EP-Online are live registers. Re-capture before a scoring run.

---

## What we found

Everything below is from runs recorded in [`results/`](results/), each with its
own caveats. The picture changed substantially on 2026-09-21/22: the early
findings were n=2–3 and mostly Haiku, and have since been re-run at **n=10–20 per
cell across three models**. Where a claim has been superseded it says so.

**Six questions were registered in [`open-questions.md`](open-questions.md)
before they were run. All six are now answered — and five of the six registered
predictions were wrong.** That pattern is itself the most reliable thing here:
the effects are large and legible, and intuitions about *why* were wrong five
times out of six.

**Six more are registered and open (Q7–Q12).** They come from
[`research-frame.md`](research-frame.md), which is the map the register is drawn
on: the six axes a placement effect could run along — channel, timing, distance,
conditionality, addressability, activation — which of them the answered questions
actually cover, and which design principles remain unfalsified. Read it before
quoting any result here as a general MCP rule; it says plainly what this repo can
and cannot support.

### 1 · Semantics and computation buy different things

Ablating the guide — glossary alone, versus glossary plus the derived-figure
recipe — separates two interventions usually conflated:

| shape | no guide | glossary only | + recipe |
|---|---|---|---|
| derived number | `40.02` ×3 | `UNKNOWN` · `UNKNOWN` · `295` | **`253` ×3** |
| classification | `VERY SUITABLE` ×2 | **`SUITABLE` ×2** | not needed |
| prevention | `58.1` · `102.5` | **`CANNOT-COMPARE` ×2** | not needed |

> **Semantics handle interpretation, classification, prevention and refusal.
> Recipes — or server-side computation — are needed only for derived numbers.**

**Status: open, not settled.** Two live-tool-call runs failed to replicate it
(`2026-09-21-opaque-live.json`), and it is carried in `questions.json` as
`_the_rule` with that warning attached. Q4 is consistent with it and sharpens it
(§5). Treat a contradicting result as the interesting one.

### 2 · A misleading name is worse than no name

With readable names, full prose **and** alerts, Haiku and Sonnet both benchmarked
`berekend_energieverbruik_kwh_m2` against a real-world target. The name says
*kWh/m²*, so they trusted it and skipped the prose beside it saying not to.
Rename it to `bev` and the same model, on the same data, consults the guide and
declines correctly.

Good naming is metadata. **Wrong naming is anti-metadata** — it defeats the
guidance sitting next to it.

### 3 · The layer collapses variance, not just error

On `gas-estimate` the rich arm returned `253` three times; the thin arm returned
`140`, `240–260`, `200–220`, `200–250` — a 44% spread, right once in four.

Two failure shapes are worth telling apart: where the payload offers **no** path,
the model improvises and scatters; where it offers an **obvious but wrong** path,
the model is perfectly stable and perfectly wrong. The stable one looks reliable.

### 4 · Guidance works far better in the RESPONSE than in the description

**Q1, 210 runs, three models.** The same 438 bytes of recipe scored **29/30 in the
response and 4/30 in the tool description**. Both registered predictions were
falsified.

The description is written before the data is known, so it must carry every
branch; the response is the only channel that can be conditional on the record.
That makes the channel a design choice, not a detail.

### 5 · Semantics carry behaviour — an instruction alone is inert

**Q4, 180 runs, three models.** The sentence that took `benchmark-trap` from
**0/60 to 59/60** bundles a FACT (what the quantities are) with an INSTRUCTION
(what to output). Split them:

| arm | haiku | sonnet | opus | total |
|---|---|---|---|---|
| both halves | 10 | 10 | 10 | **30/30** |
| fact only | 5 | 10 | 10 | **25/30** |
| instruction only | 0 | 0 | 10 | **10/30** |

The prediction was the exact opposite. The mechanism is legible: the instruction
is conditional — *"where a question asks about a **metered** benchmark"* — so its
trigger condition **is** the withheld fact. On a control question whose wording
contains "metered", the same arm scores 30/30.

> **An instruction is not executable without the semantics that say when it
> applies.** The "specify behaviour, not semantics" reframing gets no support.

### 6 · Richer metadata can be *cheaper*, and not for the reason anyone guessed

**Q3, 40 runs, two models.** `rich` costs ~500–600 tokens less per run than
`words` despite carrying strictly more. Measured with no runs at all, `rich` pays
**~378 tokens *more* on input** every call (bigger tool definition, bigger
response). So the saving must exceed the gap:

| | haiku | sonnet |
|---|---|---|
| must be saved somewhere | 972 | 883 |
| explained by a shorter answer | 11 | 40 |
| **residual** | **99%** | **95%** |

Call counts are identical in 19 of 20 pairs, so it is not round trips. The answer
is barely shorter, so it is not output. With the same calls and comparable answer
lengths, `words` takes **1.63×/2.01× longer**.

> **The saving is deliberation.** Richer metadata can be cheaper per run even
> though it is strictly larger on the wire, because the dominant cost is the model
> working out what it was not told.

### 7 · Conditional pruning is free — and only bites the weakest model

**Q2 + follow-ups, 240+ runs.** Sending only the guidance the record calls for
costs nothing in accuracy (39/90 vs 39/90; and 30/30 vs 30/30 on a record where
**two thirds** of the block is pruned) and saves little (−1.8% to −4.8%).

The one case where pruning *hurts* was built deliberately, by reading the gating
rule rather than the data: every note is gated on its own field being non-null,
so pruning removes exactly the guidance about **absent** fields.

| `absent-sizing-input` | `inline` | `inline-conditional` |
|---|---|---|
| haiku | 18/20 | **10/20** |
| sonnet | 20/20 | 20/20 |
| opus | 20/20 | 20/20 |

Haiku invents W/m² rates and heating-fraction splits and returns kW figures.
Sonnet and opus read the null field, know unaided what it is for, and decline —
**including in the 40 runs where its note was pruned**.

> **This metadata buys nothing where the model already knows the domain, and a
> lot where it does not.**

### 8 · The layers scale differently with model size

| | buys | scales with model? |
|---|---|---|
| naming / semantics | stops confident misreading | **inversely** — biggest on the weakest model |
| recipes / computation | the answer itself | **no** — every model needed them |
| model capability | honest refusal as a floor | **yes** — only Opus had it |

§7 is the sharpest instance: an 8-run gap on haiku, zero on sonnet and opus.

### The strongest single result

`wrong-unit` asks for the area of flat 28A. The thin schema has no `huisletter`
field, so the call cannot be expressed:

| | |
|---|---|
| thin · Haiku | ❌ `105 m²` — the shop at number 28, no caveat |
| thin · Opus | ⚠️ refuses: *"this tool has no huisletter parameter"* |
| rich · Haiku | ✅ **`92 m²`** |

**rich-Haiku beats thin-Opus.** The layer makes the weak model right and the
strong model safe.

---

## Limits

- **n is now 10–20 per cell on the major runs**, across three models, with
  server-side call audits. The early findings (§1–§3) are still n=2–3 and
  directional; §4–§7 are measured.
- **Run-to-run variance is larger than it looks.** On one question, four passes
  at n≤10 gave four different answers (9-v-4, 2-v-2, 8-v-7, 10-v-3) — anything
  from level to 3×. Large effects (0/60→59/60, 10/30 vs 30/30) sit far outside
  that band; **findings resting on a few-run gap at n=10 in one sitting do not**,
  and several older files in `results/` are sized exactly that way.
- **Self-reported call counts are not trustworthy on their own.** One run
  reported `CALLS: 3` against a server log that accounted for fewer. Every recent
  file reconciles against `get_tool_call_log` instead.
- **Saturation is now the binding constraint.** `benchmark-trap` is a regression
  test rather than a discriminator; both `derived_number` questions are at or
  near ceiling for the arms that matter; `absent-sizing-input` separates on haiku
  only. **The set needs harder questions more than it needs larger n.**
- **The opaque runs are payload-in-prompt**, not live tool calls, except where a
  results file says otherwise.
- **One author** wrote the guide, the obfuscation and the questions. The
  comprehension test (§2) blunts that objection; it does not remove it. The single
  most valuable contribution now would be a question written by someone else.
- **Three claims in this repo were found false and corrected in place** on
  2026-09-22, with the original text left visible. Assume others survive.

## Known gaps in the address set

Three phenomena the rich description covers that no captured address exercises,
listed under `known_gaps` in [`addresses.json`](addresses.json): no **Nader
Voorschrift** label (the richest unit trap — `berekend_energieverbruik` in MJ for
the whole building, `co2_emissie` as a yearly total), no **BENG `eis_*`** values,
and no **expired label**. Nine probes did not land a Nader Voorschrift case;
most have been re-issued under NTA 8800.
