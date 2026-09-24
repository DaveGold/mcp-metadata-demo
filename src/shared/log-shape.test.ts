/** Render calls log their SHAPE — the form chosen and its counts — never labels, titles or values. */
import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { logger } from '../logger.js';
import { requestContext } from './log-context.js';
import type { BagClientLike, EpOnlineClientLike } from '../tools/get-building-profile.js';

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

describe('render call shape in the log', () => {
  it('render_chart logs type and counts, and none of its labels or values', async () => {
    const info = vi.spyOn(logger, 'info');
    const server = createServer({ variant: 'best', bagClient: noBag, epOnlineClient: noEp });
    const [c, s] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'shape-test', version: '0.0.0' });
    await Promise.all([client.connect(c), server.connect(s)]);
    await requestContext.run({ sessionId: 't', environment: 'local', variant: 'best' }, () =>
      client.callTool({
        name: 'render_chart',
        arguments: {
          type: 'pie',
          title: 'SECRET-TITLE',
          labels: ['a', 'b', 'c'],
          datasets: [['SECRET-SERIES', [1, 2, 3]]],
        },
      }),
    );
    const call = info.mock.calls.find(
      ([event, data]) => event === 'tool.invoked' && (data as { tool?: string }).tool === 'render_chart',
    );
    expect(call).toBeDefined();
    const shape = (call![1] as { shape?: Record<string, unknown> }).shape;
    expect(shape).toEqual({ chartType: 'pie', labels: 3, datasets: 1, annotations: 0 });
    expect(JSON.stringify(shape)).not.toMatch(/SECRET/);
    info.mockRestore();
  });

  it('a refused render call is logged too, with status error and its shape', async () => {
    const info = vi.spyOn(logger, 'info');
    const server = createServer({ variant: 'rich', bagClient: noBag, epOnlineClient: noEp });
    const [c, s] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'shape-test', version: '0.0.0' });
    await Promise.all([client.connect(c), server.connect(s)]);
    const r = await requestContext.run({ sessionId: 't', environment: 'local', variant: 'rich' }, () =>
      client.callTool({
        name: 'render_table',
        arguments: {
          columns: [
            { key: 'a', header: 'A' },
            { key: 'b', header: 'B' },
          ],
          data: [[1, 2, 3]],
        },
      }),
    );
    expect(r.isError).toBe(true);
    const call = info.mock.calls.find(
      ([event, data]) => event === 'tool.invoked' && (data as { tool?: string }).tool === 'render_table',
    );
    expect(call![1]).toMatchObject({ status: 'error', shape: { columns: 2, rows: 1 } });
    info.mockRestore();
  });
});
