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
| **tool description** | **first 2,048 characters only**, re-sent on every request | 2,048 chars (keep a working ceiling ~1,800) | what the tool is and is not, when to pick it, input conventions, the few rules that must hold *before* a call | [Q7] [Q15] [Q15b] |
| **server instructions** | same 2,048 cut | 2,048 chars | cross-tool routing, "read `interpretation` first", what the server does NOT have | [Q7] |
| **input schema** (`.describe()`/`.meta()` per param) | **yes, in full**: no cut seen up to ~21.7k chars per tool — but re-sent every turn, for every tool, used or not | what forming the call needs; cost per turn | formats, working examples, the list of valid `select` names, misbehaving params, how to choose an enum value | [L3] [Q11] [IS] |
| **output schema** annotations | **no** — a 7,659-char schema difference cost +181–336 tokens | — | validation + UI only; keep shape-only | [Q11] |
| **tool response** | yes, **up to ~25k tokens**; above that the host replaces the result with a "saved to file" notice | keep < ~25k tokens (this repo guards at 50k chars) | the instance, record-conditional interpretation, computed verdicts, the data a rule needs | [Q9] [Q13] [Q14] [Q16] |
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
   `28A = huisnummer 28 + huisletter "A"`) has to live in the first 2,048 characters, because no
   response exists yet.
4. **Never put model-facing meaning only in the output schema** [Q11]. Keep it canonical for the
   server (validation, UI); project what the model needs into the description head or the
   response.
5. **A guidance tool is an addition, not a substitute.** Behind a soft pointer haiku made the
   call 0/10; behind *"REQUIRED: before any lookup, call this tool once …"* or as its own
   parameterless tool, 10/10, every caller correct, ~0.5% extra tokens [Q8b].
6. **Raising the client cap is not a fix.** `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH=20000`
   delivered the block, and cost +23.7% tokens, mostly from *other* tools' long descriptions
   [Q15b]. Fix delivery in the server.
7. **Distance barely matters under the limit.** A recipe fetched once was still applied after
   ~62k chars of other tool output (haiku 10/10, 10/10, 9/10) [Q9]. Deliver once per session;
   there is no need to repeat guidance in every response.

## Verify delivery yourself

The server side cannot see the cut: raw `tools/list`, unit tests and your logs all show the full
text [Q7]. Check the model side.

- **Ask the model where its description ends.** Spawn a fresh subagent that has the tool and ask
  it to quote the last 100 characters of the tool's description. A cut shows as a quote that
  stops mid-sentence with `… [truncated]` at exactly char 2,048. (This is how Q7 was found.)
- **Token accounting.** Change only surface X by N characters and compare per-run input tokens.
  If a 7,659-char change moves input by ~200 tokens, X is not in the request [Q11].
- **Measure offsets in CI.** A test that asserts `description.length <= 2048` and that each
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
