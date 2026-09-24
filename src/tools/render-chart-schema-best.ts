/**
 * render_chart's full input shape on best, in few words.
 *
 * best does not send this schema: its handler validates against it (chart-guidance.ts), because the
 * input schema is re-sent on every turn (evals/results/2026-09-24-input-schema-delivery.json) and a
 * bar chart does not need the shapes of sankey, matrix, treemap and graph. It carries the decision
 * path for `type`, the caps that measurably matter, the payload shape per chart type, one example
 * each. The structure is identical to the other tiers' schema (a test pins it); only the words differ.
 */
import { z } from 'zod';
import { CHART_DECISION_TREE } from './app-tools-best.js';

/** The rules that changed a measured choice (a 12-slice pie) or cap a readable chart. */
const TYPE_CAPS =
  '- pie and doughnut: at most 5 slices (aggregate the rest into "overig"); doughnut only with a total or KPI for the centre.\n' +
  '- line: at most 5 series. bar: horizontal above 8 categories.\n' +
  '- radar: at most 3 overlays, 3–6 axes on one scale.\n' +
  '- polarArea: only for a cycle (weekdays, hours, months).\n' +
  '- sankey, matrix, treemap, graph carry their data in their own field; datasets is for the others.';

const nullableNumbers = z.array(z.number().nullable());

export const bestChartInputSchema = {
  type: z
    .enum([
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
    ])
    .describe(CHART_DECISION_TREE + TYPE_CAPS),
  title: z.string().optional().describe('Short title, in the language of the conversation.'),
  labels: z
    .array(z.string())
    .optional()
    .describe(
      'One label per value: categories, months or segments. Required for bar, line, pie, doughnut, radar, polarArea, boxplot and funnel.',
    ),
  datasets: z
    .array(
      z.union([
        z.array(z.union([z.string(), nullableNumbers])).length(2),
        z.object({
          label: z.string().describe('Legend label, with its unit: "Gas (m³)".'),
          data: nullableNumbers.optional().describe('One value per label; null leaves a gap.'),
          spanGaps: z.boolean().optional().describe('line only: draw through null gaps.'),
          scatterData: z
            .array(z.object({ x: z.number(), y: z.number(), r: z.number().optional() }))
            .optional()
            .describe('scatter: [{x, y}]. bubble: [{x, y, r}], r in pixels 5–40.'),
          backgroundColor: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe('Omit for the palette.'),
          borderColor: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe('Omit for the palette.'),
          borderDash: z.array(z.number()).optional().describe('line only: [5,5] marks estimated values.'),
          fill: z.boolean().optional().describe('line only: area under the line.'),
          tension: z.number().optional().describe('line only: 0 straight, 0.3 smooth.'),
          type: z.string().optional().describe('Mixed chart: "line" on a bar chart.'),
          order: z.number().optional().describe('Mixed chart: higher is drawn behind.'),
          samples: z.array(z.array(z.number())).optional().describe('boxplot: one array of raw values per label.'),
          stats: z
            .array(
              z.object({
                min: z.number(),
                q1: z.number(),
                median: z.number(),
                q3: z.number(),
                max: z.number(),
                mean: z.number().optional(),
                outliers: z.array(z.number()).optional(),
                items: z.array(z.number()).optional(),
              }),
            )
            .optional()
            .describe('boxplot: pre-computed stats per label, when no raw values.'),
        }),
      ]),
    )
    .optional()
    .describe(
      'Series. Tuple ["Gas (m³)", [412, 352, 301]] for bar, line, pie, doughnut, radar, polarArea, funnel. ' +
        'Object form for scatter and bubble (scatterData), boxplot (samples or stats), and styling.',
    ),
  sankey: z
    .object({
      flows: z
        .array(
          z.union([
            z.array(z.union([z.string(), z.number()])).length(3),
            z.object({ from: z.string(), to: z.string(), flow: z.number() }),
          ]),
        )
        .describe(
          '[from, to, amount], e.g. [["Gas", "CV-ketel", 400], ["CV-ketel", "Ruimteverwarming", 330]]. Max 200.',
        ),
      labels: z.record(z.string(), z.string()).optional().describe('Display text per node name.'),
      colors: z.record(z.string(), z.string()).optional().describe('Colour per node name.'),
      priority: z.record(z.string(), z.number()).optional().describe('Vertical order per node; lower is higher.'),
      colorMode: z.enum(['gradient', 'from', 'to']).optional().describe('Link colour. Default gradient.'),
    })
    .optional()
    .describe('type=sankey only. Nodes come from the flows.'),
  matrix: z
    .object({
      cells: z
        .array(
          z.union([
            z.array(z.union([z.string(), z.number()])).length(3),
            z.object({ x: z.union([z.string(), z.number()]), y: z.union([z.string(), z.number()]), v: z.number() }),
          ]),
        )
        .describe('[x, y, value], e.g. [["08–12", "Ma", 310]]. Max 2000.'),
      xLabels: z.array(z.string()).optional().describe('x categories in order; required with string x.'),
      yLabels: z.array(z.string()).optional().describe('y categories in order; required with string y.'),
      colorScale: z
        .object({ min: z.string().optional(), max: z.string().optional(), reverse: z.boolean().optional() })
        .optional()
        .describe('Gradient end colours.'),
    })
    .optional()
    .describe('type=matrix only: a value per cell of two categorical axes (hour × weekday).'),
  treemap: z
    .object({
      tree: z
        .array(
          z.union([
            z.array(z.union([z.string(), z.number()])),
            z.record(z.string(), z.union([z.string(), z.number()])),
          ]),
        )
        .describe('Rows, positional with `columns`: [["Installatie", "Warmtepompen", 420]]. Max 500.'),
      columns: z
        .array(z.string())
        .optional()
        .describe('Row positions: ["fase", "post", "kosten"]; required for positional rows.'),
      key: z.string().describe('The value column: "kosten".'),
      groups: z.array(z.string()).optional().describe('Hierarchy, top first, max 3: ["fase", "post"].'),
      labels: z
        .object({
          display: z.boolean().optional(),
          formatter: z.enum(['name', 'name-value', 'name-percent']).optional(),
        })
        .optional()
        .describe('Label format. Default name-value.'),
    })
    .optional()
    .describe('type=treemap only: part-to-whole over a hierarchy.'),
  graph: z
    .object({
      layout: z
        .enum(['force', 'tree', 'dendrogram'])
        .describe(
          'Required. force for a network of dependencies; tree or dendrogram only for a strict parent-child hierarchy.',
        ),
      nodes: z
        .array(
          z.union([
            z.array(z.string()).min(1).max(3),
            z.object({
              id: z.string(),
              label: z.string().optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              group: z.string().optional(),
            }),
          ]),
        )
        .describe('[id] or [id, label] or [id, label, group]: [["wp", "Warmtepomp", "opwek"]]. Max 200.'),
      edges: z
        .array(
          z.union([
            z
              .array(z.union([z.string(), z.number()]))
              .min(2)
              .max(3),
            z.object({ source: z.string(), target: z.string(), weight: z.number().optional() }),
          ]),
        )
        .describe('[source, target] or [source, target, weight], ids from nodes: [["gbs", "wp"]]. Max 500.'),
      directed: z.boolean().optional().describe('Draw arrows.'),
    })
    .optional()
    .describe('type=graph only: links between items.'),
  options: z
    .object({
      indexAxis: z.enum(['x', 'y']).optional().describe('"y" makes a horizontal bar chart.'),
      stacked: z.boolean().optional().describe('Stack series to show a composition.'),
      showLegend: z.boolean().optional(),
      showGrid: z.boolean().optional(),
      aspectRatio: z.number().optional().describe('Default 2; 1 for pie and radar.'),
      yAxisLabel: z.string().optional().describe('Unit: "kWh", "m³", "°C".'),
      xAxisLabel: z.string().optional(),
      annotations: z
        .array(
          z.object({
            type: z.enum(['line', 'box', 'label']),
            scaleID: z.enum(['x', 'y', 'y1']).optional().describe('Required for a line: "y" horizontal, "x" vertical.'),
            value: z
              .union([z.number(), z.string()])
              .optional()
              .describe('A line position: a number, or a label from labels[] verbatim.'),
            xMin: z.union([z.number(), z.string()]).optional(),
            xMax: z.union([z.number(), z.string()]).optional(),
            yMin: z.number().optional(),
            yMax: z.number().optional(),
            borderColor: z.string().optional(),
            borderDash: z.array(z.number()).optional(),
            borderWidth: z.number().optional(),
            backgroundColor: z.string().optional(),
            label: z
              .object({
                content: z.string(),
                position: z.enum(['start', 'center', 'end']).optional(),
                display: z.boolean().optional(),
              })
              .optional(),
          }),
        )
        .optional()
        .describe(
          'Lines and bands on bar, line, scatter, bubble or matrix, e.g. [{type:"line", scaleID:"y", value:50, label:{content:"warmtepomp zeer geschikt < 50", display:true}}]. ' +
            'Draw a target only against data of the same kind: a calculated label figure never against a metered target (Paris Proof, WEii).',
        ),
    })
    .optional()
    .describe('Only what differs from the defaults.'),
  width: z.number().optional().describe('Pixels. Default 600.'),
  height: z.number().optional().describe('Pixels. Default 400.'),
  queryIntent: z.string().optional().describe('The business question this call answers. Used for observability.'),
};
