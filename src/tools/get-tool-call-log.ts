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
said they were trying to do), success/error status, duration, which ARM served the call
(\`variant\`), which OPTIONAL PARAMETERS the caller supplied by name (\`paramsPresent\`), how many rows
the call resolved to (\`rowCount\`), \`errorType\` and the per-request \`sessionId\`. Plus a summary
(count per tool, the environment this data came from, oldest/newest timestamp covered).

WHEN TO USE:
- "What have people actually been asking this server?" / "What's this tool been used for?"
- Before enriching a tool's description or schema — read a batch of real queryIntent values first,
  the same way production usage drives the Encode step of the Introspective Context Engineering loop.

WHEN NOT TO USE:
- You want the actual response data from a past call — this log stores interaction *shape* only
  (tool name, queryIntent, status, duration, which arm, which parameter NAMES were supplied, row
  count), never parameter values or response payloads. \`paramsPresent\` says that \`huisletter\` was
  passed, never that it was "A".

INTERPRETATION:
- Results differ by environment, and the summary tells you which one you got:
  - "local": this process's in-memory buffer only, capped at the last 50 calls, reset on restart —
    what you get from \`npm run inspect\` or a local stdio session.
  - "cloud": the persisted Firestore history from the deployed endpoint, across every caller.
- An empty result with environment "local" usually just means no other tool has been called yet in
  this process — not a broken log.
- Read consecutive queryIntent values as a narrative, not as isolated rows: three calls whose intent
  drifts from a broad question to a narrower one usually names an exact gap in the tool's description.

USING THIS TO AUDIT AN EVAL RUN:
- START UNFILTERED and read \`summary.countByVariant\`. That is the only view that shows an arm going
  missing. A \`variant\` filter returning zero looks identical whether the arm was never called or is
  failing to stamp its rows — on 2026-09-21 it was the latter, and the filter alone reported clean.
- Every arm writes to ONE log. \`variant\` is the only field that attributes a row to an arm — filter
  on it, and pass a large \`limit\`, since the filter narrows the fetched page rather than searching
  deeper.
- A persistent bucket of \`variant: "unknown"\` in environment "cloud" means AN ARM IS RUNNING A STALE
  DEPLOY, not that the log is broken. Code deployed before variant stamping writes "unknown", an
  empty \`paramsPresent\` and \`rowCount\` 0 on every call, forever, while the repo source looks correct.
  Redeploy that arm before trusting any count from it.
- Size \`limit\` to the whole batch. The default of 20 and the old cap of 100 are both smaller than a
  single eval run, which is why the 2026-09-21 audit could only cover its last third.
- \`sessionId\` is per-REQUEST, not per-run: this server is stateless, so a subagent that made three
  calls produced three different sessionIds. Correlate a run by (variant + timestamp window), and
  count calls per arm per batch rather than trying to reconstruct individual runs.
- \`paramsPresent\` is the highest-value field for scoring: it says whether the caller supplied
  \`huisletter\` at all, which no answer text reliably reveals and which a subagent's self-reported
  PARAMS line can simply get wrong.

RELATED TOOLS:
- Every other tool on this server writes to this same log — this tool only reads it back.

ALERTS: notes when the environment is "local" (so an empty or short list isn't mistaken for "the log is broken"), and when a requested \`tool\` filter matched zero calls.`;

const minimalDescription = 'Look up recent tool calls and their queryIntent values.';

const inputSchema = {
  tool: z.string().optional().describe('Filter to calls for this exact tool name (e.g. "get_building_profile").'),
  variant: z
    .string()
    .optional()
    .describe(
      'Filter to calls served by one arm ("rich" | "words" | "words-recipe" | "inline" | "inline-recipe" | "schema" | "minimal" | "opaque" | "opaque-words"). Applied AFTER the page is fetched, so pass a large `limit` alongside it. Read `summary.countByVariant` from an UNFILTERED call first: a filter returning zero cannot tell "never called" from "not stamping".'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(20)
    .describe(
      'Maximum number of calls to return, most recent first. Default 20, max 500. One eval batch does not fit in 100 rows — size this to the whole window you are auditing.'
    ),
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
        variant: z
          .string()
          .describe('Which arm served the call. "unknown" for stdio, which opens no request context.'),
        paramsPresent: z
          .array(z.string())
          .describe(
            'Names of the OPTIONAL parameters the caller supplied — never their values. For get_building_profile: huisletter, toevoeging, queryIntent.'
          ),
        rowCount: z.number().describe('Rows the call resolved to. 0 on a miss or an error.'),
        errorType: z.string().nullable().describe('Null on success.'),
        sessionId: z
          .string()
          .describe('Per-REQUEST id. This server is stateless, so this does NOT group a multi-call run.'),
      })
    )
    .describe('Recent calls, most recent first'),
  summary: z.object({
    environment: z.string().describe('"local" (in-memory, this process only) or "cloud" (persisted Firestore)'),
    countByTool: z.record(z.string(), z.number()).describe('Number of returned records per tool'),
    countByVariant: z
      .record(z.string(), z.number())
      .describe(
        'Number of returned records per ARM. Read this before filtering: an arm missing here, or a large "unknown" bucket, is an attribution problem rather than an absence of calls.'
      ),
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
    async (args: { tool?: string; limit?: number; variant?: string }) => {
      const start = Date.now();
      const limit = args.limit ?? 20;

      try {
        const ctx = requestContext.getStore();
        const environment = ctx?.environment ?? 'local';

        const records = await readRecentToolCalls(environment, { tool: args.tool, limit, variant: args.variant });

        const countByTool: Record<string, number> = {};
        for (const r of records) countByTool[r.tool] = (countByTool[r.tool] ?? 0) + 1;

        const countByVariant: Record<string, number> = {};
        for (const r of records) countByVariant[r.variant] = (countByVariant[r.variant] ?? 0) + 1;

        const alerts: string[] = [];
        if (environment === 'local') {
          alerts.push(
            'environment: local — this is an in-memory buffer for this process only (last 50 calls, reset on restart), not the deployed persisted log.'
          );
        }
        if (args.tool && records.length === 0) {
          alerts.push(`No calls found for tool "${args.tool}".`);
        }
        if (args.variant && records.length === 0) {
          alerts.push(
            `No calls found for variant "${args.variant}" in the last ${limit} rows. The variant filter narrows the fetched page rather than searching deeper — retry with a larger limit before concluding the arm was not called.`
          );
        }
        const unknownRows = records.filter((r) => r.variant === 'unknown');
        if (unknownRows.length > 0) {
          alerts.push(
            `${unknownRows.length} of ${records.length} rows have variant "unknown". THREE causes, not equally harmless: (1) stdio, which opens no request context; (2) rows written before variant stamping existed; (3) A DEPLOYED ARM RUNNING A STALE REVISION, which predates the stamping and will keep writing "unknown" forever while the repo source looks correct. Cause 3 silently deletes a whole arm from every count — it is what happened to the inline arm on 2026-09-21. DO NOT discard these rows: match their queryIntent values against the arm you expected, and if they line up, redeploy that arm and re-run the audit.`
          );
          if (environment === 'cloud' && unknownRows.every((r) => r.rowCount === 0 && r.paramsPresent.length === 0)) {
            alerts.push(
              'Every "unknown" row also has rowCount 0 and an empty paramsPresent — the signature of pre-stamping code, not of genuine empty results. In environment "cloud" stdio is impossible, so read this as a STALE DEPLOY of whichever arm those queryIntent values belong to.'
            );
          }
        }

        const output = {
          records,
          summary: {
            environment,
            countByTool,
            countByVariant,
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
