/**
 * Firebase Cloud Functions entry — hosted demo endpoint.
 *
 * Single function exposing the MCP server over Streamable HTTP at the
 * Cloud Run URL Firebase assigns. No auth: the endpoint is public so
 * anyone can paste the URL into their MCP client and try the demo.
 *
 * EP-Online API key flows in via Firebase secret `EP_ONLINE_API_KEY`,
 * which Cloud Functions exposes as process.env at runtime — same code
 * path as local `.env`.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { createHttpApp } from './http.js';

const functionOptions = {
  region: 'europe-west4',
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  maxInstances: 3,
  secrets: ['EP_ONLINE_API_KEY'],
  invoker: 'public',
};

/** Rich tier — the full metadata strategy. */
export const mcp = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'rich' }));

/**
 * Minimal tier — the "missing layer" ablation. Same data, metadata stripped
 * (one-sentence description, no schema, no alerts). Deployed alongside `mcp`
 * so the two endpoints can be compared directly.
 */
export const mcpMinimal = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'minimal' }));

/**
 * Words tier — arm B of the ablation. Identical prose and schemas to `mcp`, but
 * no computed alerts, so A→B measures what the words buy and B→C measures what
 * the capability adds.
 */
export const mcpWords = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'words' }));

/**
 * Opaque tiers — A' and B'. Same data, field names stripped to the terse codes a
 * legacy register would emit. `mcpOpaque` carries a one-sentence description;
 * `mcpOpaqueWords` adds the interpretation guidance keyed to those codes, and
 * differs in nothing else. The pair isolates what the guidance buys once the
 * self-describing field names are no longer doing the work for it.
 */
export const mcpOpaque = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'opaque' }));
export const mcpOpaqueWords = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'opaque-words' }));
