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

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, type ServerVariant } from './server.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  // MCP_VARIANT=minimal serves the metadata-stripped tier (for the ablation demo).
  const variant: ServerVariant = process.env.MCP_VARIANT === 'minimal' ? 'minimal' : 'rich';
  const server = createServer({ variant });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('server.started', { transport: 'stdio', variant });
}

main().catch((error) => {
  logger.error('server.fatal', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
