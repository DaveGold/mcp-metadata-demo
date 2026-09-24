# Live demo — three tiers, same data

Three hosted endpoints serve the **same** Dutch building capability over the same data path; only
the capability layer differs. Point Claude Code — or any MCP client — at them and ask the **same
question** of each.

| tier | endpoint | what it ships |
|---|---|---|
| **thin** | `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpMinimal` | one sentence per tool, no schema descriptions, no alerts |
| **rich** | `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp` | the tier from the talk: a long description, a described input schema, curated `alerts[]` |
| **best** | `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpBest` | the reference built with the skill: descriptions inside the 2,048 cut, `interpretation`-first responses, computed values, fields named so they cannot be misread |

Same Firebase project, same code: one `createServer({ variant })` factory, and the function name
picks the tier (`mcpMinimal` = variant `minimal`, the thin tier; `mcp` = `rich`; `mcpBest` =
`best`). The eval arms are deployed from the same factory.

```json
{
  "mcpServers": {
    "metadata-demo-thin": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpMinimal" },
    "metadata-demo-rich": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp" },
    "metadata-demo-best": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpBest" }
  }
}
```

Shared endpoints, rate-limited — fine for a demo. For sustained use,
[deploy your own](running.md#deploy-your-own-copy). Every call's `queryIntent` is stored and
readable back by anyone through `get_tool_call_log`; see [Logging](running.md#logging).

## The prompts

### 1 — The A/B: ask thin and rich, compare the answers

> _"What's the energy label of Museumstraat 1, 1071XX Amsterdam, and what should I keep in mind about this building?"_

- **rich** → returns `energielabel: null` **plus**
  `alerts: ["Pre-Bouwbesluit 1992 — likely limited insulation.", "No registered energy label found in EP-Online."]`.
  The agent correctly explains that _no label is registered_ (not that the building has none) and
  flags the pre-1992 insulation caveat — with zero priming from you.
- **thin** → returns the same bare `null`. An unprimed agent typically concludes _"this building
  has no energy label"_ — wrong, and the exact misread the rich tier's alert exists to prevent.

Same registers, same building (it's the Rijksmuseum, bouwjaar 1885) — the only difference is the
metadata layer. This is the talk's opening example: same null, nothing in the response says which.

### 2 — Domain reasoning without priming (best, or rich)

> _"Gustav Mahlerlaan 10, 1082PP Amsterdam — how does it stack up against the Paris Proof 2040 office target of 70 kWh/m²?"_

The right answer is that it **cannot be ranked from this data**: every EP-Online figure is
CALCULATED by the label method, and Paris Proof is defined on MEASURED energy at the meter — same
unit, different quantity. `best` states that fact where the model reads it and scores 20/20 on
haiku. Until 2026-09-24 `rich` itself carried a computed alert that made exactly this comparison,
and the models repeated it (0/20). Removing that alert alone left `rich` at 0/10 on haiku: the
question invites the comparison, and `rich`'s CALCULATED vs MEASURED sentence sat past the 2,048
cut ([Q20](../evals/results/2026-09-24-q20-rich-alert-removed.json)). Moving that one sentence
inside the cut took it to 10/10 on haiku and on sonnet
([Q21](../evals/results/2026-09-24-q21-rich-line-delivered.json)). Removing a wrong line is half
the fix; delivering the right one is the other half. This is the eval set's headline trap
([`benchmark-trap`](../evals/questions.json)).

### 3 — Self-describing visualization (rich)

> _"Look up the building profiles for 1071XX 1 and 3543AR 1, then render a table comparing bouwjaar, energy label, and floor area."_

On **rich**, the agent picks `render_table` and its cell formatters straight from the schema — no
wrapper logic. On **thin**, the same app exists but with a one-sentence description and no
guidance, so the agent has to guess the payload shape and formatting unaided — the same ablation,
applied to the app config. More in [`mcp-apps.md`](mcp-apps.md).

### 4 — Selective retrieval, i.e. Select (rich)

> _"Get the weather for Utrecht for the whole of last year, and give me just the date, weather label, and max temperature for every day — I want to build a calendar view."_

The tool's `QUERY STRATEGY` block tells the agent that a year-long range would normally call for
`summaryOnly=true` (which drops daily rows entirely) — but points it at
`select=['date','weatherLabel','tempMax']` instead when per-day detail is actually needed. The
response is projected to just those three fields per day, `interpretation.alerts` confirms which
fields were kept, and asking for a field that doesn't exist returns an alert naming the valid ones
instead of an error or a silent full-record fallback.

### 5 — Iterate, i.e. reading queryIntent back (rich)

> _"What have people actually been asking this server?"_

Every tool accepts a `queryIntent` param describing the business question behind the call.
`get_tool_call_log` reads recent calls back — tool, queryIntent, status, duration — the same
signal production usage is read as a narrative to find the next metadata gap, at small scale and
live. Locally it's an in-memory buffer for the current process; on the deployed endpoint it's a
persisted Firestore log across every caller. See [`log-store.ts`](../src/shared/log-store.ts) and
[`get-tool-call-log.ts`](../src/tools/get-tool-call-log.ts).

## The ablation — what differs between tiers

Every tier runs the same tool names over the same data path; only the capability layer changes.
Exact bytes per tier: [`thin`](wire/minimal.md) · [`rich`](wire/rich.md) · [`best`](wire/best.md).

| | **thin** (`/mcpMinimal`) | **rich** (`/mcp`) | **best** (`/mcpBest`) |
|---|---|---|---|
| `get_building_profile` description _(model-visible up to char 2,048)_ | one sentence (~50 chars) | ~8,000 chars; 74% past the cut | 1,800 chars, all delivered |
| Input schema _(model-visible)_ | 2 bare fields, no descriptions, no validation | 4 fields, each `.describe()`d, format-validated | each `.describe()`d; weather's `select` lists its exact field names |
| Output schema _(never model-visible)_ | none — text-only result | full Zod schema, shape only | shape only; meaning is in the field names |
| Response-side meaning _(model-visible)_ | none | curated `alerts[]` | `interpretation` first: alerts, per-record notes, computed values with provenance |
| Render apps | stripped to one sentence each | full self-describing schemas | audited for delivery (Q22); refuses a mislabelled table |

**The data returned is the same.** Only the capability layer — metadata, alerts, derived values,
self-describing guidance — is removed, which isolates the claim.

The failure it prevents is concrete: a residential _Nader Voorschrift_ label returns `co2_emissie`
and `berekend_energieverbruik` as **MJ-totals for the whole building** (values of 80,000–100,000),
not kWh/m². The rich tier flags this in `alerts[]`; the thin tier hands over the bare number, so an
unprimed agent benchmarks it as a per-m² intensity and is wrong by orders of magnitude.

Even `rich` and `best` are condensed abstractions — the production system's alerts and schema
depth go well beyond what is shown here.
