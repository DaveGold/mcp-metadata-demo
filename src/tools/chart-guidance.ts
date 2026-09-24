/**
 * Chart guidance on demand — an alternative to a large render_chart input schema.
 *
 * The input schema is delivered in full and re-sent on every turn, for every tool
 * (evals/results/2026-09-24-input-schema-delivery.json). A bar chart does not need the payload
 * shapes of sankey, matrix, treemap and graph, so this variant keeps render_chart's schema small:
 * the decision tree that picks the type, and plain labels + tuple datasets. Every other shape comes
 * from get_chart_guidance(type), which render_chart's `type` makes a REQUIRED first call (a hint
 * alone is not followed: evals/results/2026-09-23-q8b-guidance-discovery.json). The handler still
 * validates the full shape (the lean schema), and a mismatch is refused with the shape for that
 * type in the message.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { requestContext } from '../shared/log-context.js';
import { writeToolCallLog } from '../shared/log-store.js';
import { CHART_DECISION_TREE } from './app-tools-best.js';
import { bestChartInputSchema } from './render-chart-schema-best.js';

export const CHART_TYPES = [
  'bar',
  'line',
  'pie',
  'doughnut',
  'radar',
  'polarArea',
  'bubble',
  'scatter',
  'sankey',
  'matrix',
  'treemap',
  'boxplot',
  'funnel',
  'graph',
] as const;
type ChartType = (typeof CHART_TYPES)[number];

interface Guidance {
  payload: string;
  example: Record<string, unknown>;
  rules: string;
}

const series = 'labels: one per value; datasets: [["<label with unit>", [n, n, …]]]';

export const CHART_GUIDANCE: Record<ChartType, Guidance> = {
  bar: {
    payload: series,
    example: { type: 'bar', labels: ['P-101', 'P-102'], datasets: [['Uren', [412, 388]]] },
    rules:
      'A ranking or comparison of categories. Sort descending for a ranking; options.indexAxis "y" above 8 categories.',
  },
  line: {
    payload: series,
    example: { type: 'line', labels: ['2024-01', '2024-02'], datasets: [['kWh', [1180, 1105]]] },
    rules: 'A trend over continuous time or numbers. At most 5 series.',
  },
  pie: {
    payload: series + ' (one dataset)',
    example: { type: 'pie', labels: ['Elektriciteit', 'Gas', 'Warmte'], datasets: [['Aandeel (%)', [70, 25, 5]]] },
    rules: 'Shares of one whole, at most 5 slices (aggregate the rest into "overig").',
  },
  doughnut: {
    payload: series + ' (one dataset)',
    example: {
      type: 'doughnut',
      title: 'Hernieuwbaar — 1.240 MWh',
      labels: ['Hernieuwbaar', 'Overig'],
      datasets: [['Aandeel (%)', [38, 62]]],
    },
    rules: 'Shares of one whole with a total or KPI to show (put it in the title); at most 5 slices.',
  },
  radar: {
    payload: series + ' (one dataset per item)',
    example: {
      type: 'radar',
      labels: ['Isolatie', 'Ventilatie', 'Verwarming'],
      datasets: [
        ['A', [80, 65, 70]],
        ['B', [50, 85, 60]],
      ],
    },
    rules: 'One to three items scored on 3–6 measures on one scale.',
  },
  polarArea: {
    payload: series + ' (one dataset)',
    example: {
      type: 'polarArea',
      labels: ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'],
      datasets: [['Gas (m³)', [412, 398, 405, 401, 380, 150, 140]]],
    },
    rules: 'A cycle (weekdays, hours, months) where the question is about the cycle.',
  },
  bubble: {
    payload: 'datasets: [{label, scatterData: [{x, y, r}]}], r in pixels 5–40 (scale the third measure); no labels',
    example: {
      type: 'bubble',
      datasets: [
        {
          label: 'Gebouwen',
          scatterData: [
            { x: 4200, y: 610, r: 15 },
            { x: 1800, y: 310, r: 7 },
          ],
        },
      ],
    },
    rules: 'Three numeric measures per item: x, y and size.',
  },
  scatter: {
    payload: 'datasets: [{label, scatterData: [{x, y}]}]; no labels',
    example: {
      type: 'scatter',
      datasets: [
        {
          label: 'Gas vs graaddagen',
          scatterData: [
            { x: 412, y: 5210 },
            { x: 88, y: 1320 },
          ],
        },
      ],
    },
    rules: 'Two numeric measures per item, and the question is whether they move together.',
  },
  sankey: {
    payload: 'sankey: {flows: [["<from>", "<to>", amount], …]}; no labels, no datasets. Max 200 flows',
    example: {
      type: 'sankey',
      sankey: {
        flows: [
          ['Gas', 'CV-ketel', 400],
          ['CV-ketel', 'Ruimteverwarming', 330],
        ],
      },
    },
    rules: 'Amounts flowing from one stage to the next (source → system → end use), one unit throughout.',
  },
  matrix: {
    payload: 'matrix: {xLabels: [...], yLabels: [...], cells: [["<x>", "<y>", value], …]}; no datasets. Max 2000 cells',
    example: {
      type: 'matrix',
      matrix: {
        xLabels: ['00–04', '04–08'],
        yLabels: ['Ma', 'Di'],
        cells: [
          ['00–04', 'Ma', 40],
          ['04–08', 'Ma', 95],
        ],
      },
    },
    rules: 'Two categorical axes with a value per cell (hour × weekday).',
  },
  treemap: {
    payload:
      'treemap: {columns: [...], tree: [[<group>, …, value], …], key: "<value column>", groups: [<group columns>]}; no datasets',
    example: {
      type: 'treemap',
      treemap: {
        columns: ['fase', 'post', 'kosten'],
        tree: [
          ['Installatie', 'Warmtepompen', 420],
          ['Engineering', 'Ontwerp', 80],
        ],
        key: 'kosten',
        groups: ['fase', 'post'],
      },
    },
    rules: 'A hierarchy with a value per leaf, part-to-whole, 6+ leaves, at most 3 levels.',
  },
  boxplot: {
    payload: 'labels: one per category; datasets: [{label, samples: [[raw values of category 1], [of category 2], …]}]',
    example: {
      type: 'boxplot',
      labels: ['Noord', 'Zuid'],
      datasets: [
        {
          label: 'kWh/dag',
          samples: [
            [410, 420, 395, 430, 980],
            [300, 520, 280, 610, 350],
          ],
        },
      ],
    },
    rules: 'Many samples per category (5+), and the question is about spread or outliers.',
  },
  funnel: {
    payload: series + ' (one dataset, decreasing stages)',
    example: {
      type: 'funnel',
      labels: ['Leads', 'Bezoeken', 'Offertes', 'Orders'],
      datasets: [['Aanvragen', [480, 210, 130, 74]]],
    },
    rules: 'Stages where each is a subset of the one before, at most 20.',
  },
  graph: {
    payload:
      'graph: {layout: "force", nodes: [["<id>", "<label>?"], …], edges: [["<source id>", "<target id>"], …]}; no datasets',
    example: {
      type: 'graph',
      graph: {
        layout: 'force',
        nodes: [
          ['wp', 'Warmtepomp'],
          ['gbs', 'GBS'],
        ],
        edges: [['gbs', 'wp']],
      },
    },
    rules: 'Links between items, many-to-many. layout is required: force, or tree/dendrogram for a strict hierarchy.',
  },
};

const OPTIONS_GUIDANCE =
  'options (all optional): indexAxis "y" (horizontal bars), stacked, showLegend, yAxisLabel ("kWh"), xAxisLabel, ' +
  'annotations (bar, line, scatter, bubble, matrix): [{type:"line", scaleID:"y", value:50, label:{content:"…", display:true}}]; scaleID is required for a line. ' +
  'Draw a target only against data of the same kind: a calculated label figure never against a metered target (Paris Proof, WEii).';

/** The small render_chart schema of this variant. */
export const guidedChartInputSchema = {
  type: z
    .enum(CHART_TYPES)
    .describe(
      CHART_DECISION_TREE.replace(/Per-type rules:\n$/, '') +
        'REQUIRED: for any chart other than a plain bar or line chart (and for any option, such as a target line), call get_chart_guidance with the type first. It returns the exact payload.',
    ),
  title: z.string().optional().describe('Short title, in the language of the conversation.'),
  labels: z.array(z.string()).optional().describe('One label per value.'),
  datasets: z
    .array(z.union([z.array(z.unknown()), z.looseObject({ label: z.string() })]))
    .optional()
    .describe('bar and line: [["Gas (m³)", [412, 352, 301]]]. Other shapes: get_chart_guidance.'),
  sankey: z.record(z.string(), z.unknown()).optional().describe('type=sankey only; see get_chart_guidance.'),
  matrix: z.record(z.string(), z.unknown()).optional().describe('type=matrix only; see get_chart_guidance.'),
  treemap: z.record(z.string(), z.unknown()).optional().describe('type=treemap only; see get_chart_guidance.'),
  graph: z.record(z.string(), z.unknown()).optional().describe('type=graph only; see get_chart_guidance.'),
  options: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Axes, stacking, target lines; see get_chart_guidance.'),
  width: z.number().optional(),
  height: z.number().optional(),
  queryIntent: z.string().optional().describe('The business question this call answers. Used for observability.'),
};

const fullShape = z.object(bestChartInputSchema);

/** The full-shape check the small schema no longer does: null when fine, else a refusal carrying the shape. */
export function guidedShapeProblem(args: Record<string, unknown>): string | null {
  const parsed = fullShape.safeParse(args);
  if (parsed.success) return null;
  const type = CHART_TYPES.includes(args.type as ChartType) ? (args.type as ChartType) : 'bar';
  const where = parsed.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  const g = CHART_GUIDANCE[type];
  return `Not rendered: the payload does not fit type=${type} (${where}). Expected: ${g.payload}. Example: ${JSON.stringify(g.example)}`;
}

export function registerGetChartGuidanceTool(server: McpServer): void {
  server.registerTool(
    'get_chart_guidance',
    {
      title: 'Chart guidance',
      description:
        'WHEN TO USE: REQUIRED before render_chart for any chart other than a plain bar or line chart, and before any chart option (a target line, stacking). ' +
        'Returns the exact payload shape, an example call and the rules for one chart type. It fetches no data.',
      inputSchema: { type: z.enum(CHART_TYPES).describe('The chart type you are about to render.') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ type }: { type: ChartType }) => {
      const start = Date.now();
      const ctx = requestContext.getStore();
      if (ctx) {
        await writeToolCallLog({
          sessionId: ctx.sessionId,
          environment: ctx.environment,
          server: 'metadata-demo',
          user: 'unknown',
          userId: 'unknown',
          tool: 'get_chart_guidance',
          connector: 'ChartGuidance',
          queryIntent: `guidance ${type}`,
          filters: [],
          filterCount: 0,
          summaryOnly: false,
          skip: 0,
          take: 0,
          status: 'success',
          rowCount: 1,
          shape: { chartType: type },
          hasMore: false,
          durationMs: Date.now() - start,
          errorType: null,
        });
      }
      const g = CHART_GUIDANCE[type];
      const text = JSON.stringify({
        type,
        payload: g.payload,
        example: g.example,
        rules: g.rules,
        options: OPTIONS_GUIDANCE,
      });
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
