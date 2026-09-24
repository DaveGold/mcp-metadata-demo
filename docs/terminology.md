# Terminology

_By [David Golverdingen](https://davidgolverdingen.nl/en) — companion to [_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer)._

This repository uses the terms below with specific meanings. When this repo says **X**, this page
says what X means. It does not argue for the ideas; for that:

- [Design](design.md) — the principles and what they cost
- [Reference implementation](reference-implementation.md) — how `best` implements them
- [Research](../evals/README.md) — what was measured
- [Evidence register](../.claude/skills/rich-domain-mcp-server/references/evidence.md) — the run
  behind each rule, by row ID (`Q7`, `BT`, …)

Short formulations of the same ideas, with their evidence status: [Quotes & principles](quotes.md).

---

## The pattern

### Rich Domain MCP

An architectural pattern for MCP interfaces that own enough correct domain knowledge —
semantics, constraints, reference data, derived values, record-specific interpretation — for an
agent to use a capability without reconstructing the domain from raw API data, **and** that
deliver that knowledge through surfaces the host actually passes to the model.

Short form: _a domain interface that minimises what the model has to infer, fetch, reconstruct or
guess._

A **Rich Domain MCP Server** is a concrete MCP server that implements the pattern for one or more
capabilities. Use _Rich Domain MCP_ for the pattern and _Rich Domain MCP Server_ for an
implementation. The skill's identifier, `rich-domain-mcp-server`, is a name, not a third variant.
Avoid new variants such as _domain-rich MCP_ or _rich metadata MCP_; older talks and posts keep
their original wording.

The pattern was named by David Golverdingen (2026), in this repo and in
[_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer).

### Agent-facing capability

A business or technical capability exposed to an agent with enough contract, semantics and
safety information for the agent to discover it, invoke it and interpret what comes back. More
than an endpoint or a thin tool wrapper. In this repo: one MCP tool and everything it carries.

### Domain knowledge

The facts and constraints needed to interpret and safely operate a capability: field meaning,
units, scope, null semantics, allowed values, relationships, constants, reference data,
thresholds, domain rules, determinate derivations. It is **owned with the capability**; its
delivery may be projected into names, descriptions, schemas or responses.

### Anti-metadata

Metadata that makes the model more wrong than no metadata would — typically a name or a line that
implies a different quantity than the field holds. It overrides the correct prose next to it
([N2](../.claude/skills/rich-domain-mcp-server/references/evidence.md#naming),
[BT](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).

---

## Delivery

### Ownership vs delivery

**Ownership**: where is the canonical domain truth maintained? **Delivery**: through which
model-visible surface does the relevant part reach the model, for this interaction?

Short form: _own domain knowledge at the capability; project it where the model can use it._ This
keeps "domain knowledge belongs in the MCP server" from being read as "put all of it in one tool
description."

**Projection** is the act of exposing a selected part of canonical knowledge through the surface
that suits the host and the moment — a name, the description head, the input schema, the
response.

### Protocol-visible vs model-effective

**Protocol-visible** knowledge exists in the MCP objects the server emits. **Model-effective**
knowledge actually reaches the model in a form it can act on. Three states, and each can fail:

> server emits → host delivers → model acts on

A rule can be correct in the source and present in `tools/list` and still have no effect, because
the host truncates it, drops its channel, replaces the result, or never fetches the source that
holds it ([Q7, Q9, Q11, Q8](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).
And delivered is not yet applied: a delivered alert can still be read as a note
([Q22b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).

### The cut / the delivered budget

On Claude Code, only the first **2,048 characters** of a tool description (and of server
instructions) reach the model, on every request
([Q7](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). _The cut_ is that
boundary; _the delivered budget_ is the space before it. _The description head_ is what sits
inside it. The number is host-specific: verify it per client.

### Channel

A surface that can carry guidance: field names, the description, server instructions, the input
schema, the output schema, the response, a skill, a resource, a guidance tool. The measured
finding is **delivery, not channel**: the same delivered sentence works equally well in the
description and in the response
([Q15](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).

---

## What the interface carries

### Expressibility

Whether the model can represent a valid call through the model-visible invocation contract. An
input schema has two jobs: validation, and the vocabulary the model must produce. Where the thin
schema could not express a needed parameter, no amount of prose helped
([L3](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).

### Shipped data

The data a rule needs in order to be applied, returned with the result — rather than a rule that
sends the model off to fetch it. Short form: _if a rule needs data the payload lacks, ship the
data_ ([Q16, Q16b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
Distinct from computation: supply the inputs first; compute when the result is determinate.

### Determinate computation

A result that follows reproducibly from known inputs and a defined domain rule. Where it belongs
to the capability, the server computes it instead of every model reconstructing it. A computed
value carries its result, unit, basis and provenance — or `null` with the reason it could not be
computed safely ([L1](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).

### Interpretation

The record-specific context needed to read a returned result correctly. In `best` it is the
`interpretation` key, returned first in every data tool's response: alerts, notes and constants
for this record, not for every possible record.

### Alert vs refusal

An **alert** is a conditional message in a successful result: _this applies to what you just got_.
A **refusal** rejects the call and says how to fix it. Use the refusal when a correction is
mandatory — an alert after a successful render is read as a note, not as a reason to redo the call
([Q22b, Q22c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).

### queryIntent

A parameter on every data and render tool: the business question behind the call, in the caller's words. It
turns _a log of calls_ into _a log of questions_. Its role is observability and improvement — it
tells the server's author what the next gap is — not routing.

### Provenance

The recorded reason a rule, rename, constant or behaviour exists: a source, an expert answer, an
incident or a measured result. In this repo every design rule links to its row in the evidence
register. Provenance was the only authoring form that changed what an improving agent did
([Q18](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).

---

## The method

### Introspective Context Engineering for MCP (ICE)

An iterative method for discovering and improving the context an MCP capability exposes. Instead
of writing domain guidance up front from vendor docs, you interrogate the deployed tool against
live data, flag ambiguity with a confidence level, validate what the data can settle, encode the
result into a surface the model receives, and measure again.

> Scaffold → **Examine → Flag → Validate → Encode → Iterate** → Harden

The domain expert validates what the agent could not settle; production telemetry
(`queryIntent`) picks the next gap. _Rich Domain MCP_ is the destination; _ICE_ is the method for
getting there. Use _ICE_ only after the full name has been given once.

The method was named by David Golverdingen (2026) and presented in
[_Most MCP servers are empty_](../talks/most-mcp-servers-are-empty-mcpcon-europe-2026.md#11--introspective-context-engineering-for-mcp),
MCPCon Europe 2026.

### Evals

Behavioural tests of what a model actually does with an agent-facing interface. They are not unit
tests: _unit tests protect the truth of domain knowledge; evals protect its effect on the model._
Here, every eval has a prediction registered before the run and every run is audited against the
server's own call log ([method](../.claude/skills/rich-domain-mcp-server/references/evidence.md#method)).

- An **arm** is one server variant in an eval, differing from the others in one controlled way
  (`thin`, `words`, `inline-fact`, `best`, …).
- The **variance bar**: at n=10, a gap of ≥ 8 is quotable as a size, 4–7 as a direction only,
  < 4 is noise.

---

## Tiers and levels

### thin, rich, best

The three tiers served over the same data in this repo.

- **thin** — the raw API as a tool: a one-line description, a bare schema.
- **rich** — the talk's tier: long descriptions, typed schemas, curated alerts. It predates most
  of the eval findings and was fixed after them.
- **best** — the reference implementation derived from the measured findings. A repository name,
  not a claim that the design is optimal everywhere.

### The six levels

The ladder from the talk _Most MCP servers are empty_, by who discovers the meaning:

| level | name | who discovers the meaning |
|---|---|---|
| L1 | API wrapper | nobody — the agent reconstructs the domain |
| L2 | Descriptive tool | the author, briefly |
| L3 | Domain-aware | a human, in the lead |
| L4 | Self-teaching | the agent, from the real data (ICE) |
| L5 | Interactive | how it is shown — MCP Apps |
| L6 | Safe write | how it is changed — guarded mutation |

`thin` is L1; `rich` sits at L2–L3; this repo's render tools are L5. L6 is not in this repo.

---

## The larger thesis

These terms describe the architecture the project argues for. They come from production
experience, not from this eval set, and should be quoted as a thesis. The argument itself:
[Capability architecture](capability-architecture.md).

### Capability reuse

One domain capability composed into many workflows, agents or questions without being rebuilt
for each. The basis for _we scaled capabilities, not agents_ and _scale capabilities, not use
cases_.

### Capability stacking

Composing independently useful capabilities into questions and workflows none of them was built
for. Its effect is **compounding optionality**: with _n_ composable capabilities there are 2ⁿ − 1
possible sets, and each new one extends every set already present. A claim about the option space,
not about value — most combinations are useless, and value does not grow exponentially.

### Ambassador

An early user chosen for the rollout: someone with a frequent real problem, enough domain
knowledge to judge the answers, and enough credibility for colleagues to follow. Also called a
_champion user_. Part of the discovery loop, not only of distribution: their questions show what
the capability is missing.

### Skill (procedure layer)

A captured work procedure — steps, decisions, rules, approval points — that a general agent runs
over the capabilities. Capabilities say _what the company can do_; skills say _how the work is
done_; a prompt, a schedule or an event says _when_. Not to be confused with _the skill_ in this
repo, [`rich-domain-mcp-server`](../.claude/skills/rich-domain-mcp-server/SKILL.md), which is an
engineering procedure for building interfaces.

### Engineering multiplier

The phrase is Gregor Ojstersek's (TechLead Conference): an engineer who multiplies their impact by
combining human skills, pragmatic problem solving and AI tools — attribute that framing to him. In
this repo's extension: a system that turns engineering work into reusable capability, so that
other people can compose, run and improve their own workflows without a new software project for
each.

### General-purpose vs specialised agents

The project does not argue that specialised agents are unnecessary. It argues that one should not
be required only because a general agent was given an insufficient interface: _specialize the
agent when the task demands it; enrich the interface when the domain demands it._

### Agent-readable company

A company that exposes its systems as composable agent-facing capabilities carrying enough domain
meaning for a capable general agent to discover, interpret and safely operate them. Short form:
_make the company agent-readable._ In the fuller form it also exposes how its people work —
procedures as skills, operational rhythm as schedules and events — not only what its systems can
do.
