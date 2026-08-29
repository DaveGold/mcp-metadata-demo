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
}

export interface ToolCallRecord {
  tool: string;
  queryIntent: string;
  status: 'success' | 'error';
  durationMs: number;
  timestamp: string;
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
  logger.info('tool.invoked', {
    tool: entry.tool,
    queryIntent: entry.queryIntent,
    status: entry.status,
    durationMs: entry.durationMs,
    errorType: entry.errorType,
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
  });
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function readRecentToolCalls(
  environment: string,
  opts: { tool?: string; limit: number }
): Promise<ToolCallRecord[]> {
  if (environment === 'cloud') {
    const db = await getFirestoreDb();
    let query = db.collection(FIRESTORE_COLLECTION).orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.tool) query = db.collection(FIRESTORE_COLLECTION).where('tool', '==', opts.tool).orderBy('createdAt', 'desc').limit(opts.limit);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        tool: data.tool as string,
        queryIntent: data.queryIntent as string,
        status: data.status as 'success' | 'error',
        durationMs: data.durationMs as number,
        timestamp: (data.createdAt as import('firebase-admin/firestore').Timestamp | undefined)?.toDate().toISOString() ?? '',
      };
    });
  }

  const filtered = opts.tool ? ringBuffer.filter((r) => r.tool === opts.tool) : ringBuffer;
  return filtered.slice(-opts.limit).reverse();
}

/** Test-only: clear the in-memory ring buffer between test cases. */
export function __resetRingBufferForTests(): void {
  ringBuffer.length = 0;
}
