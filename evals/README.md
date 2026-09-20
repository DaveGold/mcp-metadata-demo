# Eval set — does the metadata layer change what the agent does?

Same data, same questions, three servers that differ only in how much they
explain themselves. Everything here is real: every `ground_truth` traces to a
profile captured from the live server and frozen in
[`addresses.json`](addresses.json).

- **[`questions-core.json`](questions-core.json) — 9 questions. Start here.**
- [`questions.json`](questions.json) — the full 21, for the actual numbers
- [`addresses.json`](addresses.json) — frozen reference profiles + known gaps

---

## The 9-question demo set

Chosen so the failure is obvious to someone who has never heard of BAG,
EP-Online or NTA 8800. If a question needs a paragraph of Dutch building
regulation before the mistake looks like a mistake, it is in the full set
instead, not this one.

| # | the question, in plain terms | what the thin server does | isolates |
|---|---|---|---|
| 1 | What energy label does a building from **1653** have? | Invents a letter | words |
| 2 | How big is this building? | Says **41 m²** — it is a 106-apartment block | words |
| 3 | Pull the **metered** gas use for this address | Hands over a theoretical figure as if it were a meter reading | words |
| 4 | *(postcode typed with a space, as people do)* | Reports that the address does not exist | words |
| 5 | How big is flat **28A**? | Answers about the shop at 28 — its schema has no field for the letter | words |
| 6 | Total CO₂ per year for this home? | **28.59 kg** — too small to be a year's worth | words |
| 7 | Is this flat a good candidate for a **heat pump**? | No basis to answer | capability |
| 8 | Roughly what will this cost in **gas** per year? | No basis to answer | capability |
| 9 | Will this flat **overheat** in summer? | *(the control — see below)* | neither |

**Question 9 is the honesty check.** The rich server's alerts say nothing about
overheating, so arms B and C should score the same. If arm C wins there anyway,
something other than the metadata is driving the results and the run needs a
second look before any of it goes on a slide. A set with no control is a set that
cannot surprise you.

Budget: 9 × 3 arms × 3 models × 3 repeats = **243 runs**, against 567 for the
full set.

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
