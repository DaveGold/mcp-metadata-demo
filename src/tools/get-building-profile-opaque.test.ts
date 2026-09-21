import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { FIELD_MAP, STATUS_MAP, obfuscateProfile } from '../domain/obfuscate.js';
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

async function connectOpaque(
  variant: 'opaque' | 'opaque-words',
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): Promise<Client> {
  const server = createServer({ variant, bagClient, epOnlineClient });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("get_building_profile — opaque arms (A' and B')", () => {
  it('returns terse codes instead of self-describing field names', async () => {
    const client = await connectOpaque('opaque', HAPPY_BAG, HAPPY_EP);
    const res = await client.callTool({
      name: 'get_building_profile',
      arguments: { postcode: '3543AR', huisnummer: 1 },
    });
    const parsed = JSON.parse((res.content as Array<{ text: string }>)[0].text) as Record<string, unknown>;

    // The names that were doing the metadata's job must be gone.
    for (const readable of [
      'gebruiksoppervlakte_thermische_zone_m2',
      'berekeningstype',
      'aantal_verblijfsobjecten',
      'warmtebehoefte_kwh_m2',
      'matchStatus',
    ]) {
      expect(readable in parsed).toBe(false);
    }
    expect('f_ga' in parsed).toBe(true);
    expect('calc_t' in parsed).toBe(true);
    expect('n_vbo' in parsed).toBe(true);

    // matchStatus values are self-describing too, so they are coded as well.
    expect(parsed.st).toBe(STATUS_MAP.exact);

    await client.close();
  });

  it('carries the SAME data as the rich tier, only re-keyed', async () => {
    const opaque = await connectOpaque('opaque', HAPPY_BAG, HAPPY_EP);
    const rich = createServer({ variant: 'rich', bagClient: HAPPY_BAG, epOnlineClient: HAPPY_EP });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const richClient = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([richClient.connect(ct), rich.connect(st)]);

    const args = { postcode: '3543AR', huisnummer: 1 };
    const o = JSON.parse(
      ((await opaque.callTool({ name: 'get_building_profile', arguments: args })).content as Array<{ text: string }>)[0].text
    ) as Record<string, unknown>;
    const r = (await richClient.callTool({ name: 'get_building_profile', arguments: args }))
      .structuredContent as Record<string, unknown>;

    const { alerts: _drop, ...core } = r;
    expect(o).toEqual(obfuscateProfile(core as never));
    // Spot-check that values really are untouched.
    expect(o.bj).toBe(r.bouwjaar);
    expect(o.lbl).toBe(r.energielabel);

    await opaque.close();
    await richClient.close();
  });

  it("differs from opaque-words in the DESCRIPTION and nothing else", async () => {
    const bare = await connectOpaque('opaque', HAPPY_BAG, HAPPY_EP);
    const prose = await connectOpaque('opaque-words', HAPPY_BAG, HAPPY_EP);

    const b = (await bare.listTools()).tools.find((t) => t.name === 'get_building_profile')!;
    const p = (await prose.listTools()).tools.find((t) => t.name === 'get_building_profile')!;

    // The one intended difference.
    expect(b.description).toBe('Look up a Dutch building by postcode and house number.');
    expect(p.description!.length).toBeGreaterThan(2000);
    expect(p.description).toContain('calc_t');
    expect(p.description).toContain('f_ga');

    // Everything else must match, or the comparison measures more than prose.
    expect(p.inputSchema).toEqual(b.inputSchema);
    expect(p.outputSchema).toBeUndefined();
    expect(b.outputSchema).toBeUndefined();

    const args = { postcode: '3543AR', huisnummer: 1 };
    const bp = (await bare.callTool({ name: 'get_building_profile', arguments: args })).content;
    const pp = (await prose.callTool({ name: 'get_building_profile', arguments: args })).content;
    expect(pp).toEqual(bp);

    await bare.close();
    await prose.close();
  });

  it('the prose names every code it explains', async () => {
    // A guide that talks about fields the payload does not carry is its own defect.
    const prose = await connectOpaque('opaque-words', HAPPY_BAG, HAPPY_EP);
    const d = (await prose.listTools()).tools.find((t) => t.name === 'get_building_profile')!.description!;
    for (const code of ['st', 'opp', 'f_ga', 'n_vbo', 'calc_t', 'ei', 'ep1', 'wb', 'to', 'bev', 'co2']) {
      expect(d).toContain(code);
    }
    // ...and no readable name leaks back in, which would give the guide away.
    for (const readable of Object.keys(FIELD_MAP)) {
      if (readable === 'adres') continue;
      expect(d.includes(readable)).toBe(false);
    }
    await prose.close();
  });
});
