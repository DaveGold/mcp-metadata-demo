# mcp-metadata-demo

> 📄 **Read the paper**: [*The Missing Layer*](https://davidgolverdingen.nl/en/the-missing-layer) — the metadata strategy this repo demonstrates.

A working demo of the metadata strategy described in the paper. It applies that strategy in **two places at once**:

- **Rich-domain MCP server** — `get_building_profile` shows how dense tool metadata (input/output schemas, curated `alerts[]`, interpretation guidance) lets an AI reason about a domain (Dutch building data via BAG + EP-Online) without external priming.
- **MCP apps with self-describing config** — `render_chart`, `render_table`, `render_map` apply the *same* approach to UI configuration. The agent doesn't just call `render_chart` — it knows from the schema which chart type fits the data, which axes to bind, when to use a stacked variant, which cell formatters apply, what each badge color means.

When tool metadata is rich enough, the AI doesn't need a wrapper agent telling it *how* to use the tool — the tool tells the AI itself.

> **Note** — This is a distilled extraction of a production MCP system I built in industry. The domain enrichment shown here (the `alerts[]` rules, the chart/table/map metadata) is deliberately lighter than the original: enough to demonstrate the strategy, not the full production depth.

## Two levels, one strategy

**Level 1 — domain tool**: an agent calls `get_building_profile`, reads the `alerts[]` array, and formulates a follow-up question from the curated advisory text:

```
> get_building_profile({ postcode: "1071XX", huisnummer: 1 })
  ... → alerts: ["Pre-Bouwbesluit 1992 — likely limited insulation.",
                  "EP-1 above Paris Proof 2040 target (70 kWh/m² for offices).",
                  "Possibly Label-C relevant — verify whether office share >50% and area >100m²."]

> "Given the Pre-1992 era and Label-C exposure, what would the next investigation step look like?"
```

The agent didn't need separate priming on Dutch energy regulation — the tool's metadata supplied it.

**Level 2 — self-describing app config**: the same agent then picks an appropriate visualisation for the data it has. The chart-type metadata tells it sankey is for flows, treemap is for hierarchical area shares, bar is for category comparison. No wrapper logic needed.

```
> Agent looks at three buildings' EP-1 data and chooses render_chart({ type: 'bar', ... })
  because the schema's REFUSE rules say sankey requires flows (this data has none).
```

## What's inside

- `get_building_profile` — rich-domain tool combining BAG (Kadaster) + EP-Online (RVO)
- `render_chart` — 14 chart types via Chart.js with annotations
- `render_table` — TanStack Table with badge/icon/cell formatters
- `render_map` — Leaflet maps with markers (car, building, project, pin)
- `fetch_image` — server-side image proxy with SSRF protection (used by `render_table` when the iframe CSP blocks `img-src`)

## Quick start (local stdio)

```sh
git clone https://github.com/DaveGold/mcp-metadata-demo
cd mcp-metadata-demo
npm install
cp .env.example .env.local  # then add your EP_ONLINE_API_KEY
npm run build
npm run inspect       # opens MCP Inspector to test interactively
```

Add to your `.mcp.json` (Claude Code) or Claude Desktop config:

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

## Try the hosted demo

> 🌐 **Hosted demo**
>
> Shared endpoint, rate-limited. For sustained heavy use, deploy your own copy.

Add this to your `.mcp.json` (Claude Code):

```json
{
  "mcpServers": {
    "metadata-demo": {
      "url": "https://mcp-jtc4p3l6nq-ez.a.run.app"
    }
  }
}
```

## Architecture

Five tools, three external APIs, three transports, one MCP Apps UI pipeline.

| Tool | Kind | What it does |
|---|---|---|
| `get_building_profile` | Rich-domain data tool | Looks up a Dutch address, fuses BAG + EP-Online, returns a structured profile with curated `alerts[]` |
| `render_chart` | MCP App | Renders 14 chart types via Chart.js inline in the chat |
| `render_table` | MCP App | Renders an interactive TanStack table with cell formatters |
| `render_map` | MCP App | Renders a Leaflet map with markers |
| `fetch_image` | App-internal helper | Server-side image proxy with SSRF protection; only called by the `render_table` UI |

### Transports

Single `createServer()` factory in [src/server.ts](src/server.ts), exposed through three entrypoints — tool registration lives in exactly one place:

- **stdio** ([src/stdio.ts](src/stdio.ts)) — default for Claude Desktop / Code / Inspector. JSON-RPC over stdin/stdout, no network, no ports.
- **Local HTTP** ([src/http.ts](src/http.ts)) — Streamable-HTTP bound to `127.0.0.1` for browser-based testing, no middleware.
- **Cloud Function** ([src/functions.ts](src/functions.ts)) — Firebase Cloud Function v2 wrapping the same HTTP app with `hosted: true`, which mounts request-logging, daily-cap, and rate-limit middleware on `/mcp`. EP-Online key injected from Secret Manager.

### Layers

- **Tools** (`src/tools/`) — each tool's `description` and Zod `inputSchema`/`outputSchema` (`.describe()` on every field) carry the metadata that drives agent reasoning. `get-building-profile.ts` encodes `RETURNS` / `WHEN TO USE` / `INTERPRETATION` / `ALERTS`; the render tools register a `ui://` resource + tool pair and return `structuredContent` for the iframe.
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

- **Authentication.** The hosted endpoint is intentionally public — add an auth proxy upstream if you fork it for a private use case.
- **Persistence.** Tools are idempotent and stateless; the `fetch_image` cache is in-memory only.
- **Mocking framework.** Test stubs are hand-rolled object literals typed against the `*Like` `Pick<>` types.

## Language policy

Code, docs, and agent-facing tool descriptions are English. Field names mirror their Dutch upstream APIs (BAG, EP-Online) — `huisnummer`, `bouwjaar`, `oppervlakte_m2`, `gebruiksdoel`, `energielabel`. Regulatory references (Bouwbesluit, NTA 8800, BENG, Paris Proof) keep their Dutch names; they have no English equivalents.

## Deploy your own copy

The hosted endpoint runs as a Firebase Cloud Function. To deploy your own:

1. Create a Firebase project + upgrade to Blaze (pay-as-you-go) — Cloud Functions v2 + Secret Manager require it
2. `firebase login` and update [.firebaserc](.firebaserc) with your project ID
3. `npm run deploy:setup-secret` — paste your EP-Online API key (get one at https://www.ep-online.nl)
4. `npm run deploy`


## Logging

The hosted endpoint logs request metadata (IP, User-Agent, tool name, duration) to Cloud Logging for usage analytics and abuse prevention. Retention is 30 days (Cloud Logging default). Legal basis: legitimate interest. Contact via the GitHub issues tracker if you'd like your data scrubbed.

## Author

Built by [David Golverdingen](https://davidgolverdingen.nl/en) as a companion to the metadata-strategy paper.

## License

MIT
