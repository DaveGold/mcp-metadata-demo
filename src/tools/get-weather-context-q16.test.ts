import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

/** Q16's arms must list exactly as q10-prose; they differ only in the weather summary (checked on the wire). */
const stubBag = (): BagClientLike =>
  ({ findAddress: async () => [], getVerblijfsobject: async () => null, getPand: async () => null }) as unknown as BagClientLike;
const stubEp = (): EpOnlineClientLike => ({ getByBagVboId: async () => [] }) as unknown as EpOnlineClientLike;
async function connectArm(variant: ServerVariant): Promise<Client> {
  const server = createServer({ variant, bagClient: stubBag(), epOnlineClient: stubEp() });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}

describe('Q16 arms', () => {
  it("list exactly as q10-prose, with the same instructions and server name", async () => {
    const ref = await connectArm('q10-prose');
    for (const v of ['q16-ref', 'q16-computed'] as const) {
      const x = await connectArm(v);
      expect((await x.listTools()).tools).toEqual((await ref.listTools()).tools);
      expect(x.getInstructions()).toBe(ref.getInstructions());
      expect(x.getServerVersion()?.name).toBe(ref.getServerVersion()?.name);
    }
  });
});
