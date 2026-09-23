# Eval set — does the metadata layer change what the agent does?

Ten questions against Dutch building data (BAG + EP-Online), asked of the same
server deployed at different metadata tiers. Same data, same questions — the
arms differ only in how much the tool explains itself.

- **[`questions.json`](questions.json)** — the set. Start here.
- [`research-frame.md`](research-frame.md) — why these experiments: the axes, the
  coverage, the claim boundaries
- [`addresses.json`](addresses.json) — the frozen profiles every answer derives from
- [`questions-weather.json`](questions-weather.json) — four **candidate** questions
  against `get_weather_context`, unrun, deliberately kept out of the set below
- [`weather-fixtures.json`](weather-fixtures.json) — the frozen captures those derive from
- [`ground-truth.test.ts`](ground-truth.test.ts) · [`ground-truth-weather.test.ts`](ground-truth-weather.test.ts) — prove it, under `npm test`
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

**The set is ten questions and stays ten.** Four candidates against a second tool live
in [`questions-weather.json`](questions-weather.json) and are **not** part of it: every
file in [`results/`](results/) is scored against the set above, and growing it silently
would invalidate comparisons already recorded. They exist because `get_weather_context`
supplies two things this tool cannot — a response that dials from ~330 to ~18,000 tokens
(so `open-questions.md` Q9's distance half becomes a real test), and `select`, the only
mechanism here where **output** field names must be passed as an **input** parameter, and
where guessing them fails *silently*. See Q9 and Q11, both amended 2026-09-22.

`metered-vs-model` and `invented-label` are **controls**, and as of 2026-09-22
they are the **only** ones. They should be answered correctly by every arm. A set
containing only questions the thin arm fails is selection, not evidence — if the
controls ever separate, something other than the metadata is driving the result
and the run is suspect.

> **`overheating` is NOT a control any more — re-designated 2026-09-22.** It was
> built as a *non-separation* control: covered by no alert, so `rich` should hold
> no advantage. It failed in that role twice, in opposite directions. Before the
> computed alert it did not separate — but only because **both arms were mostly
> wrong**, 7–8 runs in 10 asserting no-or-low risk against a ground truth of
> *significant*, inventing thresholds instead of using the one in the prose. A
> question every arm fails is a floor, not a control. After the verdict was
> computed server-side it went `rich` 2/10 → 10/10 while every alertless arm stayed
> put, so it now separates **by construction**. It is now a *computation*
> discriminator; see `redesignated` in [`questions.json`](questions.json).
>
> **This leaves a real gap.** Both surviving controls are refusals. The set has no
> non-separation control at all — no question where the arms carry different
> metadata and are expected to score the same — so a run can no longer detect an
> arm separating for a reason other than the layer under test. A replacement needs
> a field no alert covers; after the overheating alert landed, the only substantive
> one left is `compactheid`, whose prose gives a direction and no threshold. Not
> built, and a control is not a control until it has been *measured* not to
> separate.

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

> ### ⚠️ 2026-09-22 — the description channel was truncated in every run below
>
> The host these runs used (Claude Code) sends only the **first 2,048 characters** of each
> MCP tool description. In `words` and `rich` that cuts 70–72%: nearly the whole
> INTERPRETATION block, the CALCULATED vs MEASURED line and the overheating threshold.
> §4 and §9 below compare **delivered** guidance (response) with **undelivered** guidance
> (description past the cut). Their numbers stand; their mechanism is not "channel". It is
> "whether the text arrived". See Q7 in [`open-questions.md`](open-questions.md) and
> [`results/2026-09-22-q7-description-truncation.json`](results/2026-09-22-q7-description-truncation.json).
>
> **Tested 2026-09-23 (§10):** with the sentence delivered in both channels, they score the
> same, 20/20 vs 20/20, at the default cap and with the cap raised. *The response beats the
> description* is **retired**. What the numbers below measured is delivery.

Everything below is from runs recorded in [`results/`](results/), each with its
own caveats. The picture changed substantially on 2026-09-21/22: the early
findings were n=2–3 and mostly Haiku, and have since been re-run at **n=10–20 per
cell across three models**. Where a claim has been superseded it says so.

**Every question in [`open-questions.md`](open-questions.md) carries a prediction
registered before its run. As of 2026-09-23, thirteen of the twenty-three scored so far were
wrong.** That pattern is itself the most reliable thing here: the effects are large and
legible, and intuitions about *why* keep missing.

Status of the register: every question has run or been stopped. **Q10** was suspended (its old
premise was absence), then reopened on two questions with headroom (§15). **Q9's position half is retired** as not worth running
on this host (§12). **Q12** ran on weather, the only public second data source. The first
question had no headroom; the second replicated the channel tie (§14). The external-validity gate it stands for is still open. The questions come
from [`research-frame.md`](research-frame.md), which is the map the register is drawn on:
the six axes a placement effect could run along (channel, timing, distance,
conditionality, addressability, activation), which of them the answered questions cover,
and which design principles remain unfalsified. Read it before quoting any result here as
a general MCP rule; it says plainly what this repo can and cannot support.

**The short version, as of 2026-09-23.** Guidance works when it **reaches the model**. On
Claude Code, three things decide that:

- a tool description is cut at 2,048 characters (Q7);
- a tool result over ~25k tokens is replaced by a "saved to file" notice (Q9);
- `outputSchema` is never sent (Q11).

Once it arrives, **where it arrives does not matter** (description and response tie: Q15,
Q15b, Q12). **Nor does its form** (prose = `relates_to_fields` = computed trigger: Q10). **Nor
how much else is around it** (one rule among 100 was found as easily as alone: Q17).

What still decides outcomes:

1. **whether a sentence that answers the question exists at all**;
2. **whether the data a rule needs is in the response.** For haiku that took 2/20 to 15/20. For
   sonnet and opus it cut tool calls by ~87% and wall time by ~3/4 at the same accuracy
   (Q16, Q16b);
3. **whether a pointer to guidance is worded as an instruction** (Q8b: haiku 0/10 → 10/10).

**For a sonnet/opus user** the practical advice is short:
- put what matters in the first 2,048 characters or in the response;
- ship the reference data your rules depend on;
- keep responses under the output limit, or put guidance under a fixed key;
- don't spend effort on the delivered form of the guidance.

Give every rule a **provenance line**: when it was added, and the eval result or incident
behind it. That is for the agent that improves the server. With it, that agent cites the
evidence; without it, it has to re-derive the reason. The source's *form* (prose or
per-field records) did not matter to that agent either (Q18; design guidance 2c).

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

### 4 · Guidance works when it is DELIVERED, and on this host the description mostly is not

**Q1, 210 runs, three models.** The same 438 bytes of recipe scored **29/30 in the
response and 4/30 in the tool description**. Both registered predictions were
falsified. **The description copy sat past character 2,048 and never reached the
model** (Q7). When the same sentence *is* delivered by the description, it scores the
same as the response (§10). So this is 29/30 delivered against 4/30 absent.

The structural argument survives. The description is written before the data is
known, so it must carry every branch; the response is the only channel that can be
conditional on the record, and the only one no host truncates at 2,048 characters.
That still makes the response the robust default. It is no longer a claim that
models read responses more carefully.

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

### 9 · The channel finding is not about recipes — and it can be free

**Q13, 60 runs, haiku.** `temperatuuroverschrijding` 3.59 against a stated 1.5
threshold. The threshold line is present **verbatim** in two arms:

| arm | where the line sits | correct | **cited the 1.5 threshold** | tokens vs `words` |
|---|---|---|---|---|
| `words` | DESCRIPTION | 5/20 | **0 of 20** | — |
| `inline` | **RESPONSE** | **20/20** | **20 of 20** | **−9.7%** |
| `rich` | computed verdict | 20/20 | 20 of 20 | +1.5% |

Zero against twenty on whether the sentence was **used** at all. Where it goes
unused the model invents a unit for 3.59 — 9 of 20 runs — and every invented unit
(hours a year, K, °C, %) makes the number sound negligible, so 10 of 20 concluded
low or no risk.

**Why placement mattered — ANSWERED by Q7, 2026-09-22: the model never saw it.** The
definitions are re-sent every turn, but this host cuts each MCP tool description at
2,048 characters, and the threshold line starts at character 6,181. So this is 0 of 20
for an *absent* sentence against 20 of 20 for a delivered one.

Two things follow. **§4 was measured on a recipe; this is the same effect on a bare
fact** — one threshold, one comparison, no arithmetic. And **`inline` is the
cheapest arm as well as the best**, the first in this repo where quality and cost
point the same way.

> **A defect that prose "cannot fix" may just be prose that never arrived. Check
> delivery before you write a computation.**

The computed overheating alert was not wrong — it scores 20/20 — but it was the
expensive fix to a defect that had a free one.

**And the free fix is one line.** Q14 kept `words`' description untouched and added
only the 181-character threshold line to the response:

| arm | response | correct | cited 1.5 | tokens (median) |
|---|---|---|---|---|
| `words` | nothing | 8/20 | 0 of 20 | 27,615 |
| `inline-oneline` | **one line** | **20/20** | **20 of 20** | **23,556** |
| `inline` | whole block | 20/20 | 20 of 20 | 24,058 |

One line did everything the 5,020-character block did, and adding it made the run
cheaper, not dearer. The registered prediction was confirmed on all three criteria.

> **Put the line that answers the question in the response. That is the whole rule,
> on this question, on haiku.** §10 adds the alternative: inside the first 2,048
> characters of the description works equally well.

### 10 · Delivered is delivered: the channel test, finally run

**Q15 and Q15b, 120 runs, haiku, `overheating`, predictions registered beforehand, all
seven confirmed.** The first comparison here of the same sentence *delivered* through
each channel.

| run | arm | where the 1.5 line reaches the model | correct | cited 1.5 |
|---|---|---|---|---|
| Q15, default cap | `words` | nowhere (past the cut) | 1/20 | 0/20 |
| | `words-front` | description, char 330 | **20/20** | **20/20** |
| | `inline-oneline` | response | **20/20** | **20/20** |
| Q15b, cap raised to 20,000 | `words` (uncut) | description, whole block | **20/20** | **20/20** |
| | `inline` | response, whole block | **20/20** | **20/20** |

Three things follow:

- **The channel is not the variable; delivery is.** A description sentence the host
  actually sends is applied as often as the same sentence in the response. The
  "description is tool-selection metadata the model under-applies" reading is falsified
  on haiku for this line. A canary instruction in the same paragraph was obeyed 20/20.
- **Volume did not drown it.** Uncut `words` puts the line inside ~37.6k characters of
  tool definitions and still scores 20/20. But raising the cap ships every long
  description on every request: **+23.7% tokens** against `inline` in that batch, almost
  all of it other tools' descriptions.
- **Delivered text also changes behaviour beyond the answer.** `words-front` made exactly
  one call in every run; `words` made 39 in 20 runs, 19 of them weather detours.

> **Get the sentence delivered: in the response, or inside the first 2,048 characters of
> the description.** The response is the default because it does not depend on the host,
> and nothing added above it later can push it out.

Limits: haiku only, one question, and the description copy sat near the top (position is
Q9). Files: [`results/2026-09-23-q15-delivered-description.json`](results/2026-09-23-q15-delivered-description.json), [`results/2026-09-23-q15b-uncapped-channel.json`](results/2026-09-23-q15b-uncapped-channel.json).

### 11 · A guidance call works if it is called — and the pointer decides that

**Q8 and Q8b, 90 runs.** The DERIVED FIGURES recipe was returned by a no-argument call,
beside the same bytes in the description and in the response (`gas-estimate`, cap raised).

| arm | haiku route-correct | sonnet route-correct | made the call |
|---|---|---|---|
| recipe in the description (uncut) | 7/10 | 10/10 | — |
| recipe in the response | 6/10 | 10/10 | — |
| guidance call, **soft** pointer (*"Call it once with no arguments first: …"*) | **0/10** | 10/10 | haiku **0/10**, sonnet 10/10 |
| guidance call, **"REQUIRED: before any lookup, call this tool once with no arguments …"** | **10/10** | — | haiku **10/10** |
| guidance behind its **own** parameterless tool | **10/10** | — | haiku **10/10** |

Every run that made the call was correct, and every run that skipped it improvised:
invented efficiencies, the wrong area, the wrong energy figure. The extra call cost ~0.5%
tokens. So a bootstrap tool is a working channel **if its pointer reads as an
instruction**. Haiku ignores a hint and obeys a requirement, which is also why it obeyed
Q15's canary. `start_duurzaam` has the separate-tool shape; it has not been measured.

> **If you rely on a bootstrap call, word the pointer as a requirement with a consequence,
> or give the guidance its own tool.**

### 12 · Distance barely matters — but response SIZE is a delivery gate

**Q9, 80 runs, haiku.** A recipe fetched once, then 0, 1 or 3 quarterly weather calls
(~21k chars each) before the lookup it must be applied to: **10/10, 10/10, 9/10**. The
registered "≥ 5 lost" was falsified. Guidance delivered once per session survived ~62k
chars of intervening, irrelevant tool output.

The first attempt was void, and the reason is the finding. **Claude Code replaced each
79,182-char result with a 1,713-char notice**, *"exceeds maximum allowed tokens. Output has
been saved to …/tool-results/….txt"*. The subagent cannot read files, so neither the
records nor the guidance inside them arrived. This is the 25,000-token MCP output limit.
It behaves as replacement, not truncation, and it is the response-side twin of the
2,048-char description cut. **Scope of that finding:** it is exact for an agent without
file tools, like these subagents. A manual main-session test (Opus 5.5, n=1 per arm)
recovered it. The model ran `jq '{summary, interpretation, first: .records[0], …}'` on the
saved file, picked up the guidance by its key despite 274 records in front of it, and
applied it. That run was also **faster** (1m12 vs 2m48) and used **⅓ of the output tokens**
of the control, where the data came back inline and the model re-typed 274 CSV rows.

**Position inside a response is retired** as not worth running here. Models keep responses
small unaided: all 20 position runs chose `summaryOnly`. Forcing large responses needs a
protocol instruction, and Q9 showed such instructions change behaviour on their own. The
window where position could matter (large, but under ~25k tokens) is narrow, and distance
across turns, the bigger perturbation, was already flat.

> **Put guidance under a fixed, named key, and do not let a client without file tools
> receive an over-limit response.** A spilled response is lost to an agent without file
> tools. An agent with them can pull the key back with one `jq`.

### 13 · `outputSchema` never reaches the model — and field names leak from the question

**Q11, measured by accounting plus 110 runs.** `thin` and `schema` differ by 7,659 characters
of `outputSchema` but only +181–336 request tokens: **the output schema is not in the
model-facing request on Claude Code.** The root README's *"the model never sees this"* is
measured true for this host.

With the `select` field list removed from the input description, **sonnet still sent the
exact names 8/10**. The question says *"the weather label"* and *"the maximum temperature"*,
and sonnet camel-cased them. **Haiku managed 2/10** and never recovered. In 5 of its 8
misses it told the user, falsely, that *"the API doesn't expose"* max temperature. Two
server behaviours closed its escape routes. A partly-valid `select` returns no list of
valid names, and a retry without `select` is over the output limit (§12).

On meanings, delivered prose changed the **explanation, not the choice**. Every run on
both arms picked `weightedHdd` for the Dutch degree-day series. But without the weighting
semantics sonnet **invented** a rationale in 8/10 runs (*"wind-weighted"*, *"NEN 5128"*),
and with them it stated the real ×1.1/1.0/0.8 every time. And a projection can fail with the
right fields: on the fighting-days question sonnet selected `tempMin` and `tempMax` every
time and still scored **0/20**, misreading boundary values (14.1 °C, 20.5 °C). Haiku scored
13/20 on the same records.

> **Keep the output field list in the input description** (haiku needs it) **and return
> the valid names on every partly-invalid `select`.** When a threshold decides the answer,
> compute it and return the complete result: the alert's *"(+6 more)"* truncation is where
> sonnet went wrong.

### 14 · Where this host drops what you ship — one table

| what you ship | what Claude Code does | found by |
|---|---|---|
| a tool description | sends the first **2,048 characters**, then `… [truncated]` | Q7 |
| server instructions | the same 2,048-character cut | Q7 |
| a tool result | replaces anything over **~25k tokens** with a "saved to file" notice: lost without file tools; an agent with jq pulled the named `interpretation` key back (manual test, n=1) | Q9 |
| `outputSchema` | **not sent** to the model | Q11 |
| input schemas | sent (the `select` field list, 430 chars, arrives) | Q11 |

`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` (from 2.1.280) raises the first cut per session,
at a token cost: +23.7% in Q15b. `MAX_MCP_OUTPUT_TOKENS` raises the second. **None of this
is visible on the protocol side**: raw `tools/list`, the unit tests and the server log all
show the full text. Check what the model received, not what the server sent.

**Q12, the second-domain check, and why it could not be closed.** Both registered
candidates (Artikelbeheer, Ketenstandaard) are closed APIs, and an eval publishes its
records. On public weather data, with the tool's own partial-period rule in the
description, in the response, or nowhere: **18/20, 19/20, 19/20**. The channels tie again,
but the no-rule control is at ceiling. Models compare two quarters' degree-days unaided, so
this question cannot tell the channels apart. It was recorded as measuring nothing.

A question with headroom, normalising ONE quarter to an average year, scored:

| arm | haiku | sonnet | total |
|---|---|---|---|
| no rule | 0/10 | 3/10 | 3/20 |
| rule in description | 0/10 | 10/10 | 10/20 |
| rule in response | 0/10 | 10/10 | 10/20 |

The rule is worth 7 of 10 on sonnet by either channel. That is delivery, not channel, in a
second data domain. **haiku ignores it everywhere** and multiplies by the full-year factor.
A rule that says *go fetch more data* does not move the weak model; one that says *read
this value this way* did (Q15). Every result above is still one server and one author.

**Re-baselines.** RB1 re-ran the one `schema → words` gap quoted as "the prose is the
carrier" (sonnet, `total-vs-per-m2`, n=20): **4/20 → 11/20**, direction only. The sentence it
credited sat at char 4,311 and was never delivered, so the mechanism is withdrawn. Whatever
helps sonnet sits in the first 2,048 characters.

### 15 · Rounds 3 and 4: structure, the rest of the cap, the model split, and cost

Four runs registered together, 230 runs:

- **Targeted semantics (Q10 reopened) does not help haiku.** The same sentence in the
  response as prose, as `relates_to_fields`, or with a server-computed `triggered_by`:
  **1 / 0 / 1 of 20** on the single-quarter rule, and **11 / 14 / 14** on the area rule (noise).
  Where haiku reads the right field and still applies it wrongly, labelling the edge does
  not change that.
- **The name was never the problem (RB2).** Delivered uncut, `opaque-words`' glossary takes
  a neutral field name to **20/20**. Q6's 0/7 was absence.
- **The prose rung works when delivered (RB3).** `schema` 1/10 → uncut `words` 10/10 on
  `total-vs-per-m2` (sonnet).
- **The rule helps only the middle model (Q12, opus).** The single-quarter rule is worth 0
  on haiku (it does not act on it), 7/10 on sonnet, and 0 on opus (9/10 without it).

**Then Q16 found what does fix it.** With the reference quarter the rule needs delivered
in the response, haiku goes from **2/20 to 15/20**. The barrier was *fetching* the data, not
*applying* the rule. Handing over the finished factor added nothing beyond that (11/20).

**Q16b showed the same fix pays for the strong models too.** Sonnet and opus were already
correct from the rule alone, but they built their own reference with 4–16 weather calls and
landed anywhere between 4,490 and 4,970 m³. With the server's reference they made **one
call**: **−87% calls, −23% tokens, −3/4 wall time**, and the same answer in 20/20.

**And Q17 closed the addressing question at scale.** Two relevant rules alone, among 10, or
among 100 real distractor rules (~16k chars), with or without `relates_to_fields`. Haiku found
the overheating rule at position 41 of 100 in every run, and sonnet was 10/10 on the area
rule in every arm. Response guidance does not dilute at this scale, so targeting has nothing
to recover at runtime.

**Q18 then tested the authoring side, and found the same.** An improving agent (sonnet,
opus, one tool-less read of the source, 276 runs) did three things equally well from
today's prose and from `{ relates_to_fields, meaning, provenance }` records:
- found the rule a failing trace points at: 100% in every form;
- listed the rules a schema change orphans: 99.4% vs 100%;
- listed the fields with no semantics: F1 100 in every form.

Only provenance mattered. Asked whether to delete the CALCULATED vs MEASURED rule, agents
with its history cited the 0/60 → 59/60 eval every time. Agents without it re-derived the
rationale and asked for a re-test. None invented a history.

> **If a rule needs data the payload lacks, ship the data: it makes the weak model right
> and the strong ones fast. The form and the volume of the guidance do not matter at
> runtime, and not to the agent that edits it either; record why each rule exists.**

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
  from level to 3×. Two of those were **same-batch halves of a single run**, so
  being in one batch protects a comparison's *direction* but not its *size*.
  Large effects (0/60→59/60, 10/30 vs 30/30, 5/20 vs 20/20) sit far outside that
  band; few-run gaps do not. **This bar has now been applied backwards through
  every file** — see
  [`results/2026-09-22-variance-audit-of-prior-results.json`](results/2026-09-22-variance-audit-of-prior-results.json).
  Three claims are downgraded to direction-only; the rest hold. The weakest is
  *"the prose rung is the carrier on sonnet"*, whose supporting cell is the very
  one the variance warning was built from. **Re-baselined 2026-09-23 (RB1, n=20):** the
  direction holds (`schema` 4/20, `words` 11/20), but the sentence it credited was never
  delivered, so the mechanism is withdrawn. See [`results/2026-09-23-rb1-schema-words-total-vs-per-m2.json`](results/2026-09-23-rb1-schema-words-total-vs-per-m2.json).
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
