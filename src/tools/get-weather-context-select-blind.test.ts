import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import { blindSelectDescription } from './get-weather-context.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

const stubBag = (): BagClientLike =>
  ({ findAddress: async () => [], getVerblijfsobject: async () => null, getPand: async () => null }) as unknown as BagClientLike;
const stubEp = (): EpOnlineClientLike => ({ getByBagVboId: async () => [] }) as unknown as EpOnlineClientLike;

/** Q11's select-blind arm must be `minimal` minus the select field list, and nothing else. */
async function connectArm(variant: ServerVariant): Promise<Client> {
  const server = createServer({ variant, bagClient: stubBag(), epOnlineClient: stubEp() });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}
// Every record field bar `date` (guessable) and `isForecast`, which the shared `dateTo`
// description mentions on every arm. Disclosed in Q11's build notes; the question needs
// weatherLabel and tempMax, and neither is named anywhere the model is shown.
const FIELDS = ['tempMean', 'tempMin', 'tempMax', 'hdd', 'cdd', 'weightedHdd', 'ghiKwhM2', 'sunshineDurationHours', 'weatherCode', 'weatherLabel'];

describe('select-blind arm (Q11)', () => {
  it("is minimal's listing except the select description", async () => {
    const b = (await (await connectArm('select-blind')).listTools()).tools;
    const m = (await (await connectArm('minimal')).listTools()).tools;
    const strip = (ts: typeof b) =>
      ts.map((t) => {
        if (t.name !== 'get_weather_context') return t;
        const props = { ...(t.inputSchema.properties as Record<string, unknown>) };
        delete props.select;
        return { ...t, inputSchema: { ...t.inputSchema, properties: props } };
      });
    expect(strip(b)).toEqual(strip(m));
    const sel = (b.find((t) => t.name === 'get_weather_context')!.inputSchema.properties as Record<string, { description?: string }>).select;
    expect(sel.description).toBe(blindSelectDescription);
  });

  it('names no output field anywhere the model is shown, outputSchema aside', async () => {
    const w = (await (await connectArm('select-blind')).listTools()).tools.find((t) => t.name === 'get_weather_context')!;
    const visible = JSON.stringify({ description: w.description, inputSchema: w.inputSchema });
    for (const f of FIELDS) expect(visible).not.toMatch(new RegExp(`\\b${f}\\b`));
  });

  it("keeps minimal's server name and instructions", async () => {
    const b = await connectArm('select-blind');
    const m = await connectArm('minimal');
    expect(b.getServerVersion()?.name).toBe(m.getServerVersion()?.name);
    expect(b.getInstructions()).toBe(m.getInstructions());
  });
});
