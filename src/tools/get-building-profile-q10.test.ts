import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import { interpretationBlock } from './get-building-profile.js';
import { scopesLine, q10Interpretation } from './get-building-profile-q10.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import type { BagAddress, BagVerblijfsobject, BagPand } from '../clients/bag-client.js';
import type { PandEnergielabelV5 } from '../clients/ep-online-client.js';

/** Q10's arms: one sentence, byte-identical; only its FORM in the response varies. */
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
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}
const lookup = { postcode: '3543AR', huisnummer: 1 };
const ARMS = ['q10-prose', 'q10-addressed', 'q10-triggered'] as const;

describe('Q10 arms', () => {
  it('slice the scopes sentence out of interpretationBlock', () => {
    expect(interpretationBlock).toContain(scopesLine);
    expect(scopesLine).toContain('Use the EP-Online area as the denominator');
  });

  it('carry the SAME sentence in every form', () => {
    const p = { oppervlakte_m2: 100, gebruiksoppervlakte_thermische_zone_m2: 92 };
    expect(q10Interpretation('prose', p)).toBe(scopesLine);
    const a = q10Interpretation('addressed', p) as Array<Record<string, unknown>>;
    const t = q10Interpretation('triggered', p) as Array<Record<string, unknown>>;
    expect(a[0].meaning).toBe(scopesLine);
    expect(t[0].meaning).toBe(scopesLine);
    expect(a[0]).not.toHaveProperty('triggered_by');
    expect(t[0].triggered_by).toContain('100');
  });

  it('omit triggered_by when the two areas agree', () => {
    const t = q10Interpretation('triggered', { oppervlakte_m2: 92, gebruiksoppervlakte_thermische_zone_m2: 92 }) as Array<Record<string, unknown>>;
    expect(t[0]).not.toHaveProperty('triggered_by');
  });

  it("have identical listings, instructions and server names", async () => {
    const ref = await connectArm('q10-prose');
    for (const v of ARMS) {
      const x = await connectArm(v);
      expect((await x.listTools()).tools).toEqual((await ref.listTools()).tools);
      expect(x.getInstructions()).toBe(ref.getInstructions());
      expect(x.getServerVersion()?.name).toBe(ref.getServerVersion()?.name);
    }
  });

  it('return the same profile fields, differing only in interpretation', async () => {
    const outs = await Promise.all(ARMS.map(async (v) => ((await (await connectArm(v)).callTool({ name: 'get_building_profile', arguments: lookup })).structuredContent) as Record<string, unknown>));
    const strip = (o: Record<string, unknown>) => { const { interpretation, ...rest } = o; void interpretation; return rest; };
    expect(strip(outs[1])).toEqual(strip(outs[0]));
    expect(strip(outs[2])).toEqual(strip(outs[0]));
  });
});
