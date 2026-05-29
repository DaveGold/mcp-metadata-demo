/**
 * MCP tool: fetch_image
 *
 * Fetches external image URLs server-side and returns them as base64.
 * Called by the render_table Angular component via bridge.callTool() to
 * bypass Claude.ai's iframe CSP which blocks img-src to external domains.
 *
 * Two-layer cache:
 *   L1 — in-memory Map (per-instance, instant, lost on cold start / deploy)
 *   L2 — origin fetch when L1 misses
 *
 * (wb-mcp-server's Firestore L2 cache stripped — keeping the demo
 * Firestore-free. Cold-starts re-fetch from origin, which is fine at
 * the request volumes this demo expects.)
 *
 * Security (SSRF hardening):
 *   - Only http(s) URLs accepted (mailto/javascript/data/file rejected)
 *   - Hostname resolved via DNS.lookup BEFORE fetch; any resolved IP matching
 *     private / loopback / link-local / CGNAT ranges rejects the request.
 *     Mitigates DNS rebinding (attacker domain → 127.0.0.1).
 *   - Redirects not followed automatically (redirect: 'manual'); each hop
 *     revalidated against the same IP + scheme guard before continuation.
 *     Max 3 redirect hops.
 *   - 2MB per-image size cap + MIME allowlist (jpeg/png/webp/gif/svg+xml)
 *   - 15s per-image total timeout (across all redirect hops)
 *
 * This tool is NOT meant to be called by the AI agent — it's an internal
 * tool used by the render_table UI component.
 */

import { z } from 'zod';
import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { logger } from '../logger.js';
import { RESOURCE_URI } from './render-table.js';

const MAX_IMAGES_PER_CALL = 50;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

const MAX_REDIRECT_HOPS = 3;

// Host literals blocked at the URL level (before DNS resolution).
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

/**
 * True when the given IP string falls inside a range we refuse to reach.
 * Matches: IPv4 loopback/private/link-local/CGNAT/reserved; IPv6 loopback/link-local/unique-local/IPv4-mapped private.
 */
function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // unparseable — reject defensively
  if (version === 4) {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
    const [first, second] = parts as [number, number, number, number];
    if (first === 0) return true; // 0.0.0.0/8
    if (first === 10) return true; // 10.0.0.0/8
    if (first === 127) return true; // 127.0.0.0/8 loopback
    if (first === 169 && second === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
    if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
    if (first === 192 && second === 168) return true; // 192.168.0.0/16
    if (first === 100 && second >= 64 && second <= 127) return true; // 100.64.0.0/10 CGNAT
    if (first >= 224) return true; // multicast (224/4) + reserved (240/4) + 255.255.255.255
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  if (lower.startsWith('ff')) return true; // multicast
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded IPv4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isBlockedIp(mapped[1]);
  return false;
}

// ── L1: In-memory cache ─────────────────────────────────────────────────────

interface CachedImage {
  data: string; // base64
  mime: string;
}
const memoryCache = new Map<string, CachedImage>();
const MEMORY_CACHE_MAX = 200;

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

// ── URL validation (SSRF guard) ─────────────────────────────────────────────

type ValidationResult = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Parse + scheme check. Synchronous — used before DNS resolution.
 */
function parseAndScreenUrl(raw: string): ValidationResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (!hostname) return { ok: false, reason: 'empty_host' };
  if (BLOCKED_HOSTNAMES.has(hostname)) return { ok: false, reason: 'blocked_hostname' };

  // If the host IS an IP literal, validate it directly without a DNS lookup.
  if (isIP(hostname) !== 0 && isBlockedIp(hostname)) {
    return { ok: false, reason: 'private_ip_literal' };
  }

  return { ok: true, url };
}

/**
 * Full validation: parse + DNS-resolve + check every resolved IP against blocklist.
 * This closes the hostname-only hole (DNS rebinding: attacker-controlled domain → 127.0.0.1).
 */
async function validateUrl(raw: string): Promise<ValidationResult> {
  const screened = parseAndScreenUrl(raw);
  if (!screened.ok) return screened;

  const hostname = screened.url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // IP literal already checked in parseAndScreenUrl — no DNS lookup needed.
  if (isIP(hostname) !== 0) return screened;

  // DNS-resolve and verify every resolved address. `all: true` returns A + AAAA records.
  try {
    const addresses = await dnsLookup(hostname, { all: true });
    if (addresses.length === 0) return { ok: false, reason: 'dns_no_records' };
    for (const { address } of addresses) {
      if (isBlockedIp(address)) return { ok: false, reason: 'private_ip_resolved' };
    }
  } catch {
    return { ok: false, reason: 'dns_lookup_failed' };
  }

  return screened;
}

// ── Origin fetch (manual redirect walking) ──────────────────────────────────

async function fetchWithTimeout(rawUrl: string): Promise<CachedImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      // Revalidate every hop — the first URL is validated by the caller, but
      // each redirect Location needs the same IP-level check (prevents
      // open-redirect chains pointing to metadata endpoints).
      if (hop > 0) {
        const check = await validateUrl(current);
        if (!check.ok) {
          logger.warn('fetch_image.redirect_blocked', { url: current, reason: check.reason });
          return null;
        }
      }

      const response = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'mcp-metadata-demo/1.0 (image proxy for render_table)' },
      });

      // 3xx: follow manually after revalidation.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) return null;

      const mime = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
      if (!ALLOWED_MIMES.has(mime)) return null;

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const size = Number(contentLengthHeader);
        if (Number.isFinite(size) && size > MAX_BYTES) return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) return null;

      return { data: buffer.toString('base64'), mime };
    }
    // Ran out of redirect hops
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveImage(
  rawUrl: string
): Promise<{ url: string; data: string | null; mime: string | null; reason?: string }> {
  const safety = await validateUrl(rawUrl);
  if (!safety.ok) {
    return { url: rawUrl, data: null, mime: null, reason: safety.reason };
  }

  const key = cacheKey(rawUrl);

  // L1
  const memHit = memoryCache.get(key);
  if (memHit) return { url: rawUrl, data: memHit.data, mime: memHit.mime };

  // L2 — origin fetch
  const fetched = await fetchWithTimeout(safety.url.toString());
  if (!fetched) {
    return { url: rawUrl, data: null, mime: null, reason: 'fetch_failed' };
  }

  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, fetched);

  return { url: rawUrl, data: fetched.data, mime: fetched.mime };
}

// ── Tool registration ───────────────────────────────────────────────────────

const inputSchema = {
  urls: z.array(z.string()).describe('Array of image URLs to fetch. Max 50 per call.'),
};

export function registerFetchImageTool(server: McpServer): void {
  registerAppTool(
    server,
    'fetch_image',
    {
      title: 'Fetch Images',
      description:
        'Internal tool for the table UI — fetches external image URLs server-side and returns base64. ' +
        'App-only — DO NOT call this tool directly. Only the render_table UI can call it via bridge.callTool().',
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
          visibility: ['app'],
        },
      },
    },
    async ({ urls }) => {
      if (urls.length > MAX_IMAGES_PER_CALL) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Too many images (${urls.length}). Maximum ${MAX_IMAGES_PER_CALL}.`,
            },
          ],
          isError: true,
        };
      }

      const unique = Array.from(new Set(urls));
      const results = await Promise.all(unique.map((u) => resolveImage(u)));

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(results),
          },
        ],
      };
    }
  );
}
