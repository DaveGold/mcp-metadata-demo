# Running, architecture and deployment

## Run it locally

```sh
git clone https://github.com/DaveGold/mcp-metadata-demo
cd mcp-metadata-demo
npm install
cp .env.example .env.local  # then add your EP_ONLINE_API_KEY
npm run build
npm run inspect          # rich tier in the MCP Inspector
npm run inspect:minimal  # the thin tier — same tool, metadata stripped
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

The stdio server honours `MCP_VARIANT` to serve another tier locally: `minimal` (thin), `best`,
or one of the eval arms listed in [src/stdio.ts](../src/stdio.ts). Anything else serves `rich`.

## Architecture

Seven tools, four external APIs, three transports, one MCP Apps UI pipeline — and every tier
selected by a single `variant` flag on the `createServer()` factory.

| Tool | Kind |
|---|---|
| `get_building_profile` | Rich-domain data tool: BAG (Kadaster) + EP-Online (RVO) for one Dutch address |
| `get_weather_context` | Rich-domain data tool: daily weather + degree-day/solar metrics (Open-Meteo); Select and summaries |
| `get_tool_call_log` | Introspection: reads back recent calls and their `queryIntent` |
| `render_chart` | MCP App |
| `render_table` | MCP App |
| `render_map` | MCP App |
| `fetch_image` | App-internal helper (SSRF-guarded image proxy) |

### Transports & tiers

Single `createServer({ variant })` factory in [src/server.ts](../src/server.ts), exposed through
three entrypoints — tool registration lives in exactly one place:

- **stdio** ([src/stdio.ts](../src/stdio.ts)) — default for Claude Desktop / Code / Inspector.
  JSON-RPC over stdin/stdout, no network, no ports. `MCP_VARIANT` selects the tier.
- **Local HTTP** ([src/http.ts](../src/http.ts)) — Streamable-HTTP bound to `127.0.0.1` for
  browser-based testing, no middleware.
- **Cloud Functions** ([src/functions.ts](../src/functions.ts)) — one Firebase Cloud Function v2 per
  tier (`mcp` = rich, `mcpMinimal` = thin, `mcpBest` = best, plus the eval arms) wrapping the same
  HTTP app with `hosted: true`, which mounts request-logging, daily-cap, and rate-limit middleware.
  EP-Online key injected from Secret Manager.

### Layers

- **Tools** (`src/tools/`) — each tool's `description` and Zod `inputSchema` (`.describe()` on
  every field) carry the metadata that drives agent reasoning; `outputSchema` is deliberately
  **shape-only** — it validates `structuredContent` and drives UI rendering, but the model never
  reads a single `.describe()` on an output field. In `best`, output-field meaning lives in the
  field names and the response's `interpretation`; in `rich`, in the description (see
  [`reference-implementation.md`](reference-implementation.md)). The render tools register a
  `ui://` resource + tool pair and return `structuredContent` for the iframe
  ([`mcp-apps.md`](mcp-apps.md)). `get-building-profile-minimal.ts` is the ablated twin — same
  data path (`resolveBuildingProfile`), none of the metadata.
- **Clients** (`src/clients/`) — one class per upstream, each owning its URL, auth, timeout, and
  Zod-validated response parsing, so upstream wire-format drift surfaces here rather than silently
  downstream. `BagClient` is auth-free; `EpOnlineClient` needs an API key.
- **Domain** (`src/domain/`) — pure functions: `buildProfile` (raw registers → `BuildingProfile`),
  `selectBestLabel`, and `generateAlerts` (regulation eras, BENG, heat-pump suitability,
  overheating — knowledge moved server-side, to where the data lives); `best` uses a rule registry
  instead, `best-rules.ts`.
- **Logger** (`src/logger.ts`) — stderr-only structured JSON. **Never** writes to stdout, which
  stdio MCP framing owns; a stray `console.log` would corrupt the JSON-RPC stream.

### External APIs

| API | Auth | Used by |
|---|---|---|
| PDOK Locatieserver | none | `BagClient.findAddress` |
| BAG OGC v2 | none | `BagClient.getVerblijfsobject` / `getPand` |
| EP-Online V5 | API key | `EpOnlineClient` (per-key rate limits apply) |
| Open-Meteo | none | `get_weather_context` (daily weather + degree-day/solar metrics) |
| OpenStreetMap tiles | none | `render_map` iframe, via CSP `resourceDomains` allow-list |
| Arbitrary image URLs | none | user-supplied via `render_table`, validated through the `fetch_image` SSRF guard |

### Non-goals

- **Authentication.** The hosted endpoints are intentionally public — add an auth proxy upstream if
  you fork it for a private use case.
- **Persistence.** Tools are idempotent and stateless apart from the call log; the `fetch_image`
  cache is in-memory only.
- **Mocking framework.** Test stubs are hand-rolled object literals typed against the `*Like`
  `Pick<>` types.

## Deploy your own copy

The hosted endpoints run as Firebase Cloud Functions. To deploy your own:

1. Create a Firebase project + upgrade to Blaze (pay-as-you-go) — Cloud Functions v2 + Secret
   Manager require it
2. `firebase login` and update [.firebaserc](../.firebaserc) with your project ID
3. `npm run deploy:setup-secret` — paste your EP-Online API key (get one at https://www.ep-online.nl)
4. Enable Firestore (native mode) once — console, or
   `firebase firestore:databases:create --location=<region>` — then `firebase deploy --only firestore`
   to push [`firestore.rules`](../firestore.rules)/[`firestore.indexes.json`](../firestore.indexes.json).
   This is what `get_tool_call_log` reads/writes to when deployed; no secret needed — Cloud
   Functions supplies credentials automatically.
5. `npm run deploy` — ships every tier: `mcp`, `mcpMinimal`, `mcpBest` and the eval arms. To ship
   only the three public tiers:
   `npm run build && firebase deploy --only functions:mcp,functions:mcpMinimal,functions:mcpBest`

## Language policy

Code, docs, and agent-facing tool descriptions are English. Field names mirror their Dutch upstream
APIs (BAG, EP-Online) — `huisnummer`, `bouwjaar`, `oppervlakte_m2`, `gebruiksdoel`,
`energielabel`. Regulatory references (Bouwbesluit, NTA 8800, BENG, Paris Proof) keep their Dutch
names; they have no English equivalents.

## Logging

The hosted endpoints log request metadata (IP, User-Agent, tool name, duration) to Cloud Logging
for usage analytics and abuse prevention. Retention is 30 days (Cloud Logging default). Legal
basis: legitimate interest.

Separately, every tool call is logged with its `queryIntent` — the free-text description of what
the call was for, which the caller supplies or which the server derives from other args (e.g. an
address, a chart title). No filter values or response data are stored (see
[`log-store.ts`](../src/shared/log-store.ts)). On the hosted endpoints this persists to Firestore
indefinitely and is readable back by anyone via `get_tool_call_log` — don't put anything in
`queryIntent` you wouldn't want another user of this shared demo to see. Contact via the GitHub
issues tracker if you'd like your data scrubbed.
