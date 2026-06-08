/**
 * Per-request structured logging for the hosted demo endpoint.
 *
 * Emits `http.request` on entry and `http.response` on completion, both
 * carrying a shared `requestId` so tool-call logs can be correlated back
 * to the originating request.
 *
 * Logs raw IP and User-Agent — Cloud Logging already captures these in
 * the platform layer (httpRequest.remoteIp / userAgent), so anonymising
 * here would only obscure our own queries without adding privacy. See
 * the README "Logging" section for the transparency note.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Pull the JSON-RPC method (and, for tools/call, the tool name) out of an
 * already-parsed request body so each MCP message is attributable at the HTTP
 * layer — `POST /` alone can't distinguish `initialize` from `tools/call`.
 *
 * Handles single messages and JSON-RPC batches (reports the first message's
 * method plus the batch size). Tolerant of non-object bodies (GET probes).
 */
function describeRpc(body: unknown): { rpcMethod?: string; tool?: string; batchSize?: number } {
  if (!body || typeof body !== 'object') return {};
  const batch = Array.isArray(body) ? body : null;
  const first = (batch ? batch[0] : body) as Record<string, unknown> | undefined;
  if (!first || typeof first !== 'object') return {};

  const rpcMethod = typeof first.method === 'string' ? first.method : undefined;
  let tool: string | undefined;
  if (rpcMethod === 'tools/call' && first.params && typeof first.params === 'object') {
    const name = (first.params as Record<string, unknown>).name;
    if (typeof name === 'string') tool = name;
  }

  return {
    ...(rpcMethod ? { rpcMethod } : {}),
    ...(tool ? { tool } : {}),
    ...(batch && batch.length > 1 ? { batchSize: batch.length } : {}),
  };
}

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  const startedAt = Date.now();
  const ua = (req.get('user-agent') ?? 'unknown').slice(0, 200);

  logger.info('http.request', {
    requestId,
    ip: req.ip,
    ua,
    method: req.method,
    path: req.path,
    ...describeRpc(req.body),
  });

  res.on('finish', () => {
    logger.info('http.response', {
      requestId,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
