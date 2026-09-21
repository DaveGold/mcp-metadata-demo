/**
 * Auth shim for the no-auth demo.
 *
 * The hosted endpoint is public — there is no user identity to extract.
 * This shim keeps the tool-file signatures unchanged from the private
 * server this demo was extracted from (which authenticates its callers),
 * so future syncs stay diff-small.
 */

export function getAuthExtra(_authInfo: unknown): {
  email: string;
  userId: string;
  roles: string[];
} | null {
  return null;
}
