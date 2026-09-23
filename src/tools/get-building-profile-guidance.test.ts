import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import { derivedFiguresBlock } from './get-building-profile.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import type { BagAddress, BagVerblijfsobject, BagPand } from '../clients/bag-client.js';
import type { PandEnergielabelV5 } from '../clients/ep-online-client.js';
import { guidanceDescription, guidancePointer, schemaTierDescription } from './get-building-profile-guidance.js';

/**
 * Q8's arm must ship the recipe by ONE channel only, the no-argument call, and be
 * `inline-recipe`'s neighbour in everything else. These tests pin that.
 */

function stubBag(): BagClientLike {
  const addresses: BagAddress[] = [
    {
      nummeraanduidingId: '0344200000000001',
      vboId: '0344010000000001',
      street: 'Middenwetering',
      houseNumber: 1,
      houseLetter: null,
      houseNumberAddition: null,
      postcode: '3543AR',
      city: 'Utrecht',
      weergavenaam: 'Middenwetering 1, 3543AR Utrecht',
      gemeente: 'Utrecht',
      provincie: 'Utrecht',
    },
  ];
  const vbo: BagVerblijfsobject = {
    identificatie: '0344010000000001',
    oppervlakte: 500,
    gebruiksdoel: ['kantoorfunctie'],
    pandLinks: ['https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items/0344100000000001'],
    coordinates: [5.12, 52.08],
    status: 'Verblijfsobject in gebruik',
  };
  const pand: BagPand = {
    identificatie: '0344100000000001',
    bouwjaar: 1988,
    status: 'Pand in gebruik',
    aantalVerblijfsobjecten: 1,
  };
  return {
    findAddress: async () => addresses,
    getVerblijfsobject: async () => vbo,
    getPand: async () => pand,
  };
}

function stubEpOnline(): EpOnlineClientLike {
  const labels: PandEnergielabelV5[] = [
    {
      Pand_opname_id: 1,
      Energieklasse: 'C',
      Geldig_tot: '2030-01-01T00:00:00Z',
      Opnamedatum: '2020-01-01T00:00:00Z',
      Registratiedatum: '2020-01-02T00:00:00Z',
      Berekeningstype: 'NEN 7120',
      Gebouwklasse: 'Utiliteitsbouw',
      Bouwjaar: 1988,
      Status: 'Bestaand',
      Op_basis_van_referentiegebouw: false,
      EnergieIndex: 1.5,
      Certificaathouder: 'Test Adviseur BV',
    },
  ];
  return { getByBagVboId: async () => labels };
}

async function connectArm(variant: ServerVariant): Promise<Client> {
  const server = createServer({ variant, bagClient: stubBag(), epOnlineClient: stubEpOnline() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

const lookup = { postcode: '3543AR', huisnummer: 1 };

describe('guidance-recipe arm (Q8)', () => {
  it("describes itself as schema's one-liner plus one pointer sentence", async () => {
    const client = await connectArm('guidance-recipe');
    const tool = (await client.listTools()).tools.find((t) => t.name === 'get_building_profile')!;
    expect(tool.description).toBe(guidanceDescription);
    expect(guidanceDescription.startsWith(schemaTierDescription + ' ')).toBe(true);
  });

  it('keeps every word of the recipe out of the description and the pointer', () => {
    for (const s of ['0.95', '8.79', 'DERIVED FIGURES', 'warmtebehoefte', 'thermische_zone', 'SPACE HEATING']) {
      expect(guidanceDescription).not.toContain(s);
    }
    expect(guidancePointer).not.toMatch(/guidance/i);
  });

  it('returns the recipe, byte for byte, from the no-argument call and nothing else', async () => {
    const client = await connectArm('guidance-recipe');
    const result = await client.callTool({ name: 'get_building_profile', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ guidance: derivedFiguresBlock });
  });

  it('returns the same fields as the schema arm on a lookup — no prose, no alerts, no guidance', async () => {
    const guided = await (await connectArm('guidance-recipe')).callTool({ name: 'get_building_profile', arguments: lookup });
    const schema = await (await connectArm('schema')).callTool({ name: 'get_building_profile', arguments: lookup });
    expect(guided.structuredContent).toEqual(schema.structuredContent);
    expect(guided.structuredContent).not.toHaveProperty('interpretation');
    expect(guided.structuredContent).not.toHaveProperty('guidance');
  });

  it('refuses a lookup with only half an address', async () => {
    const client = await connectArm('guidance-recipe');
    const result = await client.callTool({ name: 'get_building_profile', arguments: { postcode: '3543AR' } });
    expect(result.isError).toBe(true);
  });

  it("is inline-recipe's neighbour: every other tool and the instructions are identical", async () => {
    const g = await connectArm('guidance-recipe');
    const r = await connectArm('inline-recipe');
    const others = async (c: Client) =>
      (await c.listTools()).tools.filter((t) => t.name !== 'get_building_profile');
    expect(await others(g)).toEqual(await others(r));
    expect(g.getInstructions()).toBe(r.getInstructions());
  });

  it('keeps "guidance" out of the model-visible server name', async () => {
    const client = await connectArm('guidance-recipe');
    expect(client.getServerVersion()?.name).not.toMatch(/guidance/i);
  });
});
