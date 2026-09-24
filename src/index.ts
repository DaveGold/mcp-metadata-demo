/**
 * Package entry — re-exports the Firebase Function and the createServer
 * factory.
 *
 * Firebase Cloud Functions v2 reads this file (via `main` in package.json) to
 * find the HTTPS functions, so EVERY deployable function must be named here —
 * adding one to functions.ts alone leaves it invisible to `firebase deploy`.
 * Library users importing this package get `createServer` for embedding the
 * MCP server in their own host.
 *
 * For the stdio binary, see src/stdio.ts (mapped via `bin`).
 */

export {
  mcp,
  mcpMinimal,
  mcpSchema,
  mcpInline,
  mcpInlineRecipe,
  mcpInlineOneline,
  mcpInlineConditional,
  mcpInlineFact,
  mcpInlineInstruction,
  mcpWordsRecipe,
  mcpWords,
  mcpOpaque,
  mcpOpaqueWords,
  mcpGuidanceRecipe,
  mcpBest,
} from './functions.js';
export { createServer } from './server.js';
