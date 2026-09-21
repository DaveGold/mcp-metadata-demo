/**
 * AsyncLocalStorage request-context for tool-call audit logging.
 *
 * The private server this demo was extracted from uses this to propagate
 * session/environment through tool handlers so writeToolCallLog can stamp
 * audit rows. The demo wires the same mechanism: http.ts opens a context
 * per request, and the tool handlers read it to emit `tool.invoked` to
 * stderr / Cloud Logging.
 *
 * getStore() returns null when no context is active (e.g. the stdio
 * transport, which does not run inside requestContext.run) — callers
 * fall back to 'unknown'/'local' rather than skipping the audit log.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  sessionId: string;
  environment: string;
  /**
   * Which server variant served this request ('rich' | 'words' | 'inline' | ...).
   * Every arm writes to ONE Firestore collection, so without this a log row
   * cannot be attributed to an arm — which made the log useless for the eval.
   * Stamped in http.ts, where the variant is already known.
   */
  variant?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  getStore(): RequestContext | null {
    return storage.getStore() ?? null;
  },
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },
};
