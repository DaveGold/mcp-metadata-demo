/**
 * Byte-freeze guard for every measured eval arm (the 14 pre-`best` arms, and `best` after Q19b).
 *
 * Every number in evals/results/ was measured against a specific wire surface:
 * the `tools/list` payload and the server instructions of one arm. Changing an
 * arm's bytes silently makes its old results unreproducible. This test hashes
 * both for each frozen arm; the snapshot was recorded on the commit before the
 * `best` arm was added (base 0986cb8). A diff here means an old arm moved —
 * re-baseline deliberately, never by updating the snapshot to make CI green.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from './server.js';
import type { BagClientLike, EpOnlineClientLike } from './tools/get-building-profile.js';

const FROZEN_ARMS: ServerVariant[] = [
  'rich',
  'words',
  'inline',
  'inline-recipe',
  'inline-conditional',
  'inline-oneline',
  'inline-fact',
  'inline-instruction',
  'words-recipe',
  'schema',
  'minimal',
  'opaque',
  'opaque-words',
  'guidance-recipe',
  // Frozen after Q19b (2026-09-24): measured as the post-fix reference implementation.
  'best',
  // `best` as measured in Q19–Q19d, kept when its app tools were rebuilt (Q22).
  'best-v1',
  // Q23 arm C: best without render_chart's per-type rules.
  'best-no-type-rules',
];

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function wireSurface(variant: ServerVariant): Promise<{ tools: string; instructions: string }> {
  const server = createServer({ variant, bagClient: noBag, epOnlineClient: noEp });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'freeze-test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const listed = await client.listTools();
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const result = {
    tools: sha(JSON.stringify(listed.tools)),
    instructions: sha(client.getInstructions() ?? ''),
  };
  await client.close();
  return result;
}

describe('frozen arms — wire surface unchanged', () => {
  it('tools/list and instructions hash to the recorded snapshot for every pre-best arm', async () => {
    const hashes: Record<string, { tools: string; instructions: string }> = {};
    for (const arm of FROZEN_ARMS) hashes[arm] = await wireSurface(arm);
    expect(hashes).toMatchSnapshot();
  });
});
