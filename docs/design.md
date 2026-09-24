# Design — what survived the experiments

This is the human-facing version of the design: the principles, why they hold, and what they cost.
The agent-facing version — ordered steps, checklists, hard budgets — is the
[`rich-domain-mcp-server`](../.claude/skills/rich-domain-mcp-server/SKILL.md) skill. The link
between each principle and the run behind it lives in one place only, the skill's
[evidence register](../.claude/skills/rich-domain-mcp-server/references/evidence.md); this page
cites its row IDs (`Q7`, `BT`, `N2`, …) instead of repeating the numbers. How `best` implements
it, line by line: [`reference-implementation.md`](reference-implementation.md). The terms used
here are defined in [`terminology.md`](terminology.md).

## Relation to the paper and the talk

[_The Missing Layer_](https://davidgolverdingen.nl/en/the-missing-layer) argues that domain
knowledge belongs in the MCP server, and that production usage shows what the metadata is still
missing. The talk _Most MCP servers are empty_ added the capabilities that feedback loop yields —
Select, summaries, alerts, derived values — and a warning: **bound is not the same as delivered**.

The evals kept the thesis and sharpened the delivery half:

- The talk's table marked the tool description as reaching the model before the call. On Claude
  Code only its first **2,048 characters** do ([Q7](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).
  Most of a long description is bound and never delivered.
- Once delivered, the channel does not matter: description and response tie
  ([Q15](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). An earlier
  reading that "the response beats the description" was the cut, not the channel
  ([Q1, reversed](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).
- The biggest failures were not missing knowledge but **wrong** knowledge — including a computed
  alert in this repo's own `rich` tier
  ([BT](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship),
  [Q20](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
- A fix the model must make needs a refusal, not an alert
  ([Q22b, Q22c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).

## 1 · The capability owns the knowledge

Domain knowledge is owned by the capability that owns the data and behaviour — not by a wrapper
agent, a system prompt, or a per-domain agent. The talk's version: _we scaled capabilities, not
agents_. One general model sits on top; every server carries its own meaning. The reason is
practical: questions do not respect the org chart, and a meaning that lives in one agent's prompt
is missing for every other caller.

## 2 · Ownership is not delivery

Canonical truth can be projected through several surfaces, and they do not all arrive:

| surface | reaches the model? |
|---|---|
| field names | always, in every response |
| tool description | only the head (the first 2,048 chars on Claude Code) |
| server instructions | the head, and it is server-wide, not bound to a tool |
| input schema | yes |
| output schema | no — validation and UI only ([Q11](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)) |
| response | yes, below a size limit; above it, a file notice replaces it ([Q9](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)) |
| a skill, a resource, a guidance tool | only if something makes the model fetch it ([Q8, Q8b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)) |

Two consequences. **Verify delivery per host** — these numbers are Claude Code's; do not assume
another client behaves the same. And **audit what you already ship**: a line past the cut is
dead weight, and a wrong line inside it is worse than none.

## 3 · Before the call

The model decides whether and how to call before it has any response. So the description head
carries only what that decision needs:

- **WHY / WHY NOT** — when to use the tool, when not, what it joins with. A refusal that must be
  possible without a call ("this server has no metered consumption") belongs here.
- **Expressibility** — the input schema is for making the right call possible and validating it,
  not for explaining meaning. A parameter the thin schema lacks can make a question unanswerable
  for the strongest model ([L3](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
- **Vocabulary the model must produce** — list exact valid values (e.g. `select` field names) in
  the _input_ description; otherwise the model invents them from the user's wording
  ([N7](../.claude/skills/rich-domain-mcp-server/references/evidence.md#naming)).
- **Universal rules** that hold for every record, each a fact plus an instruction, early in the
  head.
- **Pointers worded as requirements.** A soft hint to call a guidance tool is ignored by weaker
  models ([Q8b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).
- **Say "call it directly"** when the model tends to ask the user instead of calling
  ([Q19g](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
  A prohibition in the head can also suppress the call that would have shown the problem
  ([Q19e](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).

## 4 · In the result

The response has no description budget, and it arrives exactly when meaning is needed.

- **Names first.** A field name is the one carrier guaranteed to arrive. Name quantity, scope,
  provenance and unit; a name that implies a different quantity overrides the prose next to it
  ([N2](../.claude/skills/rich-domain-mcp-server/references/evidence.md#naming)), and a name
  without a unit gets one invented ([N5](../.claude/skills/rich-domain-mcp-server/references/evidence.md#naming)).
- **`interpretation` first** — the rules for _this_ record, before the data.
- **Ship the fact with the instruction.** An instruction whose trigger is a withheld fact is inert
  ([Q4](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
  State whether a quantity is calculated or measured, and what it may be compared with
  ([BT](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
- **Ship the data a rule needs**, not a pointer to go and fetch it — and not a finished factor
  either ([Q16, Q16b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
  Make it comparable across calls ([Q19b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)),
  and mind its upstream cost: cache what cannot change, respect the source's quota
  ([Q19c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
- **Compute determinate values server-side**, with unit, basis and provenance — or `null` with the
  reason ([L1](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
  For thresholded results, return the verdict complete, not a truncated list
  ([Q11b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
- **Keep notes about null decision fields**; pruning should remove the note, never the field
  ([AS](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
- **Guard the response size**: drop records before you lose the interpretation to a file notice.
- **Alert or refuse.** Use an alert when the user should know something. Refuse the call, with the
  fix in the message, when the operation must be corrected before it continues — a model reads an
  alert after a successful call as a note, not as a reason to redo it.

## 5 · What you do not need to worry about

Several things that feel important measured as null — useful, because they free the design:

- **Volume** of response guidance, up to a hundred rules
  ([Q17](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)),
  and pruning it to the record ([Q2](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).
- **The form** of a rule at runtime — prose, `relates_to_fields`, computed trigger
  ([Q10](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).
- **Tailoring per model**: once a determinate top rung exists, every model saturates on it
  ([M1](../.claude/skills/rich-domain-mcp-server/references/evidence.md#model-differences)).

What does cost: metadata that answers nothing is paid for on every call
([Q5](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)),
while metadata that answers the question can make the call cheaper, because the model has less to
work out ([Q3](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).

## 6 · Domain knowledge is infrastructure

Treat it like code:

- **Source-control it, canonical and versioned** — in `best`, a rule registry and a rename table.
- **Record provenance per rule and per rename.** It never reaches the model, and it is the one
  form that changed the outcome for the agent that later _improves_ the server
  ([Q18](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).
- **Test its truth deterministically** — pin every computed value to ground truth, check the
  description budget and rule coverage.
- **Eval its effect on the model**, and keep those evals as regression tests. Evals found what the
  green test suite could not: the 2,048 cut, a stale deploy, a quota the tool exhausted itself, and
  this repo's own wrong alert.
- **Have a person who knows the business validate** what the agent could not settle from the data.
  You review; you do not author.

## 7 · The loop that finds the next gap

The method from the talk, Introspective Context Engineering: **Scaffold** something thin, straight
from the API docs → **Examine** your own deployed tool in a fresh context → **Flag** each finding
with a confidence level → **Validate** against the data, then with the expert → **Encode** into the
channel the model actually reads → **Iterate**. In production, telemetry picks the next gap: every
call carries a `queryIntent`, which turns a log of calls into a log of questions.

## 8 · Portability

Design correctness at the capability layer, where every host sees it: names, the description
head, the input schema, the response. Host-specific surfaces — skills, hooks, raised client caps —
can improve activation and convenience, but correctness should not depend on one host. Raising a
client's description cap, for example, delivers the block but taxes every tool on every request
([Q15b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)).

## 9 · What is measured and what is not

Every principle above resolves to a row with a status: `settled`, `direction`, `null`,
`reversed` or `open`. Read the status before quoting a principle as fact. The standing caveat on
all of it: one author wrote the metadata, questions, ground truth and scoring; one domain family
(Dutch building and weather data); one host (Claude Code); one model family (Claude haiku, sonnet,
opus). Thirteen of the first twenty-three preregistered predictions were wrong — which is the
argument for measuring rather than reasoning about what a model reads. Open questions and their
predictions: [`evals/open-questions.md`](../evals/open-questions.md).
