/**
 * Tool-call audit log.
 *
 * Interaction *shape* only — never filter values, never response data (see the
 * rich-domain-mcp-server skill's handlers.md for why). Two backends, selected by
 * `entry.environment` (stamped from `K_SERVICE` in src/http.ts):
 *
 *   - 'cloud'  → a Firestore `toolCalls` collection, via firebase-admin. Cloud
 *     Functions supplies Application Default Credentials automatically — no
 *     secret to configure.
 *   - 'local'  → a bounded in-memory ring buffer (this process only, reset on
 *     restart) — so `get_tool_call_log` is testable via `npm run inspect`
 *     without deploying or touching Firestore.
 *
 * In both cases the existing stderr line (`logger.info('tool.invoked', ...)`)
 * still fires — that's what "console log locally" already meant before this
 * file grew a real read path.
 */

import { logger } from '../logger.js';
import { requestContext } from './log-context.js';

export interface ToolCallLogEntry {
  sessionId: string;
  environment: string;
  server: string;
  user: string;
  userId: string;
  tool: string;
  connector: string;
  queryIntent: string;
  filters: unknown[];
  filterCount: number;
  summaryOnly: boolean;
  skip: number;
  take: number;
  status: 'success' | 'error';
  rowCount: number;
  hasMore: boolean;
  durationMs: number;
  errorType: string | null;
  /**
   * Which OPTIONAL parameters the caller actually supplied, by name only —
   * never their values. Shape, not data, per the doctrine at the top of this
   * file. It answers questions nothing else in the log can, such as whether a
   * caller passed `huisletter` to disambiguate a multi-unit address.
   */
  paramsPresent?: string[];
}

export interface ToolCallRecord {
  tool: string;
  queryIntent: string;
  status: 'success' | 'error';
  durationMs: number;
  timestamp: string;
  /** Which server variant served the call. 'unknown' for stdio, which opens no context. */
  variant: string;
  /** Names of the optional parameters supplied — never their values. */
  paramsPresent: string[];
  /** Rows the call resolved to. 0 on a miss or an error. */
  rowCount: number;
  /** Null on success. */
  errorType: string | null;
  /** Per-REQUEST id. This server is stateless, so it does NOT group a run. */
  sessionId: string;
}

const FIRESTORE_COLLECTION = 'toolCalls';

// ── Local ring buffer ────────────────────────────────────────────────────────

const RING_BUFFER_CAP = 50;
const ringBuffer: ToolCallRecord[] = [];

function pushToRingBuffer(record: ToolCallRecord): void {
  ringBuffer.push(record);
  if (ringBuffer.length > RING_BUFFER_CAP) ringBuffer.shift();
}

// ── Firestore (cloud only) — dynamically imported so local/test runs never
// touch firebase-admin at all. ───────────────────────────────────────────────

let firestorePromise: Promise<import('firebase-admin/firestore').Firestore> | null = null;

async function getFirestoreDb(): Promise<import('firebase-admin/firestore').Firestore> {
  if (!firestorePromise) {
    firestorePromise = (async () => {
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      if (getApps().length === 0) initializeApp();
      return getFirestore();
    })();
  }
  return firestorePromise;
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function writeToolCallLog(entry: ToolCallLogEntry): Promise<void> {
  // Resolved here rather than passed by every caller: seven tools write to this
  // log and none of them need to know which variant is serving them.
  const variant = requestContext.getStore()?.variant ?? 'unknown';
  const paramsPresent = entry.paramsPresent ?? [];

  logger.info('tool.invoked', {
    tool: entry.tool,
    queryIntent: entry.queryIntent,
    status: entry.status,
    durationMs: entry.durationMs,
    errorType: entry.errorType,
    variant,
    paramsPresent,
    rowCount: entry.rowCount,
  });

  if (entry.environment === 'cloud') {
    const db = await getFirestoreDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.collection(FIRESTORE_COLLECTION).add({
      tool: entry.tool,
      queryIntent: entry.queryIntent,
      status: entry.status,
      durationMs: entry.durationMs,
      errorType: entry.errorType,
      sessionId: entry.sessionId,
      environment: entry.environment,
      server: entry.server,
      variant,
      paramsPresent,
      rowCount: entry.rowCount,
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  pushToRingBuffer({
    tool: entry.tool,
    queryIntent: entry.queryIntent,
    status: entry.status,
    durationMs: entry.durationMs,
    timestamp: new Date().toISOString(),
    variant,
    paramsPresent,
    rowCount: entry.rowCount,
    errorType: entry.errorType,
    sessionId: entry.sessionId,
  });
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function readRecentToolCalls(
  environment: string,
  opts: { tool?: string; limit: number; variant?: string }
): Promise<ToolCallRecord[]> {
  if (environment === 'cloud') {
    const db = await getFirestoreDb();
    let query = db.collection(FIRESTORE_COLLECTION).orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.tool) query = db.collection(FIRESTORE_COLLECTION).where('tool', '==', opts.tool).orderBy('createdAt', 'desc').limit(opts.limit);
    const snapshot = await query.get();
    const rows = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        tool: data.tool as string,
        queryIntent: data.queryIntent as string,
        status: data.status as 'success' | 'error',
        durationMs: data.durationMs as number,
        timestamp: (data.createdAt as import('firebase-admin/firestore').Timestamp | undefined)?.toDate().toISOString() ?? '',
        // Rows written before these fields existed carry none of them.
        variant: (data.variant as string | undefined) ?? 'unknown',
        paramsPresent: (data.paramsPresent as string[] | undefined) ?? [],
        rowCount: (data.rowCount as number | undefined) ?? 0,
        errorType: (data.errorType as string | null | undefined) ?? null,
        sessionId: (data.sessionId as string | undefined) ?? '',
      };
    });
    // Applied in-process, not in the query: a composite index on
    // (tool, variant, createdAt) would be needed otherwise, and the page is at
    // most 100 rows. It therefore NARROWS the returned page rather than
    // searching deeper — pass a large `limit` when filtering by variant.
    return opts.variant ? rows.filter((r) => r.variant === opts.variant) : rows;
  }

  const filtered = ringBuffer
    .filter((r) => (opts.tool ? r.tool === opts.tool : true))
    .filter((r) => (opts.variant ? r.variant === opts.variant : true));
  return filtered.slice(-opts.limit).reverse();
}

/** Test-only: clear the in-memory ring buffer between test cases. */
export function __resetRingBufferForTests(): void {
  ringBuffer.length = 0;
}
