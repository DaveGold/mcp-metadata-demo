import { beforeEach, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerGetToolCallLogTool } from './get-tool-call-log.js';
import { __resetRingBufferForTests, writeToolCallLog } from '../shared/log-store.js';
import { requestContext } from '../shared/log-context.js';

async function connect(opts: { minimal?: boolean } = {}) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerGetToolCallLogTool(server, opts);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function entry(tool: string, queryIntent: string) {
  return {
    sessionId: 's1',
    environment: 'local',
    server: 'metadata-demo',
    user: 'unknown',
    userId: 'unknown',
    tool,
    connector: 'Test',
    queryIntent,
    filters: [],
    filterCount: 0,
    summaryOnly: false,
    skip: 0,
    take: 0,
    status: 'success' as const,
    rowCount: 1,
    hasMore: false,
    durationMs: 5,
    errorType: null,
  };
}

describe('get_tool_call_log', () => {
  beforeEach(() => {
    __resetRingBufferForTests();
  });

  it('reads back recently logged calls (no request context active -> local/in-memory path)', async () => {
    await writeToolCallLog(entry('get_building_profile', 'what building is at X'));
    await writeToolCallLog(entry('render_chart', 'show a bar chart'));

    const client = await connect();
    const response = await client.callTool({ name: 'get_tool_call_log', arguments: {} });

    expect(response.isError ?? false).toBe(false);
    const parsed = JSON.parse((response.content as Array<{ type: string; text: string }>)[0].text) as {
      records: Array<{ tool: string; queryIntent: string }>;
      summary: { environment: string };
      interpretation: { alerts: string[] };
    };

    expect(parsed.summary.environment).toBe('local');
    expect(parsed.records.map((r) => r.queryIntent)).toEqual(['show a bar chart', 'what building is at X']);
    expect(parsed.interpretation.alerts.some((a) => a.includes('environment: local'))).toBe(true);

    await client.close();
  });

  it('filters by tool and alerts when the filter matches nothing', async () => {
    await writeToolCallLog(entry('render_chart', 'a chart'));

    const client = await connect();
    const response = await client.callTool({
      name: 'get_tool_call_log',
      arguments: { tool: 'get_building_profile' },
    });

    const parsed = JSON.parse((response.content as Array<{ type: string; text: string }>)[0].text) as {
      records: unknown[];
      interpretation: { alerts: string[] };
    };
    expect(parsed.records).toEqual([]);
    expect(parsed.interpretation.alerts.some((a) => /No calls found for tool "get_building_profile"/.test(a))).toBe(
      true
    );

    await client.close();
  });

  // ── Regression guards for the 2026-09-21 stale-deploy defect ──────────────
  // The `inline` arm was deployed before variant stamping existed and never
  // redeployed, so every one of its rows landed as variant "unknown" with an
  // empty paramsPresent and rowCount 0. The old alert blamed stdio or
  // pre-stamping code and told the reader "do not count them against any arm",
  // which would have deleted a whole arm from the audit and called the run
  // clean. These tests pin the two things that make that visible instead.

  it('summary.countByVariant exposes every arm, so an arm going missing is visible without a filter', async () => {
    await requestContext.run({ sessionId: 's1', environment: 'local', variant: 'words' }, async () => {
      await writeToolCallLog(entry('get_building_profile', 'words call'));
    });
    await requestContext.run({ sessionId: 's2', environment: 'local', variant: 'inline-recipe' }, async () => {
      await writeToolCallLog(entry('get_building_profile', 'recipe call'));
    });
    // No context: the stale-deploy / stdio signature.
    await writeToolCallLog(entry('get_building_profile', 'unattributed call'));

    const client = await connect();
    const response = await client.callTool({ name: 'get_tool_call_log', arguments: {} });
    const parsed = JSON.parse((response.content as Array<{ type: string; text: string }>)[0].text) as {
      summary: { countByVariant: Record<string, number> };
    };

    expect(parsed.summary.countByVariant).toEqual({ words: 1, 'inline-recipe': 1, unknown: 1 });
    await client.close();
  });

  it('names a stale deploy as a cause of unknown rows, and never tells the reader to discard them', async () => {
    await writeToolCallLog(entry('get_building_profile', 'unattributed call'));

    const client = await connect();
    const response = await client.callTool({ name: 'get_tool_call_log', arguments: {} });
    const parsed = JSON.parse((response.content as Array<{ type: string; text: string }>)[0].text) as {
      interpretation: { alerts: string[] };
    };
    const unknownAlert = parsed.interpretation.alerts.find((a) => a.includes('variant "unknown"'));

    expect(unknownAlert).toBeDefined();
    expect(unknownAlert).toMatch(/STALE REVISION/);
    expect(unknownAlert).toMatch(/DO NOT discard/);
    // The instruction that caused the miss must not come back.
    expect(unknownAlert).not.toMatch(/Do not count them against any arm/);
    await client.close();
  });

  it('accepts a limit large enough to audit a whole eval batch', async () => {
    const client = await connect();
    const response = await client.callTool({ name: 'get_tool_call_log', arguments: { limit: 500 } });
    expect(response.isError ?? false).toBe(false);
    await client.close();
  });

  it('exposes a one-sentence description in minimal mode, same schema as rich', async () => {
    const client = await connect({ minimal: true });
    const { tools } = await client.listTools();
    expect(tools[0].description).toBe('Look up recent tool calls and their queryIntent values.');
    expect(tools[0].inputSchema).toBeDefined();
    await client.close();
  });
});
