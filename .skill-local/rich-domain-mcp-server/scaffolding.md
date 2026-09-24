# Local overlay — scaffolding

## Adding a variant to this repo

To build a new version of a tool next to the old one (the audit flow's step 6):

1. `src/tools/<tool>-<variant>.ts` — reuse the shared resolver/clients; never retype shared prose.
2. `src/server.ts` — add to `ServerVariant`, add a branch before the `rich` fall-through.
3. `src/functions.ts` + `src/index.ts` — export the Cloud Function (a missing re-export means
   `firebase deploy` never sees it).
4. `src/http.ts` + `src/stdio.ts` — `MCP_VARIANT` allow-lists; `package.json` `deploy` list.
5. `.mcp.json` entry and, for the eval, `.claude/agents/eval-<variant>.md` with only that arm's tools.
6. Deploy, then prove the arm is reachable and stamping its variant in the call log before any run.

The `best` variant is the worked example.
