# Scaffolding — wiring a new server

Whatever your hosting story is (one Firebase Function per server, a single long-running process, a
multi-tenant monorepo), you write the same handful of pieces: a client (if the API needs one), a
server file, tools, and the metadata. This file describes the portable parts; if your codebase
already has shared infrastructure (auth, a logging store, RBAC), reuse it — this skill doesn't
prescribe a specific shape for that, since it varies enormously by codebase.

---

## Directory

```
src/<name>/
  <name>-client.ts        # auth (if any) + token cache + HTTP — skip if the API is public/keyless
  server.ts                # McpServer + instructions + tool registration
  tools/
    get-<entity>.ts         # one file per tool
  types/
    <entity>.ts             # row interfaces
```

(This companion repo keeps it even flatter — one `src/tools/` directory, one `src/server.ts` with a
`variant` flag instead of one file per environment. See
[server.ts](../../../../src/server.ts) for a small, complete example of the whole shape.)

## 1. Client

Singleton — the token cache survives across requests within one running instance, if the runtime
supports that. Config (base URL, account/tenant IDs) is a plain const; **only secrets** come from
wherever you keep secrets (a secret manager, env vars).

```ts
const CONFIG = { baseUrl: 'https://api.example.com', accountId: '12345' };

export class MyClient {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  async get<T>(path: string): Promise<T> {
    await this.ensureToken();
    const res = await fetch(`${CONFIG.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;
    // exchange a secret → token; set expiry with a buffer (e.g. 5 minutes)
  }
}
```

Not every tool needs a client at all — a public, keyless API (this repo's
[get-weather-context.ts](../../../../src/tools/get-weather-context.ts) calls Open-Meteo directly
with plain `fetch()`, no client class, no auth) is the simplest case and shouldn't be forced into a
client-class shape it doesn't need.

**Live limits over hardcoded constants.** If the vendor exposes a limits endpoint, fetch and cache
it (e.g. for an hour) and reference it in validation. A hardcoded `MAX_DATE_RANGE_DAYS = 31` against
a real limit of 100 rejects queries the API would have served.

## 2. `server.ts`

```ts
const VERSION = '0.1.0';

let clientInstance: MyClient | null = null;
function getClient(): MyClient {
  if (!clientInstance) clientInstance = new MyClient();
  return clientInstance;
}

export function createServer(): McpServer {
  const client = getClient();
  const server = new McpServer({ name: '<server-name>', version: VERSION }, { instructions: INSTRUCTIONS });

  server.server.onerror = (error) => {
    logger.error('mcp.protocol_error', { error: error instanceof Error ? error.message : String(error) });
  };

  registerMyTool(server, client);
  return server;
}
```

Instructions block structure is in `metadata.md`. If you have a dedicated feedback tool that lives
on a shared/utility server rather than on every server, point agents at it from here rather than
re-registering it per server.

## 3. Deploy

However you deploy — a serverless function, a container, a long-running process — the same rules
apply:

```bash
# one-time, if the API needs a secret
<your secret manager> set MY_API_SECRET

npm run build
npm run deploy:<alias>
```

Verify the deploy actually took by hitting the server directly (a `tools/list` call, or a
well-known health/discovery endpoint if your transport has one).

**CI/CD, if you have it.** Make sure a push to your main branch actually builds and deploys, and
that removing a function/server export is followed by an explicit delete against production —
depending on your hosting platform, an orphaned deployed function can make the next repo-wide
deploy abort, blocking every server's deploy, not just the one you changed.

## 4. Connecting for testing

```jsonc
// An MCP client configuration file; Claude Code uses .mcp.json at the repo root.
{ "mcpServers": { "<name>": { "url": "https://<your-deployed-url>" } } }
```

Or add the server through the connector/configuration mechanism your target client supports. Test
in a fresh context after a deploy: clients may cache the tool catalog, and the refresh behaviour is
client-specific.

For local, no-deploy iteration, the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
works against a local stdio or HTTP server with no custom UI needed (this repo: `npm run inspect`).

## 5. Docs to keep updated

- **A project agent guide** (`AGENTS.md`, `CLAUDE.md`, or equivalent) — server list, build & deploy
  commands, deployed URLs, code-organization tree, and key technical details (auth, secrets,
  timeout, quirks).
- **`docs/<name>-api-findings.md`** — the discovery log (structure in `discovery.md`).
- A raw-request collection (Bruno, Postman, `.http` files) in `api/<name>/` if you want reproducible
  raw calls outside the MCP layer — optional, but useful when debugging a vendor issue.

## 6. Tests

Co-locate as `<file>.test.ts`. Worth testing, in priority order:

1. The client's auth/token-cache logic and error mapping, if it has one.
2. `transform` and `summarize` — the domain logic, including each empirically-discovered quirk
   (sentinel normalisation, counter detection, DST bucketing). These are exactly what a vendor fix
   will silently change.
3. Output-schema conformance on a realistic fixture row.
4. Filter/param building, if the API has a non-trivial protocol.

## Bundled lookup data

For static-ish cross-system lookup tables, a bundled JSON file shipped with the deploy beats a
database lookup: no cold-start read, atomic with the deploy, source-controlled, no sync script.
Caveats: make sure your build/deploy step actually copies the file, and accept that changes need a
redeploy — only suitable when the data changes rarely (monthly or less).

## MCP App tools

Interactive tools (charts, tables, forms, games) register differently from plain data tools and
ship a small built UI alongside the tool registration. See
[render-chart.ts](../../../../src/tools/render-chart.ts) in this repo for a complete, working
example — the render tool itself does not fetch data; the agent fetches data elsewhere and passes
reshaped data in.
