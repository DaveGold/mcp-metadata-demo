import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { descriptionCore, interpretationBlock } from './get-building-profile.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import type { BagAddress, BagVerblijfsobject, BagPand } from '../clients/bag-client.js';
import type { PandEnergielabelV5 } from '../clients/ep-online-client.js';

/**
 * The `inline` arm is the CHANNEL test: the same prose the `words` arm puts in its
 * DESCRIPTION, delivered in the RESPONSE instead. It measures nothing unless two
 * things hold exactly, and both are easy to break by a well-meaning edit:
 *
 *   1. its description is byte-identical to `schema`'s, so `schema -> inline`
 *      differs in the channel and nothing else;
 *   2. the prose it ships is byte-identical to the block inside `words`'
 *      description, so `schema -> words` and `schema -> inline` carry the same text.
 *
 * These tests fail loudly if either drifts. See evals/open-questions.md, Q1.
 */

const SCHEMA_TIER_DESCRIPTION = 'Look up a Dutch building by postcode and house number.';

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

async function connectArm(variant: 'inline' | 'schema' | 'words'): Promise<Client> {
  const server = createServer({ variant, bagClient: stubBag(), epOnlineClient: stubEpOnline() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

async function describeGetBuildingProfile(variant: 'inline' | 'schema' | 'words'): Promise<string> {
  const client = await connectArm(variant);
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === 'get_building_profile');
  expect(tool, `${variant} must expose get_building_profile`).toBeDefined();
  return tool!.description ?? '';
}

describe('get_building_profile — inline variant (the channel arm)', () => {
  it('has a description BYTE-IDENTICAL to the schema tier', async () => {
    // If this fails, `schema -> inline` is measuring the description as well as
    // the channel, and the arm is worthless.
    const inline = await describeGetBuildingProfile('inline');
    const schema = await describeGetBuildingProfile('schema');

    expect(inline).toBe(schema);
    expect(inline).toBe(SCHEMA_TIER_DESCRIPTION);
  });

  it('does NOT carry the interpretation prose in its description', async () => {
    // The whole point: the prose is in the response, not here.
    const inline = await describeGetBuildingProfile('inline');
    expect(inline).not.toContain('INTERPRETATION');
    expect(inline.length).toBeLessThan(200);
  });

  it('ships in the RESPONSE the exact bytes `words` ships in its DESCRIPTION', async () => {
    // The comparison only means anything if the text is the same. `interpretationBlock`
    // is the constant `descriptionCore` is composed from, so this is guarded by
    // construction — this test proves the composition has not been broken.
    const wordsDescription = await describeGetBuildingProfile('words');
    expect(wordsDescription).toBe(descriptionCore);
    expect(wordsDescription).toContain(interpretationBlock);

    const client = await connectArm('inline');
    const result = await client.callTool({
      name: 'get_building_profile',
      arguments: { postcode: '3543AR', huisnummer: 1 },
    });

    const structured = result.structuredContent as { interpretation?: string } | undefined;
    expect(structured?.interpretation).toBe(interpretationBlock);
  });

  it('returns NO alerts — it is a delivery test, not a computation one', async () => {
    // `words -> rich` must remain the only step that adds server-side computation.
    const client = await connectArm('inline');
    const result = await client.callTool({
      name: 'get_building_profile',
      arguments: { postcode: '3543AR', huisnummer: 1 },
    });

    const structured = result.structuredContent as Record<string, unknown> | undefined;
    expect(structured).toBeDefined();
    expect(structured).not.toHaveProperty('alerts');
  });

  it('returns the same building fields as the words arm, plus exactly one', async () => {
    // Any other divergence in the payload would be a second variable.
    const inlineClient = await connectArm('inline');
    const wordsClient = await connectArm('words');
    const args = { postcode: '3543AR', huisnummer: 1 };

    const inlineResult = await inlineClient.callTool({ name: 'get_building_profile', arguments: args });
    const wordsResult = await wordsClient.callTool({ name: 'get_building_profile', arguments: args });

    const inlineKeys = Object.keys(inlineResult.structuredContent as object).sort();
    const wordsKeys = Object.keys(wordsResult.structuredContent as object).sort();

    expect(inlineKeys.filter((k) => k !== 'interpretation')).toEqual(wordsKeys);
    expect(inlineKeys).toContain('interpretation');
  });
});
