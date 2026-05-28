import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Capture the handler that `register*Tool(server, ...)` passes as the 3rd arg
 * of `server.registerTool(name, config, handler)`. Avoids spinning up a real MCP server.
 */
export type CapturedToolHandler = (
  args: Record<string, unknown>,
  extra: { authInfo?: unknown }
) => Promise<unknown>;

export interface CapturedToolRegistration {
  name: string;
  config: unknown;
  handler: CapturedToolHandler;
}

export function captureHandler() {
  const registered: CapturedToolRegistration[] = [];

  const server = {
    registerTool: (name: string, config: unknown, handler: CapturedToolHandler) => {
      registered.push({ name, config, handler });
    },
  };

  return {
    server: server as unknown as McpServer,
    getHandler: (): CapturedToolHandler => {
      if (registered.length === 0) {
        throw new Error('No tool was registered yet');
      }
      return registered[registered.length - 1].handler;
    },
    getRegistration: (): CapturedToolRegistration => {
      if (registered.length === 0) {
        throw new Error('No tool was registered yet');
      }
      return registered[registered.length - 1];
    },
    getAll: (): CapturedToolRegistration[] => registered,
  };
}
