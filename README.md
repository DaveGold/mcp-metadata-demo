# mcp-metadata-demo

> 📄 **Read the paper**: [*The Missing Layer*](https://davidgolverdingen.nl/en/the-missing-layer) — introducing **Introspective Context Engineering for MCP (ICE)**, the pattern this repo demonstrates.

A live, runnable companion to the paper. It tests one question with a working system: **how much of an AI agent's competence comes from the model, and how much from the metadata its tools carry?**

The same Dutch building-data tool (`get_building_profile`, over the open BAG + EP-Online registers) is deployed **twice** — once with a rich metadata layer (dense input/output schemas, curated advisories, interpretation guidance) and once with that layer stripped to a single sentence. Same data, same model, same prompts. Only the metadata differs.

> When tool metadata is rich enough, the AI doesn't need a wrapper agent telling it *how* to use the tool — the tool tells the AI itself. That's the missing layer.

> ⚠️ **This is a condensed public demo — not the full system.** Even the "rich" endpoint here is a deliberately lightened abstraction of a production MCP system built in industry. The real `alerts[]` rules, schema depth, and domain coverage go considerably further; this repo shows the *strategy*, not its ceiling.

## Try it live (no install, no API key)

Two hosted endpoints. Point Claude Code — or any MCP client — at them and ask the **same question** to feel the difference.

| Endpoint | Tool metadata | URL |
|---|---|---|
| **rich** | full description, input/output schemas, curated `alerts[]` + interpretation | `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp` |
| **minimal** | one sentence, no schema, no alerts | `https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpMinimal` |

Same Firebase project, same code — only the function name (`/mcp` vs `/mcpMinimal`) and the metadata tier it serves differ.

Add **both** to your `.mcp.json` (Claude Code) so you can aim a prompt at each:

```json
{
  "mcpServers": {
    "metadata-demo-rich": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcp" },
    "metadata-demo-minimal": { "url": "https://europe-west4-mcp-metadata-demo.cloudfunctions.net/mcpMinimal" }
  }
}
```

> Shared endpoints, rate-limited — fine for a demo. For sustained use, [deploy your own](#deploy-your-own-copy).

### Example prompts

**1 — The A/B (ask BOTH servers, compare the answers):**

> *"What's the energy label of Museumstraat 1, 1071XX Amsterdam, and what should I keep in mind about this building?"*

- **rich** → returns `energielabel: null` **plus** `alerts: ["Pre-Bouwbesluit 1992 — likely limited insulation.", "No registered energy label found in EP-Online."]`. The agent correctly explains that *no label is registered* (not that the building has none) and flags the pre-1992 insulation caveat — with zero priming from you.
- **minimal** → returns the same bare `null`. An unprimed agent typically concludes *"this building has no energy label"* — wrong, and the exact misread the rich tier's alert exists to prevent.

Same registers, same building (it's the Rijksmuseum, bouwjaar 1885) — the only difference is the metadata layer.

**2 — Domain reasoning without priming (rich):**

> *"Get the building profile for 3543AR 1 and tell me whether it's on track for Paris Proof 2040."*

The tool's `INTERPRETATION` block and `alerts[]` carry the Paris Proof thresholds and label semantics, so the agent reasons about Dutch energy regulation it was never separately taught.

**3 — Self-describing visualization (rich):**

> *"Look up the building profiles for 1071XX 1 and 3543AR 1, then render a table comparing bouwjaar, energy label, and floor area."*

On **rich**, the agent picks `render_table` and its cell formatters straight from the schema — no wrapper logic. On **minimal**, the same app exists but with a one-sentence description and no guidance, so the agent has to guess the payload shape and formatting unaided — the same ablation, applied to the app config.

## Talks

This repo accompanies talks on embedding domain knowledge in MCP tool descriptions:

- **Most MCP servers are empty** — [AGNTCon + MCPCon Europe 2026](https://agntconmcpconeu26.sched.com/event/2VmKE) · Amsterdam · Sep 17–18 2026
- **Domain knowledge belongs in the MCP server** — [VibeKode Netherlands 2026](https://vibekode.it/agentic-engineering/domain-knowledge-belongs-in-the-mcp-server/) · Utrecht · Oct 7 2026
- **Adoption is the hard part: six months of MCP in production at an HVAC company** — [Update Conference Prague 2026](https://prague.updateconference.net/en/2026/schedule/adoption-is-the-hard-part-six-months-of-mcp-in-production-at-an-hvac-company) · Prague · Nov 12–13 2026

Full, up-to-date list: [davidgolverdingen.nl/en/talks](https://davidgolverdingen.nl/en/talks).

## Why two endpoints — the ablation

To *show* the strategy pays off, you need the contrast. Both endpoints run the same tool name over the same data path; only the metadata wrapper changes:

| | **rich** (`/mcp`) | **minimal** (`/mcpMinimal`) |
|---|---|---|
| Tool description | ~5,100 chars (`RETURNS` / `WHEN TO USE` / `QUERY STRATEGY` / `INTERPRETATION` / `ALERTS`) | one sentence (~50 chars) |
| Input schema | 4 fields, each `.describe()`d, format-validated | 2 bare fields, no descriptions, no validation |
| Output schema | full Zod schema (~45 described fields) + `structuredContent` | none — text-only result |
| Curated `alerts[]` | yes (`generateAlerts`) | none |
| Render apps (`render_chart` / `render_table` / `render_map`) | full self-describing schemas + decision guidance | same apps, stripped to a one-sentence description each |

**The data returned is identical.** Only the layer that tells the model *how to read it* is removed — which isolates the paper's claim.

The failure it prevents is concrete: a residential *Nader Voorschrift* label returns `co2_emissie` and `berekend_energieverbruik` as **MJ-totals for the whole building** (values of 80,000–100,000), not kWh/m². The rich tier flags this in `alerts[]`; the minimal tier hands over the bare number, so an unprimed agent benchmarks it as a per-m² intensity and is wrong by orders of magnitude.

(And remember: even this "rich" tier is a condensed abstraction — the production system's `alerts[]` and schema depth go well beyond what's shown here.)

### See it in the source

The metadata layer is just code — read the exact pieces the agent consumes, and the ablated twin that drops them:

- **Rich tool description** — the `RETURNS` / `WHEN TO USE` / `QUERY STRATEGY` / `INTERPRETATION` / `ALERTS` prose the model reads before it ever calls the tool: [`get-building-profile.ts` L23–64](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-building-profile.ts#L23-L64)
- **Input + output schemas** — a `.describe()` on every field, ~45 output fields: [`get-building-profile.ts` L68–206](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-building-profile.ts#L68-L206)
- **Server-side interpretation** — the `alerts[]` rules (regulation eras, Paris Proof thresholds, the Nader Voorschrift MJ-unit trap): [`generate-alerts.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/generate-alerts.ts)
- **The minimal twin** — the whole ablated tool, ~60 lines, none of the above: [`get-building-profile-minimal.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/get-building-profile-minimal.ts)

## Two levels, one strategy

The demo applies the same metadata principle in **two places at once**:

**Level 1 — domain tool.** An agent calls `get_building_profile`, reads the `alerts[]` array, and formulates a follow-up from the curated advisory text — no separate priming on Dutch energy regulation:

```
> get_building_profile({ postcode: "1071XX", huisnummer: 1 })
  ... → alerts: ["Pre-Bouwbesluit 1992 — likely limited insulation.",
                  "No registered energy label found in EP-Online."]

> "Given the pre-1992 era and the lack of a registered label, what's the next step?"
```

**Level 2 — self-describing app config.** The same agent then picks an appropriate visualisation. The chart-type metadata tells it sankey is for flows, treemap for hierarchical area shares, bar for category comparison — no wrapper logic ([see the `type` REFUSE rules](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/tools/render-chart.ts#L162-L200)):

```
> Agent looks at three buildings' data and chooses render_chart({ type: 'bar', ... })
  because the schema's REFUSE rules say sankey requires flows (this data has none).
```

Same principle powers `get_building_profile`'s output schema and `render_chart`'s input schema: in one the AI-generated output is domain data, in the other it's UI configuration.

## What's inside

- `get_building_profile` — rich-domain tool combining BAG (Kadaster) + EP-Online (RVO)
- `render_chart` — 14 chart types via Chart.js with annotations
- `render_table` — TanStack Table with badge/icon/cell formatters
- `render_map` — Leaflet maps with markers (car, building, project, pin)
- `fetch_image` — server-side image proxy with SSRF protection (used by `render_table` when the iframe CSP blocks `img-src`)

## Run it locally

```sh
git clone https://github.com/DaveGold/mcp-metadata-demo
cd mcp-metadata-demo
npm install
cp .env.example .env.local  # then add your EP_ONLINE_API_KEY
npm run build
npm run inspect          # rich tier in the MCP Inspector
npm run inspect:minimal  # the minimal tier — same tool, metadata stripped
```

Or wire the stdio binary into your `.mcp.json` (Claude Code) / Claude Desktop config:

```json
{
  "mcpServers": {
    "metadata-demo": {
      "command": "node",
      "args": ["--env-file=.env.local", "/absolute/path/to/dist/stdio.js"]
    }
  }
}
```

The stdio server honours `MCP_VARIANT=minimal` to serve the stripped tier locally.

## Architecture

Five tools, three external APIs, three transports, one MCP Apps UI pipeline — and two metadata tiers selected by a single `variant` flag on the `createServer()` factory.

| Tool | Kind | What it does |
|---|---|---|
| `get_building_profile` | Rich-domain data tool | Looks up a Dutch address, fuses BAG + EP-Online, returns a structured profile with curated `alerts[]` |
| `render_chart` | MCP App | Renders 14 chart types via Chart.js inline in the chat |
| `render_table` | MCP App | Renders an interactive TanStack table with cell formatters |
| `render_map` | MCP App | Renders a Leaflet map with markers |
| `fetch_image` | App-internal helper | Server-side image proxy with SSRF protection; only called by the `render_table` UI |

### Transports & tiers

Single `createServer({ variant })` factory in [src/server.ts](src/server.ts), exposed through three entrypoints — tool registration lives in exactly one place:

- **stdio** ([src/stdio.ts](src/stdio.ts)) — default for Claude Desktop / Code / Inspector. JSON-RPC over stdin/stdout, no network, no ports. `MCP_VARIANT` selects the tier.
- **Local HTTP** ([src/http.ts](src/http.ts)) — Streamable-HTTP bound to `127.0.0.1` for browser-based testing, no middleware.
- **Cloud Functions** ([src/functions.ts](src/functions.ts)) — two Firebase Cloud Functions v2 (`mcp` = rich, `mcpMinimal` = minimal) wrapping the same HTTP app with `hosted: true`, which mounts request-logging, daily-cap, and rate-limit middleware. EP-Online key injected from Secret Manager.

### Layers

- **Tools** (`src/tools/`) — each tool's `description` and Zod `inputSchema`/`outputSchema` (`.describe()` on every field) carry the metadata that drives agent reasoning. `get-building-profile.ts` encodes `RETURNS` / `WHEN TO USE` / `INTERPRETATION` / `ALERTS`; the render tools register a `ui://` resource + tool pair and return `structuredContent` for the iframe. `get-building-profile-minimal.ts` is the ablated twin — same data path (`resolveBuildingProfile`), none of the metadata.
- **Clients** (`src/clients/`) — one class per upstream, each owning its URL, auth, timeout, and Zod-validated response parsing, so upstream wire-format drift surfaces here rather than silently downstream. `BagClient` is auth-free; `EpOnlineClient` needs an API key.
- **Domain** (`src/domain/`) — pure functions: `buildProfile` (raw registers → `BuildingProfile`), `selectBestLabel`, and `generateAlerts` (regulation eras, Paris Proof 2040 thresholds, BENG, heat-pump suitability — knowledge moved server-side, to where the data lives).
- **Logger** (`src/logger.ts`) — stderr-only structured JSON. **Never** writes to stdout, which stdio MCP framing owns; a stray `console.log` would corrupt the JSON-RPC stream.

### How an MCP app gets to the client

A factual explainer of how a chart, table, or map actually appears in the chat.

**The protocol**: MCP Apps delivers UI as a `ui://` resource. The host client (Claude Desktop, claude.ai) receives a complete HTML string and renders it in an iframe. The resource exposes `_meta.ui` for declarations like the CSP allow-list (`resourceDomains`), which is how `render_map` reaches `tile.openstreetmap.org` even though the host CSP blocks external resources by default.

**The constraint that drives the stack**: one HTML string means all JS and CSS must be inlined. No `<script src>` to a CDN, no separate stylesheets, no runtime chunk loading.

**The stack**:

- **Vite** bundler with **`vite-plugin-singlefile`** inlines every asset into one `index.html`. Output: one file per app — `build/ui/chart.html`, `build/ui/table.html`, `build/ui/map.html`. The server reads that file at startup and registers it with `registerAppResource(...)`.
- **Angular** (via `@analogjs/vite-plugin-angular`) so the framework slots into the same Vite pipeline. The choice of Angular is incidental, not required — React, Svelte, or vanilla TS would work the same way; Angular fits because the table renderer (cell formatters with badges, icons, sparklines) benefits from a strongly-typed component model.
- **Per-app entries** — `ui/apps/{chart,table,map}/index.html` are discovered by `scripts/build-ui.js` and built independently. One broken app doesn't block the others; each gets only the libraries it needs (Chart.js for chart, Leaflet for map, TanStack Table for table) instead of every library in every bundle.

**The data bridge**: the tool handler returns `structuredContent` (the chart config, table rows, map markers) alongside `_meta.ui.resourceUri` pointing at the HTML. The MCP Apps SDK exposes that `structuredContent` to the iframe as `window.mcpAppData`. The Angular component reads it at bootstrap and renders. No follow-up fetch from iframe to server, no runtime API — one tool response is everything.

The result: the same metadata principle that powers `get_building_profile`'s output schema also powers `render_chart`'s input schema. Both are AI-generated from the schema; in one the output is domain data, in the other it's UI configuration. The Angular-plus-Vite-single-file part is just how that UI configuration becomes pixels.

### External APIs

| API | Auth | Used by |
|---|---|---|
| PDOK Locatieserver | none | `BagClient.findAddress` |
| BAG OGC v2 | none | `BagClient.getVerblijfsobject` / `getPand` |
| EP-Online V5 | API key | `EpOnlineClient` (per-key rate limits apply) |
| OpenStreetMap tiles | none | `render_map` iframe, via CSP `resourceDomains` allow-list |
| Arbitrary image URLs | none | user-supplied via `render_table`, validated through the `fetch_image` SSRF guard |

### Non-goals

- **Authentication.** The hosted endpoints are intentionally public — add an auth proxy upstream if you fork it for a private use case.
- **Persistence.** Tools are idempotent and stateless; the `fetch_image` cache is in-memory only.
- **Mocking framework.** Test stubs are hand-rolled object literals typed against the `*Like` `Pick<>` types.

## Deploy your own copy

The hosted endpoints run as Firebase Cloud Functions. To deploy your own:

1. Create a Firebase project + upgrade to Blaze (pay-as-you-go) — Cloud Functions v2 + Secret Manager require it
2. `firebase login` and update [.firebaserc](.firebaserc) with your project ID
3. `npm run deploy:setup-secret` — paste your EP-Online API key (get one at https://www.ep-online.nl)
4. `npm run deploy` — ships **both** functions (`mcp` and `mcpMinimal`)

## Language policy

Code, docs, and agent-facing tool descriptions are English. Field names mirror their Dutch upstream APIs (BAG, EP-Online) — `huisnummer`, `bouwjaar`, `oppervlakte_m2`, `gebruiksdoel`, `energielabel`. Regulatory references (Bouwbesluit, NTA 8800, BENG, Paris Proof) keep their Dutch names; they have no English equivalents.

## Logging

The hosted endpoints log request metadata (IP, User-Agent, tool name, duration) to Cloud Logging for usage analytics and abuse prevention. Retention is 30 days (Cloud Logging default). Legal basis: legitimate interest. Contact via the GitHub issues tracker if you'd like your data scrubbed.

## Author

Built by **David Golverdingen** — Senior Engineer & MCP Architect — as a companion to *[The Missing Layer](https://davidgolverdingen.nl/en/the-missing-layer)*.

[Website](https://davidgolverdingen.nl/en) · [LinkedIn](https://www.linkedin.com/in/davidgolverdingen/) · [GitHub](https://github.com/DaveGold)

## License

MIT
