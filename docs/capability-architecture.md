# Capability architecture — the layer above the interface

The rest of this repo is about one capability at a time: what a good agent-facing interface
carries, and whether it reaches the model. This page is about what happens when there are many of
them, and when people start building on top of them. It is the architecture the project argues
for, not something this eval set measures.

Read every section with its status, in the same key as [Quotes & principles](quotes.md#quotes--principles):
`PRODUCTION` is what happened at Warmtebouw and cannot be reproduced from this repo; `THESIS` is
the broader claim that production suggests and nothing here establishes. What _is_ measured:
[Design](design.md). The terms: [Terminology](terminology.md#the-larger-thesis).

The adoption story gets its own page with the talk _Adoption is the hard part_ (Update Conference
Prague, November 2026). This page keeps the model and points there.

---

## The shape in one view

```
 systems of record        ERP · BIM · energy · tickets · building automation · registers
        │
 capabilities             what the company can do        ← Rich Domain MCP, improved by ICE
        │
 skills                   how the company does its work  ← written by the people who do it
        │
 activation               a prompt now · a schedule · an event
        │
 one general agent        composes all of it around a goal
```

Two loops run through it. A technical one: each capability makes new combinations possible, and
the questions people ask across them show which capability is missing next. A human one: people
get more out of the capabilities, capture what works as skills, and others reuse those.

---

## 1 · A rich domain, not domain rich

`THESIS`

The word order in _Rich Domain MCP_ is deliberate
([terminology](terminology.md#rich-domain-mcp)). _Domain-rich_ makes richness sound like volume:
more descriptions, more rules, more prose. The evals point the other way: wrong metadata did more
damage than missing metadata, and most of a long description never arrived
([Design](design.md#relation-to-the-paper-and-the-talk)).

_A rich domain_ is what the capability can faithfully represent and operate: semantics,
constraints, reference data, typed vocabulary, determinate calculations, record-specific
interpretation, refusals, bounded writes, and UI where interaction is part of the capability.
Richness is measured in what the interface can do correctly, not in what was written down.

## 2 · Capabilities first, agents on top

`PRODUCTION` for what Warmtebouw did, `THESIS` for the general claim

An agent-first architecture starts from use cases — use case A gets agent A — and each agent
accumulates its own prompts, domain instructions, integrations and business rules. The domain
knowledge ends up duplicated at the orchestration layer, once per agent.

Capability-first reverses the dependency. The capability owns access, meaning, constraints,
determinate behaviour and bounded authority; one general agent composes capabilities around the
question. At Warmtebouw that is the production setup: one general-purpose model over a growing set
of domain MCP servers, no agent per domain — _we scaled capabilities, not agents_
([who built this](../README.md#who-built-this-and-why)).

This does not make specialised agents unnecessary. It says one should not exist only because a
general agent was given an insufficient interface: _specialize the agent when the task demands it;
enrich the interface when the domain demands it._ Warmtebouw runs one of those too: a specialised
agent inside an application, with its own golden eval set — built because the task demanded it,
not because the interface was too thin.

The engineering consequence: you build the ERP capability, the BIM capability and the energy
capability, and make each one trustworthy enough to compose. You do not build ERP + BIM,
BIM + energy and ERP + BIM + energy as separate workflows. _You engineer the capability, not every
future use case._

## 3 · Capability stacking

`THESIS`

With _n_ independently composable capabilities there are 2ⁿ − 1 non-empty sets of them. Adding one
more adds 2ⁿ new sets: the new capability alone, and with every set that already existed. Twelve
capabilities give 4,095.

That is a statement about **optionality**, not value. Most combinations are useless, some are
unsafe, and business value does not grow exponentially. The point is narrower: a reusable
capability does not only add its own use case, it can extend every combination already present.
That is the mechanism behind _scale capabilities, not use cases_.

What the combinations add is paths between systems that stay separate:

| capabilities | the question it opens |
|---|---|
| BIM | what is in this building? |
| energy | how is this building performing? |
| BIM + energy | which physical characteristics may explain that performance? |
| + ERP | what does that mean technically and financially for this project? |
| + tickets | do building characteristics, energy, maintenance and cost relate? |

Nothing is merged into one data platform. What goes away is the boundary around what can be
_asked_ across the systems — not because the model invents what is missing, but because two correct
capabilities together expose a path neither had alone. This only holds if each capability is
correct on its own: composition multiplies wrongness as readily as it multiplies options, which is
why the rest of this repo is about getting one capability right.

## 4 · Start with one useful capability

`PRODUCTION`

Warmtebouw did not start with an AI platform team, an enterprise ontology or an agent framework. It
started with one existing system, one recurring question and one capability that was useful before
the next one existed. The capability layer grew from there, with a small development team
([who built this](../README.md#who-built-this-and-why)).

That is one company, not proof. The claim it supports is modest: you do not have to architect the
agent-readable company up front; you can grow it one useful capability at a time.

## 5 · Adoption is part of the loop

`PRODUCTION`

A capability can be technically right and still change nothing if nobody works differently. The
rollout at Warmtebouw did not start company-wide. It started with **ambassadors** — a few people
with a real recurring problem, enough domain knowledge to spot a wrong answer, and enough
credibility for colleagues to follow — and grew with training as more people joined.

The pattern that worked early on was short: someone asked for something, the next day it was
there, with a prompt to try. The enthusiasm was immediate. An ambassador is not just an early
adopter; they are part of the discovery loop. Their real questions show what the capability is
missing, and each improvement gives them a better example to show the next colleague.

That makes adoption telemetry, not only distribution. `queryIntent` is one implementation: _a log
of calls becomes a log of questions_ ([terminology](terminology.md#queryintent)). The
questions nobody anticipated, the follow-up calls, the answers people re-check by hand — those pick
the next gap, the same way the method does ([ICE](terminology.md#introspective-context-engineering-for-mcp-ice)).

Access is not adoption, and neither is attending a training. Adoption is people repeatedly choosing
the capability for real work because it gets them a better result or saves them effort. The signals
worth watching: voluntary repeat use, people chaining capabilities without being told to, colleagues
adopting from a peer's example, and requests for the next missing capability instead of the
question of what AI can do. These are observations, not an eval framework in this repo.

## 6 · Skills: the procedure layer

`PRODUCTION` for skills and schedules, `THESIS` for what that makes of specialised agents

Capabilities answer _what can the company do?_ Skills answer _how does the company do this work?_
A recurring procedure — find the active projects, pull the energy figures, check open maintenance
issues, apply these rules, produce a review list, never write without approval — captured once
becomes reusable, without a new application for every repeated workflow.

At Warmtebouw this is what happened next. The first skills were built for people who asked for
them: an hours check for your own timesheet, an audit of a project's booked costs, a go/no-go scan
on an incoming tender. Now colleagues across the company build skills for all kinds of work
themselves, live artifacts are following, and some skills run on a schedule.

| layer | question | owned by |
|---|---|---|
| capability | what can the company do? | the team that owns the system |
| skill | how is this work done? | the people who do the work |
| activation | when should it run? | a prompt now, a schedule, an event |

A skill run by hand is a reusable procedure; attach a schedule and the same procedure runs as
operations — at Warmtebouw that is already the case. The thesis is what that adds up to: an
adaptive procedure plus capabilities plus a trigger plus a bounded objective is close to what is
usually built as a specialised agent. Here it _emerges_ from a general one, without a new agent
platform.

**Two meanings of "skill".** In this repo, _the skill_ is
[`rich-domain-mcp-server`](../.claude/skills/rich-domain-mcp-server/SKILL.md): an engineering
procedure for building interfaces. The procedure layer here is the same mechanism in the hands of
domain experts. Same packaging, different author and audience.

## 7 · A skill is a journey

`PRINCIPLE` where it rests on the app evals, `THESIS` otherwise

A skill is more than a prompt or an SOP. It is the path from a person's intent to a trustworthy
outcome, with capabilities underneath. A weak skill is a tool sequence: call A, call B, answer. A
stronger one is a sequence of state transitions: establish where we are and where we want to be,
resolve what is uncertain, gather evidence, decide, act, verify, and leave the person somewhere
useful. The tools are implementation details under the journey — the same move Rich Domain MCP
makes when it refuses to expose the raw API shape as the product.

At each step the designer decides what the person needs to see or decide, and which surface fits:
plain text, a question, a chart, table or map, an approval, or a refusal with the fix. Human
involvement is a design choice, not a default: not maximum autonomy and not maximum control, but
the right involvement at the right transition. Whether a surface is right is not only whether it
renders: [MCP Apps — refuse what would mislead](mcp-apps.md#refuse-what-would-mislead) covers the
part of this the evals measured.

## 8 · The engineering multiplier

`PRODUCTION` for the team, `THESIS` for the company

The phrase _engineering multiplier_ comes from Gregor Ojstersek, via a TechLead Conference slide:
a great engineer in the AI era multiplies their impact by combining human skills, pragmatic problem
solving and AI tools. Attribute it to him wherever that framing is used.

This project takes it one step further: the multiplier is a system that turns engineering work into
reusable capability, so that other people can compose, run and improve their own workflows without
a new software project for each.

```
classical   business asks → engineer builds a feature → business uses it
multiplier  engineer builds capabilities → experts compose them → experts capture procedures
            → the system runs them again → others reuse and extend them
```

The development team at Warmtebouw works the same way on itself: ticket context lives in Git next
to the code, plans are reviewed before implementation, review runs from a clean context, and
anything irreversible needs human approval — so that an improvement to the process carries over to
every ticket after it, rather than making one engineer faster. The thesis is that the same shape
works for the company: _the multiplier is not the model; it is the system that lets people compose
reliable capabilities into their own work._

## 9 · The agent-readable company

`THESIS`

The destination: a company whose systems are exposed as trustworthy capabilities, whose procedures
are exposed as reusable skills, and whose operational rhythm is exposed as triggers — so that a
capable general agent can discover, interpret, compose and safely operate across a growing part of
it ([terminology](terminology.md#agent-readable-company)).

The path there is not _buy AI → launch a chatbot → train everyone_. It is one problem, one
ambassador, one trustworthy capability, real use, a better capability, the next colleague, the next
capability, more composition, skills that capture what works — repeated.

---

## What is established and what is not

| claim | status | where the evidence is |
|---|---|---|
| delivery, expressibility, naming, shipped data, computation, refusals, guidance activation — on one host | `MEASURED` | [evals](../evals/README.md), [evidence register](../.claude/skills/rich-domain-mcp-server/references/evidence.md) |
| one general model over many domain servers, used mostly by non-developers | `PRODUCTION` | [who built this](../README.md#who-built-this-and-why) |
| ambassadors first; usage picks the next gap | `PRODUCTION` | this page, §5 |
| domain experts build their own skills; some run on a schedule | `PRODUCTION` | this page, §6 |
| capability-first beats agent-first in general | `THESIS` | — |
| capability stacking compounds optionality | `THESIS` | — |
| skills + triggers are a better way to get specialised agents | `THESIS` | — |
| the multiplier effect generalises across organisations | `THESIS` | — |
| the agent-readable company is the right endpoint | `THESIS` | — |

Nothing on this page claims an ROI or an adoption rate. One company, one team, one author: the same
caveat as [Design §9](design.md#9--what-is-measured-and-what-is-not), with less measurement under it.
