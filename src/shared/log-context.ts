/**
 * AsyncLocalStorage request-context shim for the demo.
 *
 * wb-mcp-server uses this to propagate session/environment through
 * tool handlers so writeToolCallLog can stamp audit rows. For the
 * demo we just expose the same shape but always return null — the
 * stderr/Cloud Logging output is the only audit surface here.
 */

interface RequestContext {
  sessionId: string;
  environment: string;
}

export const requestContext = {
  getStore(): RequestContext | null {
    return null;
  },
};
