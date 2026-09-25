# Quotes & principles

_By [David Golverdingen](https://davidgolverdingen.nl/en), companion to [_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer)._

Short formulations from the talks, the writing and the research around this project. A
selection, not an archive. A memorable sentence is not automatically a measured finding, so every
line carries its status, and measured lines link to the run behind them.

What the terms mean: [Terminology](terminology.md) · what was measured:
[Research](../evals/README.md) · the run behind each rule:
[Evidence register](../.claude/skills/rich-domain-mcp-server/references/evidence.md)

**Status key**

| status | means |
|---|---|
| `MEASURED` | directly supported by an eval in this repo; quote it with its scope |
| `PRINCIPLE` | design guidance derived from the evals and the implementation |
| `PRODUCTION` | learned from running MCP in production; not reproducible from this repo |
| `THESIS` | a broader architectural claim that this eval set does not establish |

Where a line was used in public, the source says where. _MCPCon_ is
[_Most MCP servers are empty_](../talks/most-mcp-servers-are-empty-mcpcon-europe-2026.md),
MCPCon Europe 2026.

---

## The problem

> **Most MCP servers are empty of meaning.**

`THESIS` · MCPCon, slide 19

> **What is going to tell the agent what it means? — The interface has to.**

`THESIS` · MCPCon, slides 2 and 19

> **The API could be dumb because the application was smart.**

`PRODUCTION` · MCPCon, slide 5. The meaning used to live in the backend and the frontend; with an
agent in between, it has nowhere left to go but the capability.

> **The agent isn't empty. The server is.**

`THESIS` · MCPCon, slide 6

> **"It works" may simply mean the model guessed correctly.**

`MEASURED` · [L2](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship),
[Q12](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship) ·
MCPCon, slide 6. Opus scored 40/40 on every arm when the fact was inferable from the payload, and
1–3/10 when it was not. Companion line: _the better the model, the easier it is to hide a bad
interface._

> **If the interface is empty, an agent on top of it is a guess with a job title.**

`THESIS` · MCPCon, slide 9

---

## What the evals showed

> **A surface that can fix 59 answers can break 59.**

`MEASURED` · [BT](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship).
One plausible line made 59 of 60 answers wrong; one sentence took the same question from 0/60 to
59/60.

> **Bound is not the same as delivered.**

`MEASURED` · [Q7, Q11](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery) ·
MCPCon, slide 17. Proven more sharply after the talk: only the first 2,048 characters of a
description reach the model on Claude Code, and the output schema never does.

> **Check what the model received, not what the server sent.**

`MEASURED` · [Q7, Q11, Q15](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery).
Every protocol-side check in this repo (raw `tools/list`, unit tests, the log audit) saw the
full description.

> **Delivery decides; the channel did not.**

`MEASURED` · [Q15, Q15b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery).
The same sentence, delivered in the description and in the response: 20/20 and 20/20. _Scope:_ in
the tested cases, on one host.

> **Delivered is necessary, not sufficient.**

`MEASURED` · [Q4](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship),
[Q8](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery),
[Q22b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19).
A delivered instruction without its fact, a guidance tool nobody calls, a delivered alert read as
a note.

> **An instruction is not executable without the semantics that say when it applies.**

`MEASURED` · [Q4](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship).
Fact and instruction 30/30, fact only 25/30, instruction only 10/30.

> **Noticing is not acting.**

`MEASURED` · [M3](../.claude/skills/rich-domain-mcp-server/references/evidence.md#model-differences).
Opus named the calculated-vs-measured trap in 7 of 10 answers, and gave the forbidden verdict in
10 of 10.

> **If a rule needs data the payload lacks, ship the data.**

`MEASURED` · [Q16, Q16b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship).
Haiku 2/20 → 15/20; Sonnet and Opus needed 86% fewer calls. Summary form: _ship the data: it
makes the weak model right and the strong ones fast._

> **Metadata that removes work also removes variance.**

`MEASURED` · [Q16b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship),
[evals §3](../evals/README.md#3--the-layer-collapses-variance-not-just-error). With the data
shipped, the strong models' answers converged to one value.

> **A fix that must happen is a refusal, not an alert.**

`MEASURED` · [Q22b, Q22c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19).
Alert after a successful render: 2/10 fixed, 0/10 re-rendered. Refusal with the fix in the
message: 10/10. _Scope:_ the tested app-tool case.

> **In these evals, volume did not hurt; wrongness did.**

`MEASURED` · [Q2, Q17](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost),
[BT](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship).
_Scope:_ volume did not hurt accuracy, but irrelevant metadata is still paid for on every call
([Q5](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).
Prefer this scoped form over "volume does not hurt".

---

## How to build it

> **Own domain knowledge at the capability. Project it where the model can use it.**

`PRINCIPLE` · [Design §1–2](design.md#1--the-capability-owns-the-knowledge). Short form: _define
once, project when needed._

> **Not prompt tuning. Interface engineering.**

`PRINCIPLE` · MCPCon, slide 16

> **The spec gives you the shape. The data gives you the meaning.**

`PRODUCTION` · MCPCon, slide 11. Why the method discovers domain knowledge from live data instead
of writing it from vendor docs.

> **A finding without a confidence level is not a finding. It is an assumption that has lost its audit trail.**

`PRINCIPLE` · the _Flag_ step of the method: every finding carries a confidence level and a
question for the expert ([the skill](../.claude/skills/rich-domain-mcp-server/SKILL.md)).

> **You review. You don't author.**

`PRODUCTION` · MCPCon, slide 13. The agent drafts from the data; the domain expert validates what
it could not settle.

> **Unit tests protect the truth of domain knowledge. Evals protect its effect on the model.**

`PRINCIPLE` · [Design §6](design.md#6--domain-knowledge-is-infrastructure). The evals caught what
the green test suite could not: the 2,048 cut, a stale deploy, this repo's own wrong alert.

> **Plumbing is a day; metadata is the product.**

`PRODUCTION` · the first version of [the skill](../.claude/skills/rich-domain-mcp-server/SKILL.md).
Transport, logging and auth are solved; the layer the model reasons over is what you build.

---

## What production taught

> **We scaled capabilities, not agents.**

`PRODUCTION` · MCPCon, slide 9. Twelve servers, one general-purpose model, no agent per domain.

> **A log of calls becomes a log of questions.**

`PRODUCTION` · MCPCon, slide 14. What one `queryIntent` field on every call does.

> **You can't observe understanding. You can observe confusion.**

`PRODUCTION` · the call pattern shows where the interface is missing meaning, without the agent
having to report it.

> **They only asked for the whole thing because the whole thing was all I offered.**

`PRODUCTION` · MCPCon, slide 15. `queryIntent` showed most reads of a ticket wanted one section.

> **I set out to write better descriptions. Four times out of five, the answer was not a description.**

`PRODUCTION` · the five fixes on MCPCon slide 16 (selective retrieval, summaries, alerts, derived
values, a write that reports back) mostly changed what the tool does, not what it says.

---

## The larger thesis

> **Don't build a specialized agent just because your interface is too poor for a general one.**

`THESIS` · Companion: _specialize the agent when the task demands it; enrich the interface when
the domain demands it._

> **Not domain rich. A rich domain. And rich domains compose.**

`THESIS` · VibeKode Netherlands 2026. _Domain rich_ is what you wrote down; _a rich domain_ is what
the interface can do.

> **Scale capabilities, not use cases.**

`THESIS` · Companion: _you know you built a real capability when it starts getting reused by
things you did not build it for._

> **Make the company agent-readable.**

`THESIS` · see [agent-readable company](terminology.md#agent-readable-company).

> **Start with one useful capability, not an AI platform.**

`PRODUCTION` for how Warmtebouw started, `THESIS` as advice ·
[Capability architecture §4](capability-architecture.md#4--start-with-one-useful-capability)

> **You engineer the capability. You do not engineer every future use case.**

`THESIS` · [Capability architecture §2](capability-architecture.md#2--capabilities-first-agents-on-top)

> **Capability stacking compounds optionality.**

`THESIS` · a claim about the option space, not about value:
[capability stacking](terminology.md#capability-stacking).

> **Don't remove the systems. Remove the boundaries between what can be asked of them.**

`THESIS` · [Capability architecture §3](capability-architecture.md#3--capability-stacking)

> **Capabilities encode what the company can do. Skills encode how it works.**

`THESIS` · [Capability architecture §6](capability-architecture.md#6--skills-the-procedure-layer).
Colleagues writing and scheduling their own skills is `PRODUCTION`; that this generalises is the
thesis.

> **The multiplier is not the model. It is the system that lets people compose reliable capabilities into their own work.**

`THESIS` · extends Gregor Ojstersek's _engineering multiplier_; attribute the phrase to him
([terminology](terminology.md#engineering-multiplier)).

---

## Retired and narrowed

Lines that were used in public and that later evidence or review changed. Kept here so the history
of the thinking stays inspectable, and so they are not reused by accident.

| line | used | replaced by | why |
|---|---|---|---|
| ~~Most MCP servers are empty.~~ | early posts | **Most MCP servers are empty of meaning.** | Literally false: they have tools. |
| ~~The agent can call every endpoint and understand nothing.~~ | MCPCon announcement | **The models are good. It's the metadata that isn't.** | Models reason well; the premise was missing from the payload. |
| ~~The tool description reaches the model before the call.~~ | MCPCon, slide 17 | **Only the description head does**: the first 2,048 chars on Claude Code. | [Q7](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery), four days after the talk. |
| ~~The response beats the description.~~ | first eval round | **Delivery decides; the channel did not.** | The description copy sat past the cut ([Q1, reversed](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). |
| ~~Agents won't call a meta-tool to learn something.~~ | MCPCon talk notes | **They won't on a hint. They will when the pointer says REQUIRED, or the guidance is its own tool.** | Soft pointer 0/10, REQUIRED 10/10 ([Q8b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). |
| ~~Specify behaviour, not semantics.~~ | earlier design rule | **Ship the fact with the instruction.** | [Q4](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship) |

Every design rule the evals refuted or narrowed:
[evidence register](../.claude/skills/rich-domain-mcp-server/references/evidence.md#rules-that-were-refuted-or-narrowed--do-not-reintroduce).
