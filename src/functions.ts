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

export const mcp = onRequest(
  {
    region: 'europe-west4',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 3,
    secrets: ['EP_ONLINE_API_KEY'],
    invoker: 'public',
  },
  createHttpApp({ hosted: true })
);
