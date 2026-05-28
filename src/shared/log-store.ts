/**
 * Tool-call audit log shim for the demo.
 *
 * In wb-mcp-server this writes to a Firestore collection so the team
 * can analyse tool usage per user/session. Here it just emits a
 * structured stderr log — Cloud Logging picks it up automatically
 * and that's the only audit channel we need for a public demo.
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

export async function writeToolCallLog(entry: ToolCallLogEntry): Promise<void> {
  logger.info('tool.invoked', {
    tool: entry.tool,
    queryIntent: entry.queryIntent,
    status: entry.status,
    durationMs: entry.durationMs,
    errorType: entry.errorType,
  });
}
