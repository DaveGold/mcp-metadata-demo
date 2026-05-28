/**
 * Auth shim for the no-auth demo.
 *
 * The hosted endpoint is public — there is no user identity to extract.
 * This shim keeps the tool-file signatures unchanged from wb-mcp-server
 * (which uses Entra ID OAuth) so future syncs stay diff-small.
 */

export function getAuthExtra(_authInfo: unknown): {
  email: string;
  userId: string;
  roles: string[];
} | null {
  return null;
}
