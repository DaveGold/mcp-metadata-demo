/** The lean input schemas change words, not structure: stripped of descriptions they equal best's. */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function schemas(variant: ServerVariant) {
  const server = createServer({ variant, bagClient: noBag, epOnlineClient: noEp });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'lean-test', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  const { tools } = await client.listTools();
  await client.close();
  return Object.fromEntries(tools.map((t) => [t.name, t.inputSchema]));
}
const strip = (n: unknown): unknown =>
  Array.isArray(n)
    ? n.map(strip)
    : n && typeof n === 'object'
      ? Object.fromEntries(
          Object.entries(n)
            .filter(([k]) => k !== 'description')
            .map(([k, v]) => [k, strip(v)]),
        )
      : n;

describe('lean input schemas', () => {
  it.each(['render_chart', 'render_table'])('%s has the same structure as best, with fewer words', async (tool) => {
    const [best, lean] = await Promise.all([schemas('best'), schemas('best-lean')]);
    expect(strip(lean[tool])).toEqual(strip(best[tool]));
    expect(JSON.stringify(lean[tool]).length).toBeLessThan(JSON.stringify(best[tool]).length * 0.7);
  });
});
