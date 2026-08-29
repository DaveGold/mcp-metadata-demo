import { beforeEach, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerGetToolCallLogTool } from './get-tool-call-log.js';
import { __resetRingBufferForTests, writeToolCallLog } from '../shared/log-store.js';

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

  it('exposes a one-sentence description in minimal mode, same schema as rich', async () => {
    const client = await connect({ minimal: true });
    const { tools } = await client.listTools();
    expect(tools[0].description).toBe('Look up recent tool calls and their queryIntent values.');
    expect(tools[0].inputSchema).toBeDefined();
    await client.close();
  });
});
