/**
 * best's lean schemas change words, not structure: stripped of descriptions they equal the full
 * schema (rich). render_chart's wire schema is small; the full shape is the validator its handler
 * runs (bestChartInputSchema), so that is the one compared.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServer, type ServerVariant } from '../server.js';
import { bestChartInputSchema } from './render-chart-schema-best.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function schemas(variant: ServerVariant | McpServer) {
  const server =
    typeof variant === 'string' ? createServer({ variant, bagClient: noBag, epOnlineClient: noEp }) : variant;
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

/** A server with one tool whose input schema is best's render_chart validator. */
function validatorServer() {
  const server = new McpServer({ name: 'validator', version: '0.0.0' });
  server.registerTool('render_chart', { inputSchema: bestChartInputSchema }, async () => ({ content: [] }));
  return server;
}

describe('lean input schemas', () => {
  it('render_table on best has the structure of the full schema, with fewer words', async () => {
    const [best, rich] = await Promise.all([schemas('best'), schemas('rich')]);
    expect(strip(best.render_table)).toEqual(strip(rich.render_table));
    expect(JSON.stringify(best.render_table).length).toBeLessThan(JSON.stringify(rich.render_table).length * 0.7);
  });

  it("render_chart's validator on best has the structure of the full schema, with fewer words", async () => {
    const [validator, rich] = await Promise.all([schemas(validatorServer()), schemas('rich')]);
    expect(strip(validator.render_chart)).toEqual(strip(rich.render_chart));
    expect(JSON.stringify(validator.render_chart).length).toBeLessThan(JSON.stringify(rich.render_chart).length * 0.7);
  });

  it("render_chart's wire schema on best is a fraction of the full one", async () => {
    const [best, rich] = await Promise.all([schemas('best'), schemas('rich')]);
    expect(JSON.stringify(best.render_chart).length).toBeLessThan(JSON.stringify(rich.render_chart).length * 0.3);
  });
});
