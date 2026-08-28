/**
 * Package entry — re-exports the Firebase Function and the createServer
 * factory.
 *
 * Firebase Cloud Functions v2 reads this file (via `main` in package.json)
 * to find the `mcp` HTTPS function. Library users importing this package
 * get `createServer` for embedding the MCP server in their own host.
 *
 * For the stdio binary, see src/stdio.ts (mapped via `bin`).
 */

export { mcp, mcpMinimal } from './functions.js';
export { createServer } from './server.js';
