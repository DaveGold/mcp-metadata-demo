# Research frame — where domain knowledge should become model-visible

> **Added 2026-09-22.** This file says **why the questions in
> [`open-questions.md`](open-questions.md) are the questions**. That file is the
> register: one section per experiment, prediction written before the run, result
> written after. This one is the map it is drawn on — the axes, the coverage, and the
> principles still to be falsified.
>
> Source: *If Domain Knowledge Belongs in the Response* (working draft, 2026-09-22),
> the follow-up note to [*The Missing Layer*](https://davidgolverdingen.nl/en/the-missing-layer).
> Where the draft and `results/` disagree, `results/` wins and this file says so.

## The objective, stated so it can fail

The goal is **not** to show that response metadata beats tool descriptions. It is to
find out whether the effectiveness of domain knowledge is a function of:

| axis | the question it asks |
|---|---|
| **channel** | tool definition, guidance response, output schema, or final tool result? |
| **timing** | before tool selection, during operation, or during post-tool interpretation? |
| **distance** | how far does the knowledge sit from the data and from the final reasoning step? |
| **conditionality** | is the knowledge globally true, or does it depend on the returned instance? |
| **addressability** | is it explicitly bound to the fields it explains, or merely adjacent to them? |
| **activation** | does the model evaluate the domain condition, or does the server resolve it first? |

The intended output is an evidence-backed answer to **when, where and how domain
knowledge should become model-visible in an MCP interaction** — not a recommendation to
write more of it.

### The distinction the whole frame turns on

> **Protocol-visible knowledge is not necessarily model-effective knowledge.**

A server can expose every rule the caller needs and still produce bad behaviour, because
it exposed them through the wrong surface at the wrong moment. That makes **placement an
architectural concern**, not a style question — and it means an experiment must inspect
the **actual model-facing context** wherever it can, instead of inferring visibility from
what exists in the MCP protocol objects. Q7 is that inspection, and nothing in this file
about "the description weakened" is safe to quote until Q7 lands.

> **Q7 landed on 2026-09-22 and proved this paragraph right in the bluntest way.** The
> host sends only the first 2,048 characters of each MCP tool description. So 70–72% of the
> `words` / `rich` prose, which exists in the protocol objects, was never in the model's
> context. Protocol-visible and model-effective were different on every run here. See
> [`results/2026-09-22-q7-description-truncation.json`](results/2026-09-22-q7-description-truncation.json).

## Coverage — what the six axes have and have not been tested on

| axis | tested by | status |
|---|---|---|
| channel | **Q1** (description vs response, byte-identical) · **Q1b** · **Q15 / Q15b** | **Answered 2026-09-23: delivery, not channel.** Q1's 4/30 vs 29/30 was undelivered vs delivered (Q7). With the sentence delivered in both channels, they tie: 20/20 vs 20/20 at the default cap (line inside the cut) and with the cap raised (whole block). Haiku, one question. |
| channel | **Q8** (bootstrap/guidance call) · **Q11** (`outputSchema`) | **Q8 answered 2026-09-23: the guidance call works when it is made, and whether it is made depends on the model.** sonnet 10/10 called and 10/10 correct; haiku 0/10 called and 0/10 route-correct. **Q11's main half answered by accounting (2026-09-23): `outputSchema` is not in the model-facing request on Claude Code** — a 7,659-char schema difference shows up as +181–336 tokens. |
| timing | **Q7** (is the description still present post-tool?) | **Answered 2026-09-22.** Yes: definitions are re-sent every request. But the description is cut to its first 2,048 chars on every request. |
| distance | **Q9** (position within a response; turns between guidance and data) | **Open.** |
| conditionality | **Q2** (prune the block to the record) | **Answered: free, not cheap.** −67% of the block, 0 answers changed, −4.8% tokens. |
| conditionality | **Q5** (does irrelevant metadata cost?) | **Answered: yes, at list price.** +1,172 tokens on a question the alerts do not answer. |
| addressability | **Q10** (`relates_to_fields` / `triggered_by`) | **Suspended 2026-09-23.** Its prior ("prose beside the value was read and misapplied", Q6) was absence: the sentence was never delivered. Delivered, `overheating` is 20/20 in every channel, so the set has no question left for this primitive to fix. |
| activation | server-side alerts vs prose (readable ladder) · **Q4** | **Partly answered.** Computed values: 78/78, identical on all three models — and the worst failure mode in the repo. |

Two axes the draft treats as one and this repo has had to split:

- **Fact vs instruction** (Q4). Opus named the calculated-vs-measured trap 7 times in 10
  and returned the forbidden verdict 10 times in 10. Knowing what a field *means* is not
  the same intervention as being told what to *say*.
- **Prose vs naming** (Q6). Neither carried it. The threshold sentence was present,
  explicit and ignored in `words` (2 of 7); renaming the field to a neutral code scored
  **0 of 7**, because the model then lost the field entirely. *Put interpretation next to
  the thing being interpreted* was tested here and **the interpretation was read and not
  used** — the indicated fix was server-side computation, not better placement.

## The layered model being tested

Not a conclusion. The hypothesis the axes above are meant to break.

| stage | surface | what belongs there | this repo's evidence |
|---|---|---|---|
| **WHEN** | tool description | what the capability does, when to pick it, stable preconditions | Q1: guidance placed here scored 4/30 at interpretation time |
| **INPUT** | input schema | valid inputs, required fields, formats | `thin` 0/18 → `schema` 18/18 where the call cannot be *expressed* without the parameter; ≈0 elsewhere |
| **HOW** | guidance / bootstrap response | parameter strategy, sequencing, recipes, examples | guide ablation: the DERIVED FIGURES recipe is what produces the answer, for every model — **untested as a channel (Q8)** |
| **CONTRACT** | output schema | types, units, stable field meaning, invariants | asserted here to be invisible to the model; **never measured (Q11)** |
| **WHAT** | returned data | the instance | — |
| **MEANING** | runtime projection in the response | activated conditional interpretation, cross-field semantics, caveats | Q1: 29/30 · Q2: pruning is free · Q5: irrelevant projection is charged in full |

Compact form, to be falsified rather than quoted:

> Discover with the description. Operate with guidance. Define stable meaning in the
> schema. Interpret the instance in the response.

## The token hypothesis

The claim is not that richer responses are better. It is that the right unit is:

```text
domain-knowledge tokens per correct answer
```

A domain may hold hundreds of rules while one response needs four. If semantics are
projected at the point of use, domain richness can scale without proportional context
growth.

**What the runs say so far, and it is not a clean win:**

- Pruning the interpretation block to the record is **free** — no accuracy cost — but the
  block is ~2% of a ~38,000-token run, so the saving is not worth having on its own
  (Q2). The case for conditional projection is structural, not economic.
- Metadata that **answers the question being asked** can pay for itself several times
  over: `rich` ran 594 tokens *cheaper* than `words` on `gas-estimate` despite ~378
  tokens more input per call, because the model had less to work out (Q3).
- Metadata that is merely present and irrelevant is **charged at list price on every
  turn**: +1,172 tokens on `overheating` (Q5).

So the efficiency argument for projection is real, and it is about **relevance**, not
about size. That is a sharper claim than the draft makes.

**And there is a counterweight the draft does not have, added 2026-09-22.** Everywhere
measured so far, pruning was free — which is why *project only what is relevant* reads as
costless. `get_weather_context`'s `select` is the first case where **projection is the
mechanism of the error**: a model told to keep the response small drops `tempMax`, or
picks `hdd` over `weightedHdd`, and returns a well-formed answer with no alert and a wrong
conclusion. Nothing in the response distinguishes it from a correct one.

That puts a condition on principle 8. Projecting away what the *server* knows is
irrelevant is safe; letting the *caller* project on a guess about what matters is not —
and the caller can only avoid the guess if it knows what the fields mean before it
chooses. Questions `select-hides-the-evidence` and `select-wrong-degree-day` in
`questions-weather.json` measure it; see `open-questions.md` Q11.

## Candidate design principles, with status

The draft lists eight principles to falsify. Here is where each one actually stands in
`results/`. **Three are in trouble.**

| # | principle | status |
|---|---|---|
| 1 | Descriptions are for capability discovery | **Falsified as an exclusive rule** (Q15) — a domain sentence inside the first 2,048 chars was applied 20/20, the same as in the response. What holds: on this host a description only carries its first 2,048 chars, so anything past that must go elsewhere. |
| 2 | Guidance is for operating the capability | **Conditional** (Q8): a guidance call delivers as well as the response when it is made, but haiku never made it (0/10 against sonnet's 10/10). Usable as an addition, not as the sole carrier. |
| 3 | Output schemas are the canonical home for stable output semantics | **Not deliverable on Claude Code** (Q11, by accounting): `outputSchema` never reaches the model there. It can be canonical for the SERVER; anything the model needs must be projected into the description's first 2,048 chars or the response. |
| 4 | Responses are for interpreting returned instances | **Supported as a robust default, not as a better channel** — Q1's 29/30 was against an undelivered description (Q7), and a delivered description ties it (Q15/Q15b). The response is host-independent and can be conditional on the record. |
| 5 | Data-dependent semantics should travel with the data | **Supported structurally, not economically** (Q2: free, not cheap) |
| 6 | Domain knowledge should be addressable to the fields it explains | **Open (Q10), with a live counter-signal**: Q6 shows adjacency failing and renaming failing too — 2 of 21 across both |
| 7 | Resolve conditional domain logic server-side | **Strongest effect and worst failure mode.** 78/78 when right; one plausible-looking computed line produced 59 of 60 wrong answers |
| 8 | Project only the semantics relevant to the current response and intent | **Supported on cost** (Q5), **null on accuracy** (Q2), **and newly conditional**: caller-side projection via `select` can silently drop the field the conclusion needed (Q11, amended) |

### The rule that outranks all eight

> **Volume does not hurt. Wrongness does.**

The largest single effect measured anywhere in `results/` is a defect, not a feature.
See *Design guidance* in [`open-questions.md`](open-questions.md).

## Claim boundaries

What can be said today, and nothing wider:

> **In the evaluated record-conditional task, the same domain guidance was applied when
> it reached the model, whichever channel carried it. On Claude Code a tool description
> reaches the model only up to character 2,048; guidance past that point was never
> applied because it never arrived.** (Until 2026-09-23 this read "far more effective
> when delivered with the tool result". Q15/Q15b withdrew that.)

Still hypotheses, and to be written as hypotheses:

- that all interpretation data belongs in responses;
- ~~that response placement beats descriptions in general~~ — tested and not supported on
  haiku once both channels deliver (Q15/Q15b);
- that end-of-response placement wins, and that recency is why (Q9);
- that `outputSchema` semantics are ineffective in all MCP hosts (Q11);
- that `relates_to_fields` improves attention routing (Q10);
- that the layered WHEN/HOW/CONTRACT/WHAT/MEANING split is both more accurate and more
  token-efficient;
- that progressive projection scales as the domain grows.

And the standing caveat on every number in `results/`: **the same party wrote the
metadata, the questions, the ground truth and the scoring.** One domain, one host, one
model family, n=10.

The strongest version of this work finds not only where the architecture wins, but
**where it stops helping or turns harmful** — which so far is: a wrong computed value,
a value whose name overrides the sentence explaining it, and metadata that answers a
question nobody asked.
