/**
 * Every enum value a model can choose must be reachable: the payload the schema's own describe
 * prescribes for it has to pass the input schema AND the handler. Three chart types once failed
 * this on every tier (evals/results/2026-09-24-q24-chart-paths-pilot.json), and the refusals never
 * reached the server log, because schema validation runs before the handler.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ServerVariant } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function connect(variant: ServerVariant) {
  const server = createServer({ variant, bagClient: noBag, epOnlineClient: noEp });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'reachability', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  try {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as { text?: string }[])[0]?.text ?? '';
    return { ok: !r.isError, text };
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : String(e) };
  }
}

const labels3 = ['a', 'b', 'c'];
/** The payload each chart type's describe prescribes, smallest valid form. */
const CHART_PAYLOADS: Record<string, Record<string, unknown>> = {
  bar: { labels: labels3, datasets: [['kWh', [3, 2, 1]]] },
  line: { labels: labels3, datasets: [['kWh', [1, 2, 3]]] },
  pie: { labels: labels3, datasets: [['share', [70, 25, 5]]] },
  doughnut: { labels: ['renewable', 'other'], datasets: [['share', [38, 62]]] },
  radar: {
    labels: ['insulation', 'ventilation', 'heating'],
    datasets: [
      ['A', [80, 65, 70]],
      ['B', [50, 85, 60]],
    ],
  },
  polarArea: { labels: ['Mon', 'Tue', 'Wed'], datasets: [['m³', [412, 398, 405]]] },
  bubble: {
    datasets: [
      {
        label: 'buildings',
        scatterData: [
          { x: 4200, y: 610, r: 12 },
          { x: 1800, y: 310, r: 6 },
        ],
      },
    ],
  },
  scatter: {
    datasets: [
      {
        label: 'gas vs HDD',
        scatterData: [
          { x: 412, y: 5210 },
          { x: 88, y: 1320 },
        ],
      },
    ],
  },
  sankey: {
    sankey: {
      flows: [
        ['grid', 'heat pump', 250],
        ['heat pump', 'space heating', 250],
      ],
    },
  },
  matrix: {
    matrix: {
      xLabels: ['00', '04'],
      yLabels: ['Mon', 'Tue'],
      cells: [
        ['00', 'Mon', 40],
        ['04', 'Mon', 95],
        ['00', 'Tue', 42],
        ['04', 'Tue', 98],
      ],
    },
  },
  treemap: {
    treemap: {
      columns: ['phase', 'item', 'cost'],
      tree: [
        ['Engineering', 'design', 80],
        ['Installation', 'heat pumps', 420],
      ],
      key: 'cost',
      groups: ['phase', 'item'],
    },
  },
  boxplot: {
    labels: ['North', 'South'],
    datasets: [
      {
        label: 'kWh/day',
        samples: [
          [410, 420, 395, 430, 415],
          [300, 520, 280, 610, 350],
        ],
      },
    ],
  },
  funnel: { labels: ['leads', 'visits', 'quotes', 'orders'], datasets: [['enquiries', [480, 210, 130, 74]]] },
  graph: {
    graph: {
      layout: 'force',
      nodes: [['hp'], ['buffer'], ['bms']],
      edges: [
        ['hp', 'buffer'],
        ['bms', 'hp'],
      ],
    },
  },
};

/** One column per table column type, with the data shape its describe prescribes. */
const TABLE_COLUMNS: { type: string; col: Record<string, unknown>; value: unknown }[] = [
  { type: 'text', col: {}, value: 'Mahlerlaan 10' },
  { type: 'number', col: {}, value: 1234.5 },
  { type: 'currency', col: {}, value: 1234.5 },
  { type: 'date', col: {}, value: '2024-03-01' },
  { type: 'percentage', col: {}, value: 0.15 },
  { type: 'boolean', col: {}, value: true },
  { type: 'badge', col: { badgeMap: { A: { label: 'A', color: 'green' } } }, value: 'A' },
  { type: 'icon', col: {}, value: 'check-circle' },
  { type: 'sparkline', col: {}, value: [3, 4, 2, 5] },
  { type: 'progress', col: {}, value: 0.6 },
  { type: 'trend', col: {}, value: { value: 1234, delta: 0.12 } },
  { type: 'multi_badge', col: { badgeMap: { hp: { label: 'heat pump', color: 'blue' } } }, value: ['hp'] },
  { type: 'link', col: {}, value: { label: 'EP-Online', href: 'https://www.ep-online.nl' } },
  { type: 'rating', col: {}, value: 3.5 },
  { type: 'image', col: {}, value: 'data:image/png;base64,iVBORw0KGgo=' },
];

describe.each(['best', 'rich', 'best-lean', 'best-guided'] as ServerVariant[])(
  'every enum value is reachable on %s',
  (variant) => {
    it.each(Object.entries(CHART_PAYLOADS))('render_chart type=%s', async (type, payload) => {
      const r = await call(await connect(variant), 'render_chart', { type, title: 't', ...payload });
      expect(r.ok, r.text.slice(0, 300)).toBe(true);
    });

    it('covers every chart type in the enum', async () => {
      const { tools } = await (await connect(variant)).listTools();
      const e = (
        tools.find((t) => t.name === 'render_chart')!.inputSchema as { properties: { type: { enum: string[] } } }
      ).properties.type.enum;
      expect(Object.keys(CHART_PAYLOADS).sort()).toEqual([...e].sort());
    });

    it.each(TABLE_COLUMNS.map((c) => [c.type, c]))('render_table column type=%s', async (type, c) => {
      const col = c as (typeof TABLE_COLUMNS)[number];
      const r = await call(await connect(variant), 'render_table', {
        title: 't',
        columns: [{ key: 'v', header: 'Value', type, ...col.col }],
        data: [{ v: col.value }],
      });
      expect(r.ok, r.text.slice(0, 300)).toBe(true);
    });

    it('covers every table column type in the enum', async () => {
      const { tools } = await (await connect(variant)).listTools();
      const e = (
        tools.find((t) => t.name === 'render_table')!.inputSchema as {
          properties: { columns: { items: { properties: { type: { enum: string[] } } } } };
        }
      ).properties.columns.items.properties.type.enum;
      expect(TABLE_COLUMNS.map((c) => c.type).sort()).toEqual([...e].sort());
    });

    it.each(['car', 'building', 'project', 'pin'])('render_map marker type=%s', async (type) => {
      const r = await call(await connect(variant), 'render_map', {
        title: 't',
        markers: [[52.337, 4.875, 'Mahlerlaan 10', 'label A', type]],
      });
      expect(r.ok, r.text.slice(0, 300)).toBe(true);
    });
  },
);
