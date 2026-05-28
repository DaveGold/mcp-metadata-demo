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
