import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import type { BagAddress, BagVerblijfsobject, BagPand } from '../clients/bag-client.js';
import type { PandEnergielabelV5 } from '../clients/ep-online-client.js';

function stubBag(result: {
  addresses: BagAddress[];
  vbo?: BagVerblijfsobject | null;
  pand?: BagPand | null;
}): BagClientLike {
  return {
    findAddress: async () => result.addresses,
    getVerblijfsobject: async () => result.vbo ?? null,
    getPand: async () => result.pand ?? null,
  };
}

function stubEpOnline(labels: PandEnergielabelV5[]): EpOnlineClientLike {
  return { getByBagVboId: async () => labels };
}

const HAPPY_BAG = stubBag({
  addresses: [
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
  ],
  vbo: {
    identificatie: '0344010000000001',
    oppervlakte: 500,
    gebruiksdoel: ['kantoorfunctie'],
    pandLinks: ['https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items/0344100000000001'],
    coordinates: [5.12, 52.08],
    status: 'Verblijfsobject in gebruik',
  },
  pand: {
    identificatie: '0344100000000001',
    bouwjaar: 1988,
    status: 'Pand in gebruik',
    aantalVerblijfsobjecten: 1,
  },
});

const HAPPY_EP = stubEpOnline([
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
]);

async function connectMinimal(
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): Promise<Client> {
  const server = createServer({ variant: 'minimal', bagClient, epOnlineClient });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('get_building_profile — minimal variant (the ablation)', () => {
  it('exposes the same tool set as rich, but every tool has minimal instructions', async () => {
    const client = await connectMinimal(HAPPY_BAG, HAPPY_EP);

    const { tools } = await client.listTools();
    // Same tools as the rich tier (minus the app-internal fetch_image helper) — the
    // only variable is the metadata, not the tool set.
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_building_profile',
      'render_chart',
      'render_map',
      'render_table',
    ]);

    const bp = tools.find((t) => t.name === 'get_building_profile')!;
    // The whole point of the tier: no rich prose, no output schema.
    expect(bp.description).toBe('Look up a Dutch building by postcode and house number.');
    expect(bp.outputSchema).toBeUndefined();

    // The render apps are present but stripped to one-sentence descriptions.
    expect(tools.find((t) => t.name === 'render_chart')!.description).toBe('Render data as a chart.');
    expect(tools.find((t) => t.name === 'render_table')!.description).toBe('Render data as a table.');
    expect(tools.find((t) => t.name === 'render_map')!.description).toBe('Render data as a map with markers.');

    await client.close();
  });

  it('returns the same data as the rich tier but WITHOUT structuredContent or alerts', async () => {
    const client = await connectMinimal(HAPPY_BAG, HAPPY_EP);

    const response = await client.callTool({
      name: 'get_building_profile',
      arguments: { postcode: '3543AR', huisnummer: 1 },
    });

    expect(response.isError ?? false).toBe(false);
    // No output schema → no structuredContent. Result is text only.
    expect(response.structuredContent).toBeUndefined();

    const text = (response.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text) as Record<string, unknown>;

    // Data is identical to the rich tier...
    expect(parsed.bouwjaar).toBe(1988);
    expect(parsed.energielabel).toBe('C');
    expect(parsed.gemeente).toBe('Utrecht');
    // ...but the interpretation layer is gone: no curated alerts.
    expect('alerts' in parsed).toBe(false);

    await client.close();
  });
});
