# Delivery — what actually reaches the model

> **Local overlay:** REQUIRED — if `<repo-root>/.skill-local/rich-domain-mcp-server/delivery.md` exists, read it
> before the rest of this file (SKILL.md → *Local overlays*).

> **Protocol-visible knowledge is not model-effective knowledge.** A server can expose every
> rule the caller needs and still get bad answers, because the rule sat on a surface the host
> never forwarded. Placement is an architecture decision, and you verify it on the model side,
> not by reading your own `tools/list`.

Every number below is from this repo's eval set (`evals/results/`). The host is Claude Code
unless a row says otherwise; re-verify for any other target client with the techniques at the
bottom. Bracketed tags (`[Q7]`) resolve in [`evidence.md`](evidence.md).

---

## The surface table

| surface | reaches the model? | budget | what belongs there | evidence |
|---|---|---|---|---|
| **field names** in the returned data | **always** — in every response, on every host | none | what the value IS: quantity, scope, provenance, unit | [N1]–[N6] |
| **tool description** | **the head only**, re-sent on every request: 2,048 chars on Claude Code up to 2.1.294; 4,096 up front and 16,384 through tool search since 2.1.296; 16,384 on claude.ai; whole on ChatGPT, Codex and Mistral | 4,096 chars (keep a working ceiling ~3,600) | what the tool is and is not, when to pick it, input conventions, the few rules that must hold *before* a call | [Q7] [Q15] [Q15b] [CC] [HD2] |
| **server instructions** | cut at 2,048 on Claude Code up to 2.1.294, 4,096 since 2.1.296 [CC]; 4,096 on claude.ai, **but only after the first call** to that server; **512** on ChatGPT Chat and Work; whole on Codex (on every tool); **not at all** on Mistral | 512 chars | cross-tool routing, "read `interpretation` first", what the server does NOT have — each repeated in a description head or the response | [Q7] [HD2] |
| **input schema** (`.describe()`/`.meta()` per param) | **yes, in full** on Claude Code, claude.ai, ChatGPT Chat and Mistral: no cut seen up to ~21.7k chars per tool; **Codex and ChatGPT Work drop every describe past 5,000 chars** [HD] [HD2] — but re-sent every turn, for every tool, used or not | what forming the call needs; cost per turn | formats, working examples, the list of valid `select` names, misbehaving params, how to choose an enum value | [L3] [Q11] [IS] |
| **output schema** annotations | **no** on Claude Code, claude.ai and Mistral Code — a 7,659-char schema difference cost +181–336 tokens; **yes** on ChatGPT (Chat and Work), Codex and Mistral Work [HD2] | — | validation + UI only; keep shape-only | [Q11] [HD2] |
| **tool response** | yes, **up to ~25k tokens**; above that the host replaces the result with a "saved to file" notice. Which channel arrives depends on the host: Claude Code and Mistral `structuredContent` only; claude.ai `content` only; ChatGPT Chat both, or `structuredContent` only with an `outputSchema`; Codex and ChatGPT Work the whole result; `_meta` never; an error's text always [Q28] [HD2]. Mirror the two | keep < ~25k tokens (this repo guards at 50k chars) | the instance, record-conditional interpretation, computed verdicts, the data a rule needs | [Q9] [Q13] [Q14] [Q16] |
| **guidance call / meta-tool** | only if the model makes the call — and it makes it only when the pointer is an instruction | — | procedures and recipes, when they cannot go in the response | [Q8] [Q8b] |
| MCP Resources | client-dependent, not measured here | — | never the sole home of essential guidance | — |

**The input schema is delivered, and paid for every turn.** It is not a place to park what does
not fit in the description. Interpretation of results belongs in the response, which is paid
only when the tool is called. On `best`, render_chart and render_table alone are 42k of the 73.6k
characters every request carries [IS].

Trimming it is safe and pays on every run: the same structure in fewer words (tools/list 73.6k →
48.3k) lost nothing and cost 21–23% fewer tokens on every question group, including questions
that never draw a chart; moving the shapes of the rarer chart types behind a REQUIRED
`get_chart_guidance(type)` (41.4k) saved 26–29%, and the pointer was followed 58/62 times where it
applied [Q25]. Confirmed at n=10 on the rarer shapes: as reliable as the trimmed schema (117
against 118 of 120) and 7.6% cheaper, so `best` uses the guided form.

## Per host (measured 2026-11-17) [HD2]

What each client delivered from one probe server (`evals/host-probe/delivery-probe-server.mjs`:
8,192- and 20,480-char descriptions, 8,192-char server instructions, input schemas of 2,000 and
6,982 chars, an output schema, and the eight result-channel probes of Q28), two runs per host.
Every surface is numbered blocks with a code only the delivered block holds, so a quote proves
delivery. SKILL.md turns this into budgets per target client.

| client | tool description | server instructions | input schema | output schema | result channel |
|---|---|---|---|---|---|
| Claude Code 2.1.325 | cut at 4,096 up front; 16,384 through tool search (the default) | cut at 4,096 | whole | not delivered | `structuredContent` only; image kept |
| claude.ai (chat and Cowork, merged; a Claude Code harness) | 16,384, after tool search | cut at 4,096, **only after the first call** to the server | whole | not delivered | `content` only (`structuredContent` when content is empty) |
| ChatGPT Chat | whole, in context | cut at 512 | whole | delivered | both; `structuredContent` only with an `outputSchema`; error as text |
| ChatGPT Work (the Codex runtime) | whole, after lookup | cut at 512 | describes dropped past 5,000 | delivered | the whole result, both channels, errors included |
| Codex CLI 0.165 | whole, after lookup (0 chars in the prompt) | whole, prepended to every tool | describes dropped past 5,000 | delivered, as a TypeScript return type | the whole result, both channels, errors included |
| Mistral Vibe Work | whole, after search | **none** | whole | delivered | `structuredContent` only; images dropped |
| Mistral Vibe Code | whole, after search | **none** | whole | not with the tool (only through a connector-listing tool) | `structuredContent` only; image kept as a file |

`_meta` reached no model anywhere. Mistral's two tabs run different models (self-reported GLM 5.3
and Mistral Large 4) and differ on the output schema, images and errors; they are two hosts.

### Was: 2026-09-27 [HD]

The first round, on the `rich` tier (a 7,978-char description, 2,829-char server instructions, a
20,181-char `render_table` input schema). The Claude Code rows are the versions the evals ran on
(2.1.275–2.1.280) and 2.1.296+ as read from the changelog and binary [CC]. Changed since: chat and
Cowork merged; ChatGPT Work now gets 512 chars of instructions; ChatGPT Chat now gets the output
schema every time.

| client | tool description | server instructions | input schema | output schema |
|---|---|---|---|---|
| Claude Code up to 2.1.294 | cut at 2,048 | cut at 2,048 | whole | not delivered |
| Claude Code 2.1.296+ (2026-10-26) [CC] | cut at 4,096 up front; at 16,384 through tool search (the default for MCP tools): whole | cut at 4,096: whole | not re-probed | not re-probed |
| Cowork (web, desktop app) | cut at 4,096 | whole | whole | not delivered |
| claude.ai chat (web, desktop app) | whole, after tool search | **none** | whole | not delivered |
| ChatGPT Chat | whole | cut at 512 | whole | sometimes (1 in 3) |
| ChatGPT Work | whole, read with code | **none**; the app description typed in ChatGPT instead | describes dropped past 5,000 | delivered |
| Codex CLI 0.154 | whole, once the model looks it up (0 chars in the prompt) | prepended to every tool | describes dropped past 5,000 | delivered, as a TypeScript return type |

The 5,000 limit is on the serialized input schema: 5,000 keeps all 26 describes, 5,001 drops all 26,
and nesting has no effect. ChatGPT Work is the Codex tool runtime (its tools are named
`mcp__codex_apps__*`). The chat-host rows are quote probes checked against fingerprints; the Codex
row is read from the request.

## What follows from it

1. **The variable is delivery, not channel.** Delivered in both channels, the same sentence
   scored 20/20 in the description and 20/20 in the response [Q15]; with the cap raised and the
   whole block uncut, 20/20 vs 20/20 [Q15b]. Every earlier "response beats description" result
   (4/30 vs 29/30 [Q1]) compared delivered with *undelivered* text.
2. **Prefer the response for interpretation anyway.** No host cut applies to it, a later edit
   above it cannot push it out, and it can be conditional on the record — a description is
   written before the data exists. Put it under one fixed, named key (`interpretation`) so a
   model that only has the spilled file can still `jq` it out [Q9].
3. **The description head is prime real estate.** Anything a model must know *before* it calls
   (the refusal "this server has no metered consumption data", the input convention
   `28A = huisnummer 28 + huisletter "A"`) has to live in the first 4,096 characters (Claude Code
   2.1.296+ up front [CC] [HD2]), because no response exists yet.
4. **Never put model-facing meaning only in the output schema** [Q11]. Keep it canonical for the
   server (validation, UI); project what the model needs into the description head or the
   response.
5. **A guidance tool is an addition, not a substitute.** Behind a soft pointer haiku made the
   call 0/10; behind *"REQUIRED: before any lookup, call this tool once …"* or as its own
   parameterless tool, 10/10, every caller correct, ~0.5% extra tokens [Q8b].
6. **Raising the client cap is not a fix.** `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`
   delivered the block, and cost +23.7% tokens, mostly from *other* tools' long descriptions
   [Q15b]. Fix delivery in the server. Claude Code raised its own defaults in 2.1.295–2.1.296
   [CC]; that helps users on new versions and none on old ones. The same variable
   set to `2048` reproduces the old cut on a new version, for an eval that depends on it.
7. **Distance barely matters under the limit.** A recipe fetched once was still applied after
   ~62k chars of other tool output (haiku 10/10, 10/10, 9/10) [Q9]. Deliver once per session;
   there is no need to repeat guidance in every response.

## Verify delivery yourself

The server side cannot see the cut: raw `tools/list`, unit tests and your logs all show the full
text [Q7]. Check the model side.

- **Ask the model where its description ends.** Spawn a fresh subagent that has the tool and ask
  it to quote the last 100 characters of the tool's description. A cut shows as a quote that
  stops mid-sentence with `… [truncated]` at exactly the host's cut (2,048 on Claude Code up to
  2.1.294, 4,096 or 16,384 since). (This is how Q7 was found; a quote of the true end is how CC
  was confirmed.)
- **On another host, run the delivery probe** [HD2]. `evals/host-probe/delivery-probe-server.mjs`
  serves every surface as numbered blocks with codes (`truth` prints them); the prompts are in
  `delivery-probe-prompts.md`. Chat hosts reach it over `http <port>` behind a tunnel; ask for the
  first and last label of each surface and score the codes. Codex CLI: `codex exec
  --ignore-user-config --disable apps -c mcp_servers.<name>.default_tools_approval_mode="approve"`
  with `RUST_LOG=trace`, and read the request; MCP tools are deferred there, reachable through
  `ALL_TOOLS` in the `exec` tool. On claude.ai ask about the server instructions again *after* a
  call: they arrive late.
- **Token accounting.** Change only surface X by N characters and compare per-run input tokens.
  If a 7,659-char change moves input by ~200 tokens, X is not in the request [Q11].
- **Measure offsets in CI.** A test that asserts `description.length <= 4096` and that each
  load-bearing sentence starts before a fixed offset (`indexOf('CALCULATED') < 900`) is the only
  thing that stops a later edit silently pushing a rule past the cut. See
  [`best-arm.test.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/best-arm.test.ts).
- **Measure the response.** Serialize a worst-case response (a full-year, unprojected weather
  call is ~79k chars) and assert a bound; drop bulk records with an alert naming the remedy
  (`select`, `summaryOnly`) rather than letting the host replace the whole result.
- **Canary.** A harmless, checkable instruction placed next to the sentence you are unsure about
  ("end your answer with the word CANARY") shows whether that position is delivered and obeyed.
  An Opus parent session treated one as an injection and declined it, so use it in eval
  subagents, not in production text [Q15].
