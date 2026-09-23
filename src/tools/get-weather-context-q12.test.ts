import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import { partialPeriodRule } from './get-weather-context.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

/** Q12's weather arms must differ from `minimal` ONLY in where the rule goes. */
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
const weather = async (v: ServerVariant) =>
  (await (await connectArm(v)).listTools()).tools.find((t) => t.name === 'get_weather_context')!;

describe('Q12 weather arms', () => {
  it('the rule is in the tool description of wx-desc only, and well inside 2,048 chars', async () => {
    const d = await weather('wx-desc');
    expect(d.description).toContain(partialPeriodRule);
    expect(d.description!.indexOf(partialPeriodRule) + partialPeriodRule.length).toBeLessThan(2048);
    for (const v of ['wx-none', 'wx-resp'] as const) expect((await weather(v)).description).not.toContain('gasNormalizationFactor');
  });

  it("every arm is minimal's listing except wx-desc's weather description", async () => {
    const m = (await (await connectArm('minimal')).listTools()).tools;
    for (const v of ['wx-none', 'wx-desc', 'wx-resp'] as const) {
      const x = (await (await connectArm(v)).listTools()).tools;
      const strip = (ts: typeof x) => ts.map((t) => (t.name === 'get_weather_context' ? { ...t, description: '' } : t));
      expect(strip(x)).toEqual(strip(m));
    }
  });

  it("keeps minimal's server name and instructions", async () => {
    const m = await connectArm('minimal');
    for (const v of ['wx-none', 'wx-desc', 'wx-resp'] as const) {
      const x = await connectArm(v);
      expect(x.getServerVersion()?.name).toBe(m.getServerVersion()?.name);
      expect(x.getInstructions()).toBe(m.getInstructions());
    }
  });
});
