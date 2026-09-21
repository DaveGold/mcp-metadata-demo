# Eval set — does the metadata layer change what the agent does?

Nine questions against Dutch building data (BAG + EP-Online), asked of the same
server deployed at different metadata tiers. Same data, same questions — the
arms differ only in how much the tool explains itself.

- **[`questions.json`](questions.json)** — the set. Start here.
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

The last three are **controls**. `overheating` is covered by no alert, so the
rich arm should have no advantage; the two refusals should be answered correctly
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
not `must_not_say`, not the shape. Run each question at least **three times per
arm**: single runs mislead, and one arm here answered 140, 240–260, 200–220 and
200–250 to the same question.

Score four things, and report **per shape**, not just a total:

| metric | |
|---|---|
| **correct** | matches `ground_truth`, within `tolerance` where given |
| **confidently wrong** | asserts `must_not_say` — the difference between a wrong answer and an honest "I can't" |
| **fabricated** | invented a constant, unit or threshold; `fabrication_watch` says what to watch for |
| **reproducible** | how many of n runs land in range, and the spread |

`.claude/agents/eval-*.md` and `.claude/skills/run-eval/` automate this against
the deployed endpoints.

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
own caveats. Read them as **directional**: n is 2–3 per cell, mostly Haiku, and
the opaque runs were done payload-in-prompt rather than through a live tool
call. The effects are large and consistent; the numbers are not yet measurements.

### 1 · Semantics and computation buy different things

Ablating the guide itself — field glossary alone, versus glossary plus the
derived-figure recipe — separates two interventions that are usually conflated:

| shape | no guide | glossary only | + recipe |
|---|---|---|---|
| derived number | `40.02` ×3 | `UNKNOWN` · `UNKNOWN` · `295` | **`253` ×3** |
| classification | `VERY SUITABLE` ×2 | **`SUITABLE` ×2** | not needed |
| prevention | `58.1` · `102.5` | **`CANNOT-COMPARE` ×2** | not needed |

> **Semantics handle interpretation, classification, prevention and refusal.
> Recipes — or server-side computation — are needed only for derived numbers.**

That is a design rule. A threshold, a unit caveat or a field's meaning belongs
in the description. An arithmetic conversion does not: document it as a recipe,
or better, compute it and return it. It also explains the readable-regime
result, where every question only the rich arm got right was a derived number.

### 2 · A misleading name is worse than no name

With readable field names, full prose **and** alerts, Haiku and Sonnet both
benchmarked `berekend_energieverbruik_kwh_m2` against a real-world target. The
name says *kWh/m²*, so they trusted it and skipped the prose beside it saying
not to. Rename it to `bev` and the same model, on the same data, consults the
guide and declines correctly.

Good naming is metadata. **Wrong naming is anti-metadata** — it defeats the
guidance sitting next to it.

### 3 · The layer collapses variance, not just error

On `gas-estimate` the rich arm returned `253` three times. The thin arm returned
`140`, `240–260`, `200–220`, `200–250` — a 44% spread, right once in four. Each
run invented its own conversion.

An answer that changes every call is worse than one that is consistently wrong,
because a spot check cannot catch it. Two failure shapes are worth telling
apart: where the payload offers **no** path, the model improvises and scatters;
where it offers an **obvious but wrong** path, the model is perfectly stable and
perfectly wrong. The stable one looks reliable.

### 4 · The layers scale differently with model size

| | buys | scales with model? |
|---|---|---|
| naming / semantics | stops confident misreading | **inversely** — biggest on the weakest model |
| recipes / computation | the answer itself | **no** — every model needed them |
| model capability | honest refusal as a floor | **yes** — only Opus had it |

At Haiku the glossary converts fabrication into mostly-honest uncertainty. At
Opus there is nothing to convert: it already refuses unaided. But *neither*
model produced the number without the recipe — including Opus, which knows the
conversion as general knowledge and declined anyway, because it doubted the flat
burns gas at all.

**Haiku refuses because it cannot compute. Opus refuses because it suspects the
question is ill-posed.** Both say "UNKNOWN"; a correctness-only scorer records
them identically.

### 5 · Mechanism depends on the naming regime

`heat-pump-triage` in its binary form saturated with readable names — every arm
right, because an A+ label makes "yes" guessable. In the opaque regime the
glossary is *required*. Same question, opposite verdict. Which regime you are in
depends on your API, not on your metadata strategy.

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

- **n is 2–3 per cell.** Directional, not significant.
- **Mostly Haiku.** Sonnet and Opus were run only where the answer turned on it.
- **The opaque runs are payload-in-prompt**, not live tool calls. `mcpOpaque`
  and `mcpOpaqueWords` are deployed, so the end-to-end version is runnable.
- **One author** wrote the guide, the obfuscation and the questions. The
  comprehension test (§2) blunts that objection; it does not remove it. The
  single most valuable contribution now would be a question written by someone
  else.
- **No class-E question was found** — none where the rich arm fails even at
  Opus. Stated rather than left as a gap in the taxonomy.

## Known gaps in the address set

Three phenomena the rich description covers that no captured address exercises,
listed under `known_gaps` in [`addresses.json`](addresses.json): no **Nader
Voorschrift** label (the richest unit trap — `berekend_energieverbruik` in MJ for
the whole building, `co2_emissie` as a yearly total), no **BENG `eis_*`** values,
and no **expired label**. Nine probes did not land a Nader Voorschrift case;
most have been re-issued under NTA 8800.
