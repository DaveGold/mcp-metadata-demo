# Eval set — does the metadata layer change what the agent does?

Same data, same questions, three servers that differ only in how much they
explain themselves. Everything here is real: every `ground_truth` traces to a
profile captured from the live server and frozen in
[`addresses.json`](addresses.json).

- **[`questions-core.json`](questions-core.json) — 9 questions. Start here.**
- [`questions.json`](questions.json) — the full set, with every question tagged by outcome class
- [`results/`](results/) — what has actually been run
- [`addresses.json`](addresses.json) — frozen reference profiles + known gaps

---

## What the sweep found (2026-09-21)

Before spending the full matrix, every core question was run thin-vs-rich at Haiku,
with the interesting ones extended to Sonnet and Opus. 33 runs, n=1 per cell —
directional, not significant. It changed the design, so read it first:
[`results/2026-09-21-haiku-sweep.json`](results/2026-09-21-haiku-sweep.json).

**The finding: prose alone changed nothing. Computed alerts and schema fields
changed everything.**

Every question the rich arm won, it won on an **alert** or a **schema field**. On
the two questions whose rule lives only in INTERPRETATION prose, rich failed
exactly like thin — rich-Haiku read *">1.5 = significant overheating"*, saw 3.59,
and answered *"very low"*. The words arm settles it: on `building-size` and
`total-vs-per-m2` it produced answers **identical to thin** (41 m², 2,859 kg)
while carrying the full prose.

This **inverts the design note**, which frames A→B as the thing to prove and
"most of the build". At Haiku, A→B buys almost nothing and B→C buys all of it.
The defensible message is not *write better descriptions* — it is *compute the
answer server-side*.

### The strongest single result

`wrong-unit` asks for the area of flat 28A. The thin schema has no `huisletter`
field, so the call cannot be expressed:

| | |
|---|---|
| thin · Haiku | ❌ "105 m²" — the shop at number 28, no caveat |
| thin · Opus | ⚠️ correctly refuses: *"this tool has no huisletter parameter"* |
| rich · Haiku | ✅ **92 m²** |

**rich-Haiku strictly beats thin-Opus.** And it shows the layer doing two distinct
jobs: making the weak model *right*, and the strong model *safe*.

---

## The demo set: nine questions, five outcome classes

A set of only separators is selection, not evidence. These nine span the whole
response surface, and the classes are the argument:

| class | what it shows | questions |
|---|---|---|
| **B · layer closes the gap** | thin ❌ → rich ✅, same model | building-size, total-vs-per-m2, gas-estimate, heat-pump-triage |
| **D · structural gap** | the thin arm cannot express the call at any model | wrong-unit |
| **C · model closes the gap** | both arms ❌ at Haiku, ✅ at Opus — prose-only rules | overheating, benchmark-trap |
| **A · always works** | every arm, every model correct | metered-vs-model, invented-label |
| **E · layer can't fix it** | rich ❌ even at Opus | **none found — say so** |

Class A is not filler. Without it the set cannot surprise you, and a room is
right to discount it.

### Retired, and why

Four questions were cut after every arm answered them correctly. Keeping them
would have padded the totals without testing anything:

- **heat-pump** (binary) — "is this a good candidate?" is guessable from an A+
  label. Replaced by **heat-pump-triage**, which asks for a three-way ordering
  against bands that exist only in the alerts. Written after the sweep, and it
  separates.
- **invented-label**, **metered-vs-model** — kept, but as class-A controls rather
  than as evidence.
- **human-typing** — retired outright. It assumed a postcode with a space needs
  normalising; PDOK accepts it, so the thin arm passed `"3543 AR"` straight
  through and succeeded. The question tested nothing.

### Two design rules the sweep produced

1. **A question separates only when the answer needs a value, constant or
   convention that is not in the payload and not guessable from an adjacent
   signal.** Binary verdicts saturate. Values and orderings do not.
2. **Separation can collapse as the model improves.** `gas-estimate` separated at
   Haiku, but thin-Sonnet reached 250–300 m³ by a different route. Treat every
   separation as model-specific until shown otherwise.

### Interpretation guidance: the test the three arms could not run

The thin arm was never metadata-free. It strips descriptions, schemas and alerts,
but still returns `gebruiksoppervlakte_thermische_zone_m2`, `berekeningstype`,
`aantal_verblijfsobjecten` and `matchStatus`. **Those names are metadata**, and
Haiku reads straight through them — put three prose-shaped questions to the thin
arm and it answers all three, inferring from `berekeningstype: "NEN 7120"` that
the method does not populate warmtebehoefte, and picking the thermal-zone area as
the right denominator unprompted.

So A→B could never measure what guidance buys: the naming had already done the
job. A real legacy register emits `EP1`, `VBO_OPP`, `BER_TYPE` and a numeric
status. Two further arms restore that —
[`get-building-profile-opaque.ts`](../src/tools/get-building-profile-opaque.ts):

| arm | field names | description |
|---|---|---|
| **A′ · opaque** | `f_ga`, `calc_t`, `wb`, `n_vbo`, `st: 2` | one sentence |
| **B′ · opaque-words** | identical | the guidance, keyed to those codes |

Same input schema, no output schema, no alerts, identical payloads. **Only the
description differs**, and a test asserts it.

Asked how much gas the IJburglaan flat uses (ground truth ~253 m³):

| | answer | |
|---|---|---|
| A′ · **Opus** | ⚠️ *"you'd need the field's definition and unit"* | information not recoverable |
| A′ · **Haiku** | ❌ **164 m³** — read `f_ga` as *"gas"* | fabricates |
| B′ · **Haiku** | ✅ **252 m³** | correct, with the space-heating caveat |

**B′-Haiku beats A′-Opus** — not because Haiku is the better model, but because
the guidance carries information absent from the payload at any level of
capability. Opus does not fail by being wrong; it fails by correctly reporting
that the question cannot be answered. Haiku fails by inventing.

**A misleading name is worse than no name.** The benchmark-trap question asks
whether a NEN 7120 `berekend_energieverbruik` of 369 can be compared against a
100 kWh/m² target. It cannot. With readable names, prose *and* alerts, Haiku and
Sonnet both answered "3.7 times higher" — the field name says *calculated energy
use in kWh/m²*, so they trusted it and skipped the prose beside it. Rename it to
`bev` and the same model, on the same data, consults the guide and declines
correctly. Good naming is metadata; **wrong naming is anti-metadata**, and it
defeats the guidance sitting next to it.

That run is also the answer to the obvious objection about the gas result — that
the guide stated the formula and the model merely followed it. Here the guide
never says to refuse the comparison. Haiku had to chain `calc_t` → NEN 7120 →
`ep1` is null → `ei` has no kWh/m² equivalent. Comprehension, not transcription.

### Which half of the guidance does the work (n=3)

The guide has two distinct parts, and they turn out to buy different things.
Same model, same payload, same question, only the guide varies
([`results/2026-09-21-guide-ablation.json`](results/2026-09-21-guide-ablation.json)):

| arm | guide | answers | correct |
|---|---|---|---|
| **A′** none | one sentence | `40.02` · `40.02` · `40.02` | 0/3 |
| **B″** glossary only | field meanings + units + `calc_t` rules, **formula removed** | `UNKNOWN` · `UNKNOWN` · `295` | 0/3 |
| **B′** full | glossary **+ the two-line conversion** | `253` · `253` · `253` | 3/3 |

**Field semantics stop the error. Derived-figure recipes produce the answer.**
Neither is sufficient alone, and they are not the same intervention:

- Without any guide, every run read `f_ga` as the gas figure and returned it raw
  — the letters "ga" were enough. Perfectly stable, perfectly wrong.
- Add only the glossary and the fabrication mostly stops: two runs named exactly
  the right fields and honestly declined. Knowing what a field *means* is enough
  to prevent a confident error and not enough to answer.
- Add the two-line formula and it is 3/3 with zero variance.

**This is "something is better than nothing", measured.** The glossary never
reached the right number, but it moved the model from a confident wrong answer
to mostly-honest uncertainty — and for a system feeding customer advice that is
the more valuable half. A wrong number gets acted on; an "I can't tell you" gets
escalated.

Two honest qualifications. The glossary arm is **unstable** — `UNKNOWN, UNKNOWN,
295` — so the accurate claim is that it *reduces* fabrication, not that it makes
the model honest. And note what never happened in any unguided run: no model
treated an unrecognised code as unknown. It reached for the nearest plausible
meaning and committed. **The failure mode of a badly named field is not
confusion, it is confident misreading.**

### What is and is not proven

| claim | status |
|---|---|
| **Interpretation guidance changes behaviour** | **Proven**, twice, mechanistically — 164→252, and the benchmark trap |
| **Input schema *field presence* matters** | **Proven** — `wrong-unit`: no `huisletter` field, no model fixes it |
| **Input schema *description text* matters** | **Not proven** — only `human-typing`, where both arms succeeded anyway |
| **Computed alerts change behaviour** | **Proven** — four separators, all carried by an alert |
| **Prose beats nothing when names are already good** | **Disproven at Haiku** — words matched thin on two questions |

The last two rows are the uncomfortable pair, and they are not in tension: with
well-named fields the prose is redundant and the value sits in computation; with
opaque fields the prose is decisive. Which regime you are in depends on your API,
not on your metadata strategy.

So there are two claims here, and they are different:

1. **Against a realistically opaque API, interpretation guidance is decisive.**
   Without it the data is not usable and no model fixes that.
2. **Against an API whose fields are already well named, guidance adds little**,
   and the remaining value sits in computed alerts and schema fields.

Both are true. The second is why the first is easy to under-measure in a demo
built on good naming — and why this repo needed a fourth and fifth arm to see it.

n=1 per cell, and a payload-in-prompt proxy rather than a live tool call. The
deployed `mcpOpaque` / `mcpOpaqueWords` endpoints run the same comparison end to
end.

### The layer collapses variance, not just error (n=3)

The sweep above is n=1. The two numeric separators were re-run three times each
to check the headline held — and it found something n=1 could not see
([`results/2026-09-21-n3-separators.json`](results/2026-09-21-n3-separators.json)):

| gas-estimate · Haiku | answers on identical input | correct | spread |
|---|---|---|---|
| thin | 140 · 240–260 · 200–220 · 200–250 | 1 of 4 | **44%** |
| rich | 253 · 253 · 253 | 3 of 3 | **0%** |

Accuracy is only half of it. **The layer makes the answer reproducible.** Every
thin run invented its own conversion — a 69.2% fossil share, "~10 kWh per m³ at
85–90%", a degree-day cross-check. For anyone building on the output, an answer
that changes every call is worse than one that is consistently wrong, because a
spot check cannot catch it.

And the thin arm fails in **two different shapes**:

- **No path in the payload** (`gas-estimate`) → it improvises, and scatters.
- **An obvious but wrong path** (`total-vs-per-m2`: multiply by the visible BAG
  area) → it is perfectly stable and perfectly wrong, 2,859 three times out of
  three. This one is the more dangerous, because it looks reliable.

Note also that n=1 called `gas-estimate` a clean separator on a single 140 m³
run. At n=4 the thin arm is right once. The separation is real, but weaker and
noisier than one run implied — which is the whole argument for repeats.

### Call count is dead; count fabrication instead

`get_building_profile` is one-shot, so nearly every run was a single call. The
only 2-call runs were compensating searches into `get_weather_context` when the
payload did not resolve the question — including rich-Haiku spending an extra
call to confirm a wrong overheating verdict.

What discriminates is **fabrication**: an invented "69.2% fossil share", 3.59
reported as "degree-days" and as "hours above 27 °C", a silently dropped
huisletter, the BAG area used as denominator. Every question now carries a
`fabrication_watch` naming what to look for. `max_calls` has been removed.

Note that the rich arm fabricates too — it invented a heat-pump threshold of
"under 60 kWh/m²" (the band is 50–70) and cited the overheating threshold as 1.0
and 1.20 (it is 1.5). It was right anyway each time, which is its own finding:
a correct verdict reached through an invented rule.

---

## Going deeper: the full 21

[`questions.json`](questions.json) adds the questions that need domain knowledge
to appreciate — the NEN 7120 figure that looks like kWh/m² and is not, the
`sbi_code` that is prose rather than a code, the Paris Proof thresholds, the two
different floor areas. They are the sharper tests, and they are where the
*arcane* half of the model hypothesis below gets settled. They are just poor
theatre.

---

## The three arms

The design note asks for arm B to be "A's tool surface with C's prose". In *this*
repo that is much cheaper than the note assumes, because the tool surface is
very nearly identical already: `createServer()` registers the same tools in both
variants and both call the same `resolveBuildingProfile`.

One exception — `registerFetchImageTool` is called in the rich branch only, so the
minimal variant is short one tool. It is a `render_table` helper and no question
here touches it, but it is a real surface difference: exclude it from every arm's
allowlist (as the agent definitions below do) so the three arms see the same six
tools.

| arm | description | input schema | output schema | `alerts` |
|---|---|---|---|---|
| **A · thin** | one sentence | bare, no `huisletter`/`toevoeging` | none | none |
| **B · words** | full prose | full, with `.describe()` | full, with `.describe()` | **none** |
| **C · rich** | full prose | full | full | **computed** |

**A → B is what words buy. B → C is what server-side computation buys.**

**Arm B is built.** `ServerVariant` now has a third value, `'words'`, served by
[`src/tools/get-building-profile-words.ts`](../src/tools/get-building-profile-words.ts):
the rich description minus its trailing `ALERTS:` paragraph, the full input and
output schemas, and no `alerts` key. Its tests assert that the description is
`descriptionCore` *byte-identical* to the rich tier's prefix, and that arm B's
payload equals arm C's with `alerts` removed — so nothing but the computed layer
differs. Run it with `npm run dev:words`; deploy adds a `mcpWords` function.

### One honest caveat about arm A

The thin input schema has **no `huisletter` and no `toevoeging`**. So arm A cannot
express the disambiguating call at all — that is a capability gap sitting inside
the arm that is supposed to isolate prose. `sel-01` is marked
`model_sensitivity: "capability"` for this reason. Either say so from the stage,
or add the two optional params to the minimal schema (without descriptions) and
make A→B genuinely words-only.

---

## Categories (full set)

| category | n | what it tests |
|---|---|---|
| ambiguity | 4 | a field whose name or value has more than one reading |
| selection | 3 | which unit, which field, which spelling |
| aggregation | 5 | derived values the raw fields do not state |
| tool_choice | 3 | two plausible tools, one correct — or none |
| correctly_refuse | 3 | the right answer is "not registered" |
| interpretation | 3 | reading a value against a threshold |

---

## The model question

Three models: Haiku 4.5, Sonnet 5, Opus 5 — run as three rungs, not as a
weak/strong pair. Sonnet is the one that makes the result legible: with only Haiku
and Opus you learn that *a* gap exists and that metadata closes *some* of it, but
not whether the effect is a smooth gradient or a cliff, and not how big a jump the
layer is actually worth.

The comparison to report is **arm × model as a 3×3 grid**, read two ways:

- **Down a column** (same model, thin → words → rich): what the layer buys that
  model. Expect the gain to *shrink* as the model gets stronger — if it does not,
  the layer is doing something other than substituting for model capability.
- **Across a row** (same arm, Haiku → Sonnet → Opus): what a model upgrade buys.
  Then find where rich-Haiku lands on the thin row. If it sits at or above
  thin-Sonnet, the layer is worth a model tier. If it clears thin-Opus, it is
  worth two — and that is the sentence for the talk.

The three-rung version also protects you: a Haiku-vs-Opus-only result is
consistent with "Opus is just better", whereas a monotonic Haiku < Sonnet < Opus
on thin that *flattens* on rich is specific evidence that the layer is closing a
knowledge gap rather than a reasoning gap.

**Registered prediction, written before the run.** Every question carries a
`model_sensitivity` tag, and the two groups should behave differently:

- **`discipline` (13 questions)** — failure is a lapse of care: not noticing
  `candidateCount: 4`, guessing a label from a bouwjaar, not normalising
  `"3543 AR"`. Bigger models are better at this unaided. **This is the group that
  can show the result worth having: thin-Opus right, thin-Haiku wrong, rich-Haiku
  right — the layer buying roughly one model tier.**
- **`arcane` (7 questions)** — failure is missing Dutch-domain knowledge that is in
  no model's pretraining: the heat-pump bands, the 70 kWh/m² Paris Proof office
  target, that NEN 7120 `berekend_energieverbruik` is inflated. Expect *every*
  model to fail the thin arm. That is a floor, not a gradient.

Read the two groups **separately**. Pooled, they cancel: the arcane floor drags
the thin-arm average down for all three models and hides the very model spread
that makes the point. The headline you want lives in the discipline group; the
arcane group is the separate, blunter claim that *no* model can do this unaided.

If the discipline group shows no model spread on the thin arm, the "buys you a
model tier" framing is not supported and the honest headline is the arcane one
instead. Worth knowing before a room finds out.

---

## Scoring

Four countable metrics:

1. **Correct** — matches `ground_truth`. The headline.
2. **Confidently wrong** — produced `must_not_say`. The most quotable number here,
   because it is the difference between a wrong answer and "I don't know".
3. **Calls** — against `max_calls`.
4. **Right tool first try**.

`scoring: "exact_value"` compares a number within `tolerance`. `scoring: "judge"`
needs a model judge — always hand it the `ground_truth` and the `must_not_say`,
and ask which of the two the answer matches. Never ask a judge whether an answer
was "good".

Run every question **3× per arm per model** and report proportions. A single pass
is not a result.

**Budget:** 21 questions × 3 arms × 3 models × 3 repeats = **567 runs.** Build the
harness against one model first; add the other two once it holds.

---

## Two things to fix before you run

### 1. ~~The gas-estimate alert is wrong by 3.6×~~ — FIXED 2026-09-20

`generate-alerts.ts` now divides by `KWH_PER_M3_GAS` (31.65 / 3.6 = 8.79) and two
regression tests pin it: one on the IJburglaan figure, one on a plausibility band
for a typical dwelling. `addresses.json` was captured *before* the fix, so its
frozen alert text still quotes the old numbers — re-capture before scoring.

**The same line exists in the production Warmtebouw server**
(`wb-mcp-server/src/servers/warmtebouw-duurzaam/tools/get-building-profile.ts:423`),
where it feeds `Geschat gasverbruik` in customer-facing energy advice. Not fixed
here — that is a separate repo.

For the record, the original defect:

```
gasM3 = warmtebehoefte_kwh_m2 × oppervlakte_m2 / 31.65 / 0.95
```

31.65 is **MJ** per m³ of Dutch gas. The numerator is in **kWh**. The correct
divisor is 8.79 kWh/m³ (31.65 MJ ÷ 3.6). For IJburglaan 433 the shipped alert
says ~72 m³/year where the physically correct figure is ~259 m³/year — a 41 m²
flat that actually used 72 m³ would be remarkable.

It mattered beyond arithmetic: `agg-01` is arm C's **flagship capability
question**, and arm C would have answered it wrongly while arm B, reasoning from
the raw fields, could have answered it right.

### 2. The harness must capture behaviour, not just answers

Call counts and parameters are what separate the arms in *selection*,
*aggregation* and *tool_choice*. Note that `writeToolCallLog` is called **only by
the rich tool** — the minimal tool does not log — so server-side tool logs are
asymmetric across arms and cannot be the behaviour source. The HTTP
`requestLog` middleware *is* variant-agnostic and records the tool name per call,
but not the parameters. Either add params there, or have the harness act as the
MCP client and record calls itself.

---

## Known gaps in the address set

Three phenomena the rich description covers that no captured address exercises —
see `known_gaps` in `addresses.json`:

- **No Nader Voorschrift label** (pre-2021 residential). This is the single richest
  trap in the INTERPRETATION block: `berekend_energieverbruik` of 80k–100k is MJ
  for the whole building, and `co2_emissie` is kg/year total rather than per m².
  Nine probes did not land one; most have been re-issued under NTA 8800. Worth one
  more hunt — it is worth two questions on its own.
- **No BENG `eis_*` values**, so the BENG pass/fail alert is untested.
- **No expired label**, so the expiry alert is untested.

Re-capture `addresses.json` before a scoring run. BAG and EP-Online are live
registers and the values drift.

---

## Running it with subagents

`.claude/agents/eval-{thin,words,rich}.md` define one agent per arm, each
allowlisted to exactly one server's six tools. `.claude/skills/run-eval/SKILL.md`
orchestrates: spawn `eval-<arm>` with `model` set to `haiku`, `sonnet` or `opus`,
pass only the question text, score in the parent.

`.mcp.json` already carries `eval-rich` and `eval-thin`. Add the third once the
`mcpWords` function is deployed:

```json
"eval-words": {
  "type": "http",
  "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpWords"
}
```

Three things to hold onto:

- **The three agent prompts must stay byte-identical** apart from the tool names.
  Any wording that differs between arms is an uncontrolled variable, and a stray
  sentence of domain guidance in the prompt would quietly do arm C's job for it.
- **The subagent only returns its final report.** The parent cannot see the real
  tool-call trace, so CALLS/TOOLS/PARAMS are self-reported *by the system under
  test*. Good enough to spot thrashing, too weak to headline. If you want
  trustworthy behaviour numbers, run those questions through a harness that is
  itself the MCP client.
- **Subagents run inside Claude Code**, with its system prompt and tool-use
  training around them. That is a constant across arms, so the A/B/C comparison
  holds — but it is not the same as a bare API call, and the absolute numbers are
  not "what any client would get".
