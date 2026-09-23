import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import type { BagAddress, BagVerblijfsobject, BagPand } from '../clients/bag-client.js';
import type { PandEnergielabelV5 } from '../clients/ep-online-client.js';

/**
 * Q9's position arm must be `inline` in every byte except WHERE `interpretation`
 * sits in the response: first instead of last. These tests pin that.
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

describe('inline-head arm (Q9 position)', () => {
  it("has a tools/list, instructions and server name identical to inline's", async () => {
    const h = await connectArm('inline-head');
    const i = await connectArm('inline');
    expect((await h.listTools()).tools).toEqual((await i.listTools()).tools);
    expect(h.getInstructions()).toBe(i.getInstructions());
    expect(h.getServerVersion()?.name).toBe(i.getServerVersion()?.name);
  });

  it('returns the same building fields and the same interpretation bytes', async () => {
    const h = await (await connectArm('inline-head')).callTool({ name: 'get_building_profile', arguments: lookup });
    const i = await (await connectArm('inline')).callTool({ name: 'get_building_profile', arguments: lookup });
    expect(h.structuredContent).toEqual(i.structuredContent);
  });

  it('emits interpretation as the FIRST key, where inline emits it LAST', async () => {
    const h = await (await connectArm('inline-head')).callTool({ name: 'get_building_profile', arguments: lookup });
    const i = await (await connectArm('inline')).callTool({ name: 'get_building_profile', arguments: lookup });
    const hKeys = Object.keys(h.structuredContent as object);
    const iKeys = Object.keys(i.structuredContent as object);
    expect(hKeys[0]).toBe('interpretation');
    expect(iKeys[iKeys.length - 1]).toBe('interpretation');
    const text = (r: typeof h) => (r.content as { text: string }[])[0].text;
    expect(text(h).indexOf('"interpretation"')).toBeLessThan(text(h).indexOf('"matchStatus"'));
    expect(text(i).indexOf('"interpretation"')).toBeGreaterThan(text(i).indexOf('"matchStatus"'));
  });
});
