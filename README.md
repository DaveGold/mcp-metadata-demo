# Rich Domain MCP

Companion repo to the talk _[Most MCP servers are empty](talks/most-mcp-servers-are-empty-mcpcon-europe-2026.pdf)_
(MCPCon Europe 2026) and the paper _[The Missing Layer](https://davidgolverdingen.nl/en/the-missing-layer)_.

Most MCP servers expose data. This repo shows what happens when the server also carries the domain
knowledge an agent needs to use that data correctly — and measures whether that knowledge actually
reaches the model.

> Domain knowledge belongs with the capability that owns the data.
> Then measure whether it arrives.

Built from seven months of MCP in production at a 350-person Dutch building-services contractor —
[who and why](#who-built-this-and-why).

**[Try it live](#try-it-live)** · **[How it's built](docs/reference-implementation.md)** · **[The research](evals/README.md)**

## If you came from a talk

The closing slide promised five things. Here they are:

1. **A skill that runs the loop on your server** — builds a new one or audits an existing one,
   every rule linked to the run behind it: [Claude Code](.claude/skills/rich-domain-mcp-server/SKILL.md)
   · [Codex](.codex/skills/rich-domain-mcp-server/SKILL.md)
2. **The practitioner paper** — [_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer)
3. **Example code** — the reference implementation, walked through by WHY / HOW / WHAT:
   [`docs/reference-implementation.md`](docs/reference-implementation.md)
4. **A thin and a rich MCP server on the same public API** — plus a third, `best`:
   [try it live](#try-it-live)
5. **The slides, as a PDF** — [_Most MCP servers are empty_](talks/most-mcp-servers-are-empty-mcpcon-europe-2026.pdf)
   · [slide by slide](talks/most-mcp-servers-are-empty-mcpcon-europe-2026.md), with what the evals
   changed since

**What changed since the talk.** The talk said _bound is not the same as delivered_, and marked
the tool description as reaching the model before the call. Four days later the evals showed that
on Claude Code only the first **2,048 characters** of a description arrive — and 74% of the rich
tier's description never did. The thesis held; where the knowledge has to go changed. **`best` is
the architecture that survived the experiments. `rich` is the talk's version, fixed after them.**

## thin → rich → best

**Thin** — the raw API as a tool: a one-line description, a bare schema. The model reconstructs
the domain itself, and guesses. Level 1 of the talk's ladder, the API wrapper.

**Rich** — long descriptions, typed schemas, curated alerts: the tier from the talk (levels 2–3).
Much better — but most of the description never arrived, and one computed alert was confidently
wrong.

**Best** — what the evals left standing:

- a description head that fits the delivered budget
- an input schema that can express every valid call
- field names that cannot be misread
- `interpretation` first in the response, for this record
- the reference data a rule needs, shipped with it
- determinate values computed by the server
- a refusal when the call must be corrected
- provenance per rule, and evals as regression tests

## What the evals changed

More than 3,700 scored live runs across Claude Haiku, Sonnet and Opus, every prediction registered
before its run, every run audited against the server's own call log. Six results that shaped `best`:

- **Wrong is worse than missing.** One plausible line (`EP-1 … Paris Proof: 70 kWh/m²`) made 59 of
  60 answers wrong; one sentence saying the figures are CALCULATED, not MEASURED, took the same
  question from 0/60 to 59/60. ([BT](.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship))
- **Delivered is what counts.** Claude Code sends only the first 2,048 characters of a tool
  description, and never the output schema. Moving one correcting sentence inside the cut took a
  failing question from 0/10 to 10/10. ([Q7](.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery),
  [Q21](.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19))
- **Ship the data, not just the rule.** A rule that sent the model off to fetch history: Haiku
  2/20. The same rule with the server-computed reference figure: 15/20 — and Sonnet and Opus
  needed 86% fewer calls. ([Q16, Q16b](.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship))
- **The schema decides what can be asked.** Where the call needs a parameter the thin schema
  lacks, thin scored 0/18 and a typed schema 18/18 — the weakest model with the layer beats the
  strongest without it. ([L3](.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship))
- **Compute what is determinate.** A server-computed value scored 20/20 on value and derivation;
  every arm that left the arithmetic to the model, 2/60 combined.
  ([L1](.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship))
- **Refuse, don't alert, when a fix is mandatory.** An alert after a successful render fixed 2/10
  and triggered no redo; refusing the call with the fix in the message: 10/10.
  ([Q22b, Q22c](.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19))

**13 of the first 23 predictions were wrong.** The implementation changed with the evidence.

The full narrative: [`evals/README.md`](evals/README.md) · the questions and preregistered
predictions: [`evals/open-questions.md`](evals/open-questions.md) · every run:
[`evals/results/`](evals/results/) · the evidence behind every design rule:
[`evidence.md`](.claude/skills/rich-domain-mcp-server/references/evidence.md)

## The resulting design

**Before the call** — when to use the tool and when not, in the head of the description, inside
the delivered budget; an input schema that can express every valid call and lists the exact
vocabulary the model must produce.

**In the result** — `interpretation` first; field names that carry quantity, scope and unit; the
data a rule needs; determinate values computed server-side, or `null` with the reason; a refusal
when the call must be corrected.

**Behind the interface** — rules kept canonical, with provenance per rule; deterministic tests for
their truth; evals for their effect on the model; `queryIntent` and production telemetry to find
the next gap.

Why, and at what cost: [`docs/design.md`](docs/design.md) · line by line in the source:
[`docs/reference-implementation.md`](docs/reference-implementation.md)

## Try it live

No install, no API key. Three hosted endpoints over the same data; only the capability layer
differs:

- **thin** — `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpThin` (also at `/mcpMinimal`, the URL on the slide)
- **rich** — `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp`
- **best** — `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpBest`

```json
{
  "mcpServers": {
    "metadata-demo-thin": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpThin" },
    "metadata-demo-rich": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp" },
    "metadata-demo-best": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpBest" }
  }
}
```

Then ask each the **same question**:

> _"Gustav Mahlerlaan 10, 1082PP Amsterdam — how does it stack up against the Paris Proof 2040 office target of 70 kWh/m²?"_

The eval set's headline trap. The right answer: it **cannot be ranked from this data** — the
label figures are calculated, Paris Proof is defined on measured energy. `best` gets it right.

> _"What's the energy label of Museumstraat 1, 1071XX Amsterdam, and what should I keep in mind about this building?"_

The talk's opening example — and, on this data, not one that separates the tiers. Every tier gets
`energielabel: null`, but also `labelCount: 0`, so even thin usually reads it as _none
registered_; in the eval set the same case (`invented-label`) is a control every arm passes. What
differs is the rest of the answer: rich flags the pre-1992 insulation caveat, best says not to
infer a label from the building's age.

Three more prompts (visualisation, Select, reading `queryIntent` back) and the full tier
comparison: [`docs/live-demo.md`](docs/live-demo.md).

> Shared endpoints, rate-limited. Every call's `queryIntent` is stored and readable back by
> anyone via `get_tool_call_log` — don't put anything in it you would not want another user to
> see. [Logging details](docs/running.md#logging).

## Where to go next

**I build MCP servers.** Start with the skill ([Claude Code](.claude/skills/rich-domain-mcp-server/SKILL.md)
· [Codex](.codex/skills/rich-domain-mcp-server/SKILL.md)), then the
[reference implementation](docs/reference-implementation.md). To run or deploy this repo:
[`docs/running.md`](docs/running.md). The three self-describing MCP Apps (chart, table, map):
[`docs/mcp-apps.md`](docs/mcp-apps.md).

**I care about the research.** [`evals/README.md`](evals/README.md), then
[`evals/research-frame.md`](evals/research-frame.md), [`evals/open-questions.md`](evals/open-questions.md)
and the raw [`results/`](evals/results/).

**I care about what hosts actually deliver.** The wire views show, byte for byte, what each tier
sends and where the cut falls: [`best`](docs/wire/best.md) · [`rich`](docs/wire/rich.md) ·
[`thin`](docs/wire/minimal.md). The one-table summary:
[evals §14](evals/README.md#14--where-this-host-drops-what-you-ship--one-table).

**I lead an AI or platform team.** The paper, [_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer),
then [`docs/design.md`](docs/design.md) for what the evals changed.

## Concepts and language

- [Terminology](docs/terminology.md) — what the terms in this repo mean, canonically
- [Quotes & principles](docs/quotes.md) — the short formulations, each with its evidence status

## Talks

- **Most MCP servers are empty** — [AGNTCon + MCPCon Europe 2026](https://agntconmcpconeu26.sched.com/event/2VmKE)
  · Amsterdam · Sep 17–18 2026 ([slides, PDF](talks/most-mcp-servers-are-empty-mcpcon-europe-2026.pdf)
  · [slide by slide](talks/most-mcp-servers-are-empty-mcpcon-europe-2026.md))
- **Domain knowledge belongs in the MCP server** — [VibeKode Netherlands 2026](https://vibekode.it/agentic-engineering/domain-knowledge-belongs-in-the-mcp-server/)
  · Utrecht · Oct 7 2026
- **Adoption is the hard part: six months of MCP in production at an HVAC company** —
  [Update Conference Prague 2026](https://prague.updateconference.net/en/2026/schedule/adoption-is-the-hard-part-six-months-of-mcp-in-production-at-an-hvac-company)
  · Prague · Nov 12–13 2026

Full, up-to-date list: [davidgolverdingen.nl/en/talks](https://davidgolverdingen.nl/en/talks).

## Who built this, and why

**David Golverdingen** — Senior Engineer & MCP Architect at Warmtebouw, a 350-person Dutch
mechanical building-services contractor with five developers.

There, twelve custom MCP servers run in production — ERP, energy, BIM, estimating, building
automation, external registers — with 97 tools and 8 MCP Apps, used mostly by people who are not
developers. One general-purpose model on top, no agent per domain: _we scaled capabilities, not
agents_.

Why this repo: someone who has never opened our ERP is going to ask it about some data. Something
has to tell the agent what that data means, and the only thing I own is the interface. Production
data cannot be shared, so this repo shows the same approach on public Dutch registers (BAG,
EP-Online, Open-Meteo) — and measures it, because "it works" may simply mean the model guessed
correctly.

[Website](https://davidgolverdingen.nl/en) · [LinkedIn](https://www.linkedin.com/in/davidgolverdingen/)
· [GitHub](https://github.com/DaveGold) · [The Missing Layer](https://davidgolverdingen.nl/en/the-missing-layer)

## License

MIT
