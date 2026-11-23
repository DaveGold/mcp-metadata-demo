#!/usr/bin/env node
/**
 * stdio entrypoint — the default way to run this server.
 *
 * This is what Claude Desktop, Claude Code, VS Code Copilot, and MCP Inspector
 * all expect when launching a local MCP server. The protocol is framed over
 * stdin/stdout; stderr is free for diagnostics.
 *
 * Start: `node dist/index.js` (or `mcp-metadata-demo` after `npm install`).
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer, type ServerVariant } from './server.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  // MCP_VARIANT=minimal serves the metadata-stripped tier (for the ablation demo).
  const rawVariant = process.env.MCP_VARIANT;
  const variant: ServerVariant = (
    ['minimal', 'schema', 'inline', 'inline-recipe', 'words', 'words-recipe', 'opaque', 'opaque-words', 'best'] as const
  ).includes(rawVariant as never)
    ? (rawVariant as ServerVariant)
    : 'rich';
  // The opening message picks the era: 2026-07-28 (server/discover) or a 2025-era initialize,
  // which is served exactly as a hand-wired stdio server serves it (legacy: 'serve', the default).
  serveStdio(() => createServer({ variant }), {
    onerror: (error) => logger.error('stdio.error', { error: error.message }),
  });
  logger.info('server.started', { transport: 'stdio', variant });
}

main().catch((error) => {
  logger.error('server.fatal', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
