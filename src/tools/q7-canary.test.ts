/**
 * Q7b's canary arms must differ from their bases in EXACTLY one thing: one
 * sentence appended to the get_building_profile description. These tests pin
 * that over the whole model-visible surface — every tool, every schema, the
 * server instructions and name, and the response — because a canary that
 * quietly changes anything else measures nothing.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import { descriptionCore } from './get-building-profile.js';
import { proseDescription } from './get-building-profile-opaque.js';
import { q7CanarySentence, withQ7Canary } from './q7-canary.js';

const stubBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const stubEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function connect(variant: ServerVariant) {
  const server = createServer({ variant, bagClient: stubBag, epOnlineClient: stubEp });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientT);
  return client;
}

async function surface(variant: ServerVariant) {
  const client = await connect(variant);
  const { tools } = await client.listTools();
  const response = await client.callTool({
    name: 'get_building_profile',
    arguments: { postcode: '3039WB', huisnummer: 1 },
  });
  return {
    tools,
    instructions: client.getInstructions(),
    serverName: client.getServerVersion()?.name,
    response,
  };
}

describe('the Q7 canary sentence', () => {
  it('is one sentence on one line, carrying the marker', () => {
    expect(q7CanarySentence.includes('\n')).toBe(false);
    expect(q7CanarySentence.match(/[.!?](\s|$)/g)).toHaveLength(1);
    expect(q7CanarySentence).toContain('⟨D7⟩');
  });

  it('is content-free: no domain term, no number but the marker', () => {
    const withoutMarker = q7CanarySentence.replace('⟨D7⟩', '');
    expect(withoutMarker).not.toMatch(/\d/);
    expect(withoutMarker).not.toMatch(/overheat|temperatuur|threshold|risk|1\.5/i);
  });

  it('appears in neither base description', () => {
    expect(descriptionCore).not.toContain('D7');
    expect(proseDescription).not.toContain('D7');
  });
});

describe.each([
  ['words-canary', 'words', descriptionCore],
  ['opaque-words-canary', 'opaque-words', proseDescription],
] as const)('%s vs %s', (canary, base, baseDescription) => {
  it('has the base description plus exactly the one sentence', async () => {
    const c = await surface(canary);
    const b = await surface(base);
    const cd = c.tools.find((t) => t.name === 'get_building_profile')!.description;
    const bd = b.tools.find((t) => t.name === 'get_building_profile')!.description;
    expect(bd).toBe(baseDescription);
    expect(cd).toBe(withQ7Canary(bd!));
    expect(cd).toBe(bd + '\n\n' + q7CanarySentence);
  });

  it('differs in NOTHING else the model can see', async () => {
    const c = await surface(canary);
    const b = await surface(base);
    const strip = (tools: typeof c.tools) =>
      tools.map((t) =>
        t.name === 'get_building_profile' ? { ...t, description: '<compared above>' } : t
      );
    expect(strip(c.tools)).toEqual(strip(b.tools));
    expect(c.instructions).toBe(b.instructions);
    expect(c.serverName).toBe(b.serverName);
    expect(c.response).toEqual(b.response);
  });
});
