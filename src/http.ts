#!/usr/bin/env node
/**
 * Streamable-HTTP entrypoint.
 *
 * Two modes:
 *   - Local dev: bind to 127.0.0.1, no protection middleware. Run with
 *     `node dist/http.js`.
 *   - Cloud deploy: import `createHttpApp()` from src/functions.ts, wrap
 *     with Firebase Functions v2 onRequest. Daily-cap + rate-limit +
 *     request-logging middleware are active there.
 *
 * The split lets local dev stay zero-config while the hosted demo gets
 * the protection layers described in docs/RUNBOOK.md.
 */

import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import { createMcpHandler, isLegacyRequest } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { createServer, type ServerVariant } from './server.js';
import { logger } from './logger.js';
import { requestContext } from './shared/log-context.js';
import { dailyCap } from './middleware/daily-cap.js';
import { rateLimitMcp } from './middleware/rate-limit.js';
import { requestLog } from './middleware/request-log.js';

export interface CreateHttpAppOptions {
  /** When true, mount daily-cap + rate-limit + request-logging on `/mcp`. */
  hosted?: boolean;
  /** Metadata tier this app serves. Default 'rich'. */
  variant?: ServerVariant;
}

export function createHttpApp(options: CreateHttpAppOptions = {}): Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));

  if (options.hosted) {
    app.use(requestLog);
  }

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  const mcpMiddleware = options.hosted ? [dailyCap, rateLimitMcp] : [];
  const variant = options.variant ?? 'rich';
  const onerror = (error: Error): void => {
    logger.error('http.handler_error', { error: error.message });
  };

  // Protocol 2026-07-28: every request carries its own envelope, served by the SDK's
  // per-request entry (its default 'auto' response mode answers in JSON, as no tool here emits
  // mid-call notifications). 2025-era requests are routed to the leg below instead (legacy:
  // 'reject' here), because the SDK's built-in stateless fallback cannot answer in JSON.
  const serveModern = toNodeHandler(
    createMcpHandler(() => createServer({ variant }), { legacy: 'reject', onerror }),
    {
      onerror,
    },
  );

  // Protocol 2025-11-25 and earlier: stateless, one fresh McpServer + transport per request,
  // JSON responses — the wiring every eval and host-delivery measurement in this repo ran on.
  async function serveLegacy(req: Request, res: Response): Promise<void> {
    const server = createServer({ variant });
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  async function handleMcpRequest(req: Request, res: Response): Promise<void> {
    // Open a request context so tool handlers can stamp `tool.invoked` audit
    // rows with a session id (reusing the request-log requestId when present)
    // and the runtime environment. K_SERVICE is set by Cloud Run / Functions.
    const sessionId = req.requestId ?? randomUUID();
    const environment = process.env.K_SERVICE ? 'cloud' : 'local';

    await requestContext.run({ sessionId, environment, variant }, async () => {
      try {
        if (await isLegacyRequest(await toWebRequest(req, req.body), req.body)) {
          await serveLegacy(req, res);
        } else {
          await serveModern(req, res, req.body);
        }
      } catch (error) {
        logger.error('http.handler_error', {
          requestId: req.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });
  }

  // Mount on both '/' and '/mcp' so:
  //   - Cloud Function URL `https://.../mcp` (Firebase strips the function-name
  //     prefix, Express sees '/') routes correctly.
  //   - Local dev URL `http://127.0.0.1:3000/mcp` keeps the conventional path.
  app.post('/', ...mcpMiddleware, handleMcpRequest);
  app.post('/mcp', ...mcpMiddleware, handleMcpRequest);

  // Stateless, no SSE stream and no sessions: the spec says GET and DELETE MUST
  // then answer 405, not Express's default 404.
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res
      .set('Allow', 'POST')
      .status(405)
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
  };
  app.get(['/', '/mcp'], methodNotAllowed);
  app.delete(['/', '/mcp'], methodNotAllowed);

  return app;
}

// ── Local-dev startup (only when invoked directly) ──────────────────────────

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const PORT = Number(process.env.PORT ?? 3000);
  const HOST = process.env.HOST ?? '127.0.0.1';
  const rawVariant = process.env.MCP_VARIANT;
  const variant: ServerVariant = (
    [
      'minimal',
      'schema',
      'inline',
      'inline-recipe',
      'inline-conditional',
      'words',
      'words-recipe',
      'opaque',
      'opaque-words',
      'guidance-recipe',
      'best',
    ] as const
  ).includes(rawVariant as never)
    ? (rawVariant as ServerVariant)
    : 'rich';

  const app = createHttpApp({ hosted: false, variant });
  app.listen(PORT, HOST, () => {
    logger.info('server.started', { transport: 'http', host: HOST, port: PORT, variant });
    process.stderr.write(
      `\nmcp-metadata-demo (${variant}) listening on http://${HOST}:${PORT}/mcp\n` +
        `⚠️  No auth — keep this bound to localhost.\n\n`,
    );
  });
}
