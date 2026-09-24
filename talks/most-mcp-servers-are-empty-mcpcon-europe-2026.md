# Most MCP servers are empty

**MCPCon Europe 2026** · Amsterdam · 18 September 2026 ·
[session page](https://agntconmcpconeu26.sched.com/event/2VmKE) ·
[slides, PDF](most-mcp-servers-are-empty-mcpcon-europe-2026.pdf) (19 slides)

Seven months of production MCP at a 350-person building-services contractor. MCP solved
transport and auth; what it cannot solve is **meaning**, which differs at every company, tool and
field. When the application disappears behind an agent, the meaning it carried has to move into
the MCP server. The talk shows a ladder for doing that, a method for discovering the meaning from
live data (Introspective Context Engineering for MCP), what production telemetry changed about
the tools, and one gap in the protocol: **bound is not the same as delivered**.

This page is a slide-by-slide summary, with notes where the evals in this repo changed a claim
after the talk. The terms are defined in [Terminology](../docs/terminology.md); the lines are
collected in [Quotes & principles](../docs/quotes.md).

---

## 1 · Most MCP servers are empty

Title. _Seven months of production MCP at a 350-person company._

## 2 · The question

_Someone who has never opened our ERP is going to ask it about some data. What is going to tell
the agent what it means?_ The question the rest of the talk answers.

## 3 · February 2026

Transport: solved for everyone. Auth: solved for everyone. **Meaning**: different at every company,
every tool, every field — and not something the protocol can hand you.

## 4 · "Does this building have an energy label?"

A hypothetical example of the problem: the same question to a thin and a rich server, and both
return `energielabel: null`. If nothing says what the null means, it could mean _no label_, _not
registered_, _not applicable_ or _not loaded yet_, and the model has to guess — "this building has
no energy label". One line saying null means not registered grounds the answer: none is registered
for this address. _Same null. Nothing in the response says which._

**In this repo:** the example is not reproducible as a failure here, because the payload carries a
second field that disambiguates the null — thin also returns `labelCount: 0`. The same case in
the eval set, `invented-label`, is a control every arm answers correctly
([evals](../evals/README.md#the-set)). A null that does separate the tiers is
`absent-sizing-input`: the field a heat-pump sizing needs is null, and haiku fabricated a figure
3 times in 20 with the note about it, 10 in 20 without
([AS](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)). The
live A/B that separates most is the Paris Proof trap under
[Try it live](../README.md#try-it-live).

## 5 · Where did the meaning go?

In a classic application, the backend carried business rules, derived values and normalisation;
the frontend carried labels, warnings, validation and visualisation. Put tools and an agent in
between and the systems of record stay unchanged, the user stays unchanged — and all of that
meaning has to land in the tool layer. _The API could be dumb because the application was smart._

## 6 · The agent isn't empty. The server is.

Models reason well; what is missing is in the payload. And _"it works" may simply mean the model
guessed correctly._

**Since the talk:** measured — a strong model answered right on every arm when the fact could be
inferred from the payload, and failed when it could not
([L2](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).

## 7 · Why it works for you, and not for them

The error chain, as pilots call it: low AI fluency × a weaker model or no thinking × a thin server
with no meaning × imperfect data → a confidently wrong answer. Of the four links, the server is
the only one you own. _Break one link and the odds drop._

## 8 · Where this comes from

12 custom MCP servers in production, used mostly by non-developers; 97 tools; 8 MCP Apps that
render the answers. ERP, BIM, estimating, building automation, energy, external registers, IT. A
350-person Dutch mechanical building-services contractor with five developers.

## 9 · We scaled capabilities, not agents

The person with the question → one general-purpose model, no agent per domain → MCP capabilities
that carry access, meaning and bounded authority → systems of record, unchanged. Questions do not
respect the org chart. _If the interface is empty, an agent on top of it is a guess with a job
title._

## 10 · Who discovers the meaning?

The six levels: L1 API wrapper (nobody — the agent reconstructs the domain), L2 descriptive tool
(the author, briefly), L3 domain-aware (a human in the lead), L4 self-teaching (the agent, from the
real data). Then putting back the rest of what the application did: L5 interactive (MCP Apps), L6
safe write (guarded mutation). _Level 4 is not more work than level 3. It's less, and better
grounded._ In this repo: [the six levels](../docs/terminology.md#the-six-levels).

## 11 · Introspective Context Engineering for MCP

Scaffold something thin, straight from the API docs. Then loop three to four times: **Examine** your
own deployed tool in a fresh context, **Flag** every finding with a confidence level, **Validate**
what the data can settle, **Encode** into the channel the model actually reads, **Iterate** — in
production, telemetry picks the next gap. After the loop the expert validates only what the agent
could not settle. Harden with tests and a findings log. _The spec gives you the shape. The data
gives you the meaning._

**Since the talk:** "the channel the model actually reads" became concrete — the description head
within the first 2,048 characters, the input schema, and the response; not the output schema. The
[skill](../.claude/skills/rich-domain-mcp-server/SKILL.md) now runs this loop, with an audit step
for existing servers. "Three to four times" is production practice, not measured here.

## 12 · Every tool, same eight blocks

Before the call: WHEN TO USE, WHEN NOT TO USE, RELATED TOOLS. Calling it: QUERY STRATEGY, RETURNS.
After the answer: INTERPRETATION, ALERTS. And FEEDBACK. A fixed template grown into, not designed
up front. _Three of those groups are needed at three different moments._

**Since the talk:** the block names cost nothing
([Q19h](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)),
but where they sit decides everything: in the `rich` tier the interpretation sat past the 2,048
cut and never arrived
([Q20, Q21](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
`best` keeps WHEN and HOW in the description head and moves WHAT into the response:
[reference implementation](../docs/reference-implementation.md).

## 13 · How do I know it's right?

Three validations: the AI interviews the expert on what it flagged (about 10% of the metadata);
the expert reads the finished text end to end; the people whose data it is validate it in use.
_You review. You don't author._

The ~10% is a production figure from the Warmtebouw servers, not measured in this repo.

## 14 · Every call carries what it was trying to find out

Real intents from production — fault reports to judge whether failures recur, a create checked
before a retry to avoid a duplicate. One field, `queryIntent`, on every call. _A log of calls
becomes a log of questions._

**In this repo:** every data and render tool takes `queryIntent`, and `get_tool_call_log` reads it back
([logging](../docs/running.md#logging)).

## 15 · I built get_ticket to return a ticket

What `queryIntent` showed callers actually wanted: the whole ticket at work-start ~23%, one
section or field ~26%, status and progress ~19%, verifying a previous write ~16%, duplicate or
scope triage ~11%. _They only asked for the whole thing because the whole thing was all I
offered._ Production data from a ticketing server, not part of this repo.

## 16 · Not prompt tuning. Interface engineering.

What the telemetry turned into — changes to what the tool does, not to what it says:

- **Selective retrieval** — one ticket read twice: 4 KB vs 265 KB, 67× cheaper, same information.
- **Summaries** — computed by the server instead of rows for the model to add up.
- **Alerts** — fire only when the condition applies: conditional meaning at zero catalog cost.
- **Derived values** — the meaning arrives as a value, not as a warning.
- **The write reports back** — 16% of calls were verifying a previous write; now the write says
  what it did.

**Since the talk:** derived values measured as the most reliable form
([L1](../.claude/skills/rich-domain-mcp-server/references/evidence.md#content--what-to-ship)).
Alerts narrowed: when a correction is mandatory, an alert after a successful call is read as a
note — refuse the call instead
([Q22b, Q22c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
Selective retrieval in this repo: the weather tool's `select` ([live demo](../docs/live-demo.md)).

## 17 · Bound is not the same as delivered

Which surface is bound to the tool, and which reaches the model: description and input schema
(bound, before the call), the response (bound, after the call), the output schema (bound, not as
model context), server instructions (server-wide, client-dependent), a skill or resource (nothing
ties it to the tool; arrives only if something fetches it). _Today I have to choose where to lose.
Not ideal. But it arrives._

**Since the talk — the biggest change.** The table marked the description as reaching the model.
Four days later the evals showed that on Claude Code only its first **2,048 characters** do, on
every request, and 74% of the rich tier's description never arrived
([Q7](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). The output schema
was confirmed absent ([Q11](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery));
a response over ~25k tokens is replaced by a file notice
([Q9](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)); a guidance tool is
called only when the pointer says it is required
([Q8b](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). The thesis held;
the table got stricter. One view of it all:
[evals §14](../evals/README.md#14--where-this-host-drops-what-you-ship--one-table).

## 18 · One string. Three moments.

A tool description holds three documents for three moments: WHY / WHY NOT to use it (before
selection), HOW to call it (after selection), WHAT the result means (after the response). The ask
to the protocol: _if the agent must know something before it can safely use a tool, should
discovering that knowledge be optional?_ Binding fixes the staleness; automatic activation fixes
the delivery.

**Since the talk:** once delivered, the channel did not matter — the same sentence scored the same
in the description and in the response
([Q15](../.claude/skills/rich-domain-mcp-server/references/evidence.md#delivery)). The problem is
delivery, which makes the ask sharper, not weaker.

## 19 · Most MCP servers are empty of meaning

_"What is going to tell the agent what it means?" The interface has to._ The closing slide
promised a skill that runs the loop, the practitioner paper, example code, a thin and a rich
server on the same public API, and these slides:
[all five, in the README](../README.md#if-you-came-from-a-talk).
