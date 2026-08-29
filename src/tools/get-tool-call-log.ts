/**
 * MCP tool: get_tool_call_log
 *
 * A live, small-scale version of the production "Iterate" step described in
 * the `rich-domain-mcp-server` skill: read recent tool calls' `queryIntent`
 * values back, to see what questions people have actually been asking this
 * server. Backed by src/shared/log-store.ts's readRecentToolCalls — Firestore
 * when deployed, an in-memory ring buffer (this process only) when local.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { requestContext } from '../shared/log-context.js';
import { readRecentToolCalls, writeToolCallLog } from '../shared/log-store.js';

const description = `\
RETURNS:
The most recent tool calls made to this server: which tool, the caller's queryIntent (what they
said they were trying to do), success/error status, and duration. Plus a summary (count per tool,
the environment this data came from, oldest/newest timestamp covered).

WHEN TO USE:
- "What have people actually been asking this server?" / "What's this tool been used for?"
- Before enriching a tool's description or schema — read a batch of real queryIntent values first,
  the same way production usage drives the Encode step of the Introspective Context Engineering loop.

WHEN NOT TO USE:
- You want the actual response data from a past call — this log stores interaction *shape* only
  (tool name, queryIntent, status, duration), never filter values or response payloads.

INTERPRETATION:
- Results differ by environment, and the summary tells you which one you got:
  - "local": this process's in-memory buffer only, capped at the last 50 calls, reset on restart —
    what you get from \`npm run inspect\` or a local stdio session.
  - "cloud": the persisted Firestore history from the deployed endpoint, across every caller.
- An empty result with environment "local" usually just means no other tool has been called yet in
  this process — not a broken log.
- Read consecutive queryIntent values as a narrative, not as isolated rows: three calls whose intent
  drifts from a broad question to a narrower one usually names an exact gap in the tool's description.

RELATED TOOLS:
- Every other tool on this server writes to this same log — this tool only reads it back.

ALERTS: notes when the environment is "local" (so an empty or short list isn't mistaken for "the log is broken"), and when a requested \`tool\` filter matched zero calls.`;

const minimalDescription = 'Look up recent tool calls and their queryIntent values.';

const inputSchema = {
  tool: z.string().optional().describe('Filter to calls for this exact tool name (e.g. "get_building_profile").'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Maximum number of calls to return, most recent first. Default 20, max 100.'),
};

const outputSchema = {
  records: z
    .array(
      z.object({
        tool: z.string().describe('Tool name'),
        queryIntent: z.string().describe('The caller-supplied (or derived) queryIntent'),
        status: z.enum(['success', 'error']).describe('Call outcome'),
        durationMs: z.number().describe('Call duration in milliseconds'),
        timestamp: z.string().describe('ISO 8601 timestamp'),
      })
    )
    .describe('Recent calls, most recent first'),
  summary: z.object({
    environment: z.string().describe('"local" (in-memory, this process only) or "cloud" (persisted Firestore)'),
    countByTool: z.record(z.string(), z.number()).describe('Number of returned records per tool'),
    oldestTimestamp: z.string().nullable().describe('Timestamp of the oldest returned record'),
    newestTimestamp: z.string().nullable().describe('Timestamp of the newest returned record'),
  }),
  interpretation: z.object({
    alerts: z.array(z.string()).describe('Environment and filter-match notes'),
  }),
};

export function registerGetToolCallLogTool(server: McpServer, opts: { minimal?: boolean } = {}): void {
  server.registerTool(
    'get_tool_call_log',
    {
      title: 'Tool-call log',
      description: opts.minimal ? minimalDescription : description,
      inputSchema: z.object(inputSchema),
      outputSchema: z.object(outputSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { tool?: string; limit?: number }) => {
      const start = Date.now();
      const limit = args.limit ?? 20;

      try {
        const ctx = requestContext.getStore();
        const environment = ctx?.environment ?? 'local';

        const records = await readRecentToolCalls(environment, { tool: args.tool, limit });

        const countByTool: Record<string, number> = {};
        for (const r of records) countByTool[r.tool] = (countByTool[r.tool] ?? 0) + 1;

        const alerts: string[] = [];
        if (environment === 'local') {
          alerts.push(
            'environment: local — this is an in-memory buffer for this process only (last 50 calls, reset on restart), not the deployed persisted log.'
          );
        }
        if (args.tool && records.length === 0) {
          alerts.push(`No calls found for tool "${args.tool}".`);
        }

        const output = {
          records,
          summary: {
            environment,
            countByTool,
            oldestTimestamp: records.length > 0 ? records[records.length - 1].timestamp : null,
            newestTimestamp: records.length > 0 ? records[0].timestamp : null,
          },
          interpretation: { alerts },
        };

        await logToolCall({ args, start, status: 'success', rowCount: records.length });

        return {
          structuredContent: output,
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_tool_call_log', error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_tool_call_log: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

async function logToolCall({
  args,
  start,
  status,
  rowCount,
}: {
  args: { tool?: string; limit?: number };
  start: number;
  status: 'success' | 'error';
  rowCount: number;
}): Promise<void> {
  const ctx = requestContext.getStore();
  if (!ctx) return;
  await writeToolCallLog({
    sessionId: ctx.sessionId,
    environment: ctx.environment,
    server: 'metadata-demo',
    user: 'unknown',
    userId: 'unknown',
    tool: 'get_tool_call_log',
    connector: 'GetToolCallLog',
    queryIntent: args.tool ? `recent calls for ${args.tool}` : 'recent calls, all tools',
    filters: [],
    filterCount: 0,
    summaryOnly: false,
    skip: 0,
    take: args.limit ?? 20,
    status,
    rowCount,
    hasMore: false,
    durationMs: Date.now() - start,
    errorType: status === 'error' ? 'ToolError' : null,
  });
}
