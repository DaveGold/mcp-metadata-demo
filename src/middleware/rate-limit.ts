/**
 * Per-(IP, User-Agent) rate limit for the hosted demo endpoint.
 *
 * Compound key so an office NAT with mixed clients (Claude Desktop +
 * Claude Code + MCP Inspector) ends up in separate buckets. Same UA
 * across many users in one office is still grouped — that's the
 * unavoidable corporate-NAT case; the README disclaimer covers it.
 *
 * In-memory per-instance (express-rate-limit default store). Per-instance
 * means three independent buckets across `maxInstances: 3`. That's fine
 * for a demo — the goal is abuse-prevention, not exact accounting.
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../logger.js';

export const rateLimitMcp = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ua = (req.get('user-agent') ?? 'unknown').slice(0, 100);
    return `${req.ip}::${ua}`;
  },
  handler: (req, res) => {
    logger.warn('ratelimit.blocked', {
      ip: req.ip,
      ua: (req.get('user-agent') ?? 'unknown').slice(0, 100),
      windowMs: 60_000,
      limit: 30,
    });
    res.status(429).json({
      error: 'Too many requests — try again in a minute.',
    });
  },
});
