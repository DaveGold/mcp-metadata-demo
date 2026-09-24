/** The app tools' checks on a finished call, and the render_chart refusal of an unplaced line. */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { chartAlerts, mapAlerts, tableAlerts } from './app-tools-best.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function connect(variant: 'best' | 'rich') {
  const server = createServer({ variant, bagClient: noBag, epOnlineClient: noEp });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'app-tools-test', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}
const textOf = (r: { content: unknown }) => (r.content as { text: string }[])[0].text;

describe('chartAlerts', () => {
  it('flags a pie above 5 slices, a line above 5 series and an overfull radar', () => {
    expect(chartAlerts({ type: 'pie', labels: [1, 2, 3, 4, 5, 6] })[0]).toMatch(/6 slices/);
    expect(chartAlerts({ type: 'pie', labels: [1, 2, 3, 4, 5] })).toEqual([]);
    expect(chartAlerts({ type: 'line', datasets: Array(6).fill({}) })[0]).toMatch(/6 series/);
    expect(chartAlerts({ type: 'radar', datasets: Array(4).fill({}), labels: [1, 2, 3] })[0]).toMatch(/radar/);
  });

  it('flags a metered target line — Paris Proof, WEii — whatever its casing', () => {
    for (const content of ['Paris Proof', 'paris proof 2040', 'WEii Paris Proof', 'weii-klasse']) {
      const a = chartAlerts({ type: 'bar', options: { annotations: [{ label: { content } }] } });
      expect(a, content).toHaveLength(1);
      expect(a[0]).toMatch(/MEASURED/);
    }
    expect(chartAlerts({ type: 'bar', options: { annotations: [{ label: { content: 'BENG-1 max' } }] } })).toEqual([]);
  });
});

describe('tableAlerts', () => {
  it('flags an energy header without "calculated", in headers and in a transposed first column', () => {
    const cols = [
      { key: 'adres', header: 'Address' },
      { key: 'ep2', header: 'EP-2 primary fossil energy (kWh/m²)' },
    ];
    expect(tableAlerts(cols, [])[0]).toMatch(/EP-2 primary fossil energy/);
    expect(tableAlerts([{ key: 'ep2', header: 'EP-2 berekend (kWh/m²)' }], [])).toEqual([]);
    const transposed = [
      { key: 'field', header: 'Figure' },
      { key: 'a', header: 'Mahlerlaan' },
    ];
    expect(tableAlerts(transposed, [['EP-1 energy demand (kWh/m²)', 81.68]])[0]).toMatch(/EP-1 energy demand/);
    expect(
      tableAlerts(transposed, [
        ['Energy label', 'A'],
        ['Bouwjaar', 1999],
      ]),
    ).toEqual([]);
    // Measured data the user brings is not a label figure: only per-m² energy figures and register names are.
    expect(
      tableAlerts(
        [
          { key: 'e', header: 'Energy use (MWh/year)' },
          { key: 'c', header: 'CO₂ (t/year)' },
        ],
        [],
      ),
    ).toEqual([]);
    expect(tableAlerts([{ key: 'w', header: 'Heat demand (warmtebehoefte)' }], [])[0]).toMatch(/warmtebehoefte/);
    expect(tableAlerts([{ key: 'c', header: 'CO₂ emissions (kg/m²)' }], [])[0]).toMatch(/CO₂ emissions/);
    expect(tableAlerts([{ key: 'p', header: 'EP₂ Primary Fossil Energy (kWh/m²)' }], [])[0]).toMatch(/EP₂/);
  });
});

describe('mapAlerts', () => {
  it('names swapped and out-of-country markers, and passes Dutch ones', () => {
    expect(mapAlerts([{ lat: 52.34, lng: 4.87, label: 'Mahlerlaan' }])).toEqual([]);
    expect(mapAlerts([{ lat: 4.87, lng: 52.34, label: 'Mahlerlaan' }])[0]).toMatch(/swapped/);
    expect(mapAlerts([{ lat: 48.85, lng: 2.35, label: 'Paris' }])[0]).toMatch(/outside the Netherlands/);
  });
});

describe('render_table on the wire', () => {
  const table = (header: string) => ({
    title: 't',
    columns: [
      { key: 'adres', header: 'Address' },
      { key: 'ep2', header, type: 'number' },
    ],
    data: [['Mahlerlaan 10', 179.06]],
  });

  it('best refuses a label figure headed as consumption, and renders it once the header says calculated', async () => {
    const client = await connect('best');
    const bad = await client.callTool({
      name: 'render_table',
      arguments: table('EP-2 primary fossil energy (kWh/m²)'),
    });
    expect(bad.isError).toBe(true);
    expect(textOf(bad)).toMatch(/^Not rendered\..*CALCULATED/);
    const good = await client.callTool({ name: 'render_table', arguments: table('EP-2 berekend (kWh/m²)') });
    expect(good.isError).toBeFalsy();
    expect(JSON.parse(textOf(good)).interpretation.alerts).toEqual([]);
  });

  it('rich still renders it: the older tiers keep their behaviour', async () => {
    const r = await (
      await connect('rich')
    ).callTool({ name: 'render_table', arguments: table('EP-2 primary fossil energy (kWh/m²)') });
    expect(r.isError).toBeFalsy();
  });
});

describe('render_chart on the wire', () => {
  const bar = {
    type: 'bar',
    title: 'EP-2 berekend',
    labels: ['a', 'b'],
    datasets: [['EP-2', [120, 180]]],
  };

  it('best returns interpretation first, with the alert for a Paris Proof line', async () => {
    const client = await connect('best');
    const r = await client.callTool({
      name: 'render_chart',
      arguments: {
        ...bar,
        options: { annotations: [{ type: 'line', scaleID: 'y', value: 70, label: { content: 'Paris Proof' } }] },
      },
    });
    const body = JSON.parse(textOf(r));
    expect(Object.keys(body)[0]).toBe('interpretation');
    expect(body.interpretation.alerts[0]).toMatch(/MEASURED/);
  });

  it('refuses a line annotation without scaleID instead of drawing nothing, on every tier', async () => {
    for (const variant of ['best', 'rich'] as const) {
      const client = await connect(variant);
      const r = await client.callTool({
        name: 'render_chart',
        arguments: { ...bar, options: { annotations: [{ type: 'line', value: 150 }] } },
      });
      expect(r.isError, variant).toBe(true);
      expect(textOf(r)).toMatch(/scaleID/);
    }
  });

  it('best never offers Paris Proof as an annotation example', async () => {
    const { tools } = await (await connect('best')).listTools();
    const chart = tools.find((t) => t.name === 'render_chart')!;
    expect(JSON.stringify(chart.inputSchema)).not.toMatch(/Paris Proof target|value:70 for Paris Proof/);
  });
});
