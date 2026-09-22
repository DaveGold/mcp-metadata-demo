/**
 * Q15's arm must differ from `words` in EXACTLY one thing: two paragraphs
 * inserted into the description, inside the part the host delivers. These tests
 * pin the insertion, pin that it lands inside the 2,048-char cut Q7 measured,
 * and pin that nothing else on the model-visible surface differs.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import { descriptionCore, overheatingLine } from './get-building-profile.js';
import {
  HOST_DESCRIPTION_CAP,
  q15CanarySentence,
  q15FrontDescription,
  q15InsertAnchor,
} from './q15-front.js';

const stubBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const stubEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function surface(variant: ServerVariant) {
  const server = createServer({ variant, bagClient: stubBag, epOnlineClient: stubEp });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientT);
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

describe('the Q15 description', () => {
  it('is descriptionCore with exactly two paragraphs inserted before WHEN TO USE', () => {
    const i = descriptionCore.indexOf(q15InsertAnchor);
    const inserted = '\n\n' + overheatingLine + '\n\n' + q15CanarySentence;
    expect(q15FrontDescription).toBe(descriptionCore.slice(0, i) + inserted + descriptionCore.slice(i));
    expect(q15FrontDescription.length).toBe(descriptionCore.length + inserted.length);
  });

  it('puts the 1.5 line AND the canary inside the delivered first 2,048 characters', () => {
    const delivered = q15FrontDescription.slice(0, HOST_DESCRIPTION_CAP);
    expect(delivered).toContain(overheatingLine);
    expect(delivered).toContain(q15CanarySentence);
  });

  it('while in words the line sits past the cut — the premise of the comparison', () => {
    expect(descriptionCore.slice(0, HOST_DESCRIPTION_CAP)).not.toContain(overheatingLine);
    expect(descriptionCore.indexOf(overheatingLine)).toBeGreaterThan(HOST_DESCRIPTION_CAP);
  });

  it('keeps the INTERPRETATION copy of the line where it was', () => {
    expect(q15FrontDescription.split(overheatingLine)).toHaveLength(3);
  });

  it('carries a content-free canary no other arm has', () => {
    expect(q15CanarySentence.replace('⟨D7⟩', '')).not.toMatch(/\d|overheat|threshold|risk/i);
    expect(descriptionCore).not.toContain('D7');
  });
});

describe('words-front vs words', () => {
  it('ships the Q15 description', async () => {
    const f = await surface('words-front');
    expect(f.tools.find((t) => t.name === 'get_building_profile')!.description).toBe(q15FrontDescription);
  });

  it('differs in NOTHING else the model can see', async () => {
    const f = await surface('words-front');
    const w = await surface('words');
    const strip = (tools: typeof f.tools) =>
      tools.map((t) => (t.name === 'get_building_profile' ? { ...t, description: '<pinned above>' } : t));
    expect(strip(f.tools)).toEqual(strip(w.tools));
    expect(f.instructions).toBe(w.instructions);
    expect(f.serverName).toBe(w.serverName);
    expect(f.response).toEqual(w.response);
  });
});
