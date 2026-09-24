import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { descriptionCore, description, calcVsMeasuredLine } from './get-building-profile.js';
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

async function connectArm(
  variant: 'words' | 'rich',
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): Promise<Client> {
  const server = createServer({ variant, bagClient, epOnlineClient });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('get_building_profile — words variant (arm B)', () => {
  it('has the SAME server instructions as rich, minus only the alerts bullet', async () => {
    // The tightest guard on the experiment: if these two strings ever diverge by
    // anything other than the alerts bullet, B->C stops measuring the alerts.
    const words = createServer({ variant: 'words', bagClient: HAPPY_BAG, epOnlineClient: HAPPY_EP });
    const rich = createServer({ variant: 'rich', bagClient: HAPPY_BAG, epOnlineClient: HAPPY_EP });

    const w = words.server.getClientCapabilities, r = rich.server.getClientCapabilities; // touch, keep tsc happy
    expect(typeof w === typeof r).toBe(true);

    const wi = (words as unknown as { _instructions?: string })._instructions
      ?? (words.server as unknown as { _instructions?: string })._instructions;
    const ri = (rich as unknown as { _instructions?: string })._instructions
      ?? (rich.server as unknown as { _instructions?: string })._instructions;

    expect(typeof wi).toBe('string');
    expect(typeof ri).toBe('string');

    const alertsBullet = ri!.split('\n').find((l) => l.startsWith('- Always read the `alerts` array'));
    expect(alertsBullet).toBeDefined();

    // Removing exactly that one line from rich must yield words, byte for byte.
    const richMinusAlerts = ri!.split('\n').filter((l) => l !== alertsBullet).join('\n');
    expect(wi).toBe(richMinusAlerts);
  });

  it('exposes the same tool surface as rich', async () => {
    const wordsClient = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const richClient = await connectArm('rich', HAPPY_BAG, HAPPY_EP);

    const w = (await wordsClient.listTools()).tools.map((t) => t.name).sort();
    const r = (await richClient.listTools()).tools.map((t) => t.name).sort();
    expect(w).toEqual(r);

    await wordsClient.close();
    await richClient.close();
  });

  it('exposes the same six tools as the other arms', async () => {
    const client = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'fetch_image',
      'get_building_profile',
      'get_tool_call_log',
      'get_weather_context',
      'render_chart',
      'render_map',
      'render_table',
    ]);
    await client.close();
  });

  it('carries the rich prose verbatim, minus the ALERTS paragraph', async () => {
    const client = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const bp = (await client.listTools()).tools.find((t) => t.name === 'get_building_profile')!;

    // Identical wording to the rich tier — any divergence would confound A→B.
    expect(bp.description).toBe(descriptionCore);
    // Since 2026-09-24 (Q21) rich ALSO carries the CALCULATED vs MEASURED line up front, inside the
    // 2,048 cut. That is the one allowed difference: remove it and rich is words + ALERTS again.
    // It means rich vs words is no longer a one-variable rung on ep1/ep2 questions after that date.
    expect(description.replace(calcVsMeasuredLine + '\n\n', '').startsWith(descriptionCore)).toBe(true);

    // Every guidance block the rich tier has, except the promise of alerts.
    expect(bp.description).toContain('WHEN NOT TO USE:');
    expect(bp.description).toContain('QUERY STRATEGY:');
    expect(bp.description).toContain('INTERPRETATION:');
    expect(bp.description).not.toContain('ALERTS:');

    await client.close();
  });

  it('keeps the full input schema, including the params the thin arm lacks', async () => {
    const client = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const bp = (await client.listTools()).tools.find((t) => t.name === 'get_building_profile')!;
    const props = (bp.inputSchema as { properties: Record<string, unknown> }).properties;

    // huisletter/toevoeging are absent from the minimal schema — arm A cannot
    // even express the disambiguating call. Arm B can.
    expect(Object.keys(props).sort()).toEqual([
      'huisletter',
      'huisnummer',
      'postcode',
      'queryIntent',
      'toevoeging',
    ]);
    await client.close();
  });

  it('has an output schema, but one with no alerts field', async () => {
    const client = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const bp = (await client.listTools()).tools.find((t) => t.name === 'get_building_profile')!;

    expect(bp.outputSchema).toBeDefined();
    const props = (bp.outputSchema as { properties: Record<string, unknown> }).properties;
    expect('alerts' in props).toBe(false);
    // ...but the described fields survive, which is the half being tested.
    expect('berekend_energieverbruik_kwh_m2' in props).toBe(true);
    expect('warmtebehoefte_kwh_m2' in props).toBe(true);

    await client.close();
  });

  it('returns the same data as the rich tier, as structuredContent, without alerts', async () => {
    const words = await connectArm('words', HAPPY_BAG, HAPPY_EP);
    const rich = await connectArm('rich', HAPPY_BAG, HAPPY_EP);
    const args = { postcode: '3543AR', huisnummer: 1 };

    const wordsRes = await words.callTool({ name: 'get_building_profile', arguments: args });
    const richRes = await rich.callTool({ name: 'get_building_profile', arguments: args });

    const w = wordsRes.structuredContent as Record<string, unknown>;
    const r = richRes.structuredContent as Record<string, unknown>;

    // Unlike arm A, arm B DOES get structuredContent.
    expect(w).toBeDefined();
    expect('alerts' in w).toBe(false);
    expect('alerts' in r).toBe(true);

    // Every other field is byte-identical: the data is the same, only the
    // computed layer differs. That is the whole premise of B→C.
    const { alerts: _dropped, ...richWithoutAlerts } = r;
    expect(w).toEqual(richWithoutAlerts);

    await words.close();
    await rich.close();
  });
});
