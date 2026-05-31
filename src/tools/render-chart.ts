/**
 * MCP App tool: render_chart
 *
 * Renders interactive Chart.js charts inline in the conversation.
 * Supports 14 chart types: bar, line, pie, doughnut, radar, polarArea, bubble,
 * scatter, sankey, matrix, treemap, boxplot, funnel, graph.
 *
 * This is a pass-through tool — validates input, enforces payload limits,
 * and returns structuredContent for the Angular UI to render.
 *
 * @see ui/apps/chart/ for the Angular MCP App
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { getAuthExtra } from '../shared/auth.js';
import { requestContext } from '../shared/log-context.js';
import { writeToolCallLog } from '../shared/log-store.js';

// ── UI Resource ──────────────────────────────────────────────────────────────

const RESOURCE_URI = 'ui://metadata-demo/chart.html';

/**
 * Path to the Vite-built UI directory.
 * At runtime: dist/tools/render-chart.js
 * UI output:  build/ui/chart.html
 */
const UI_DIR = path.resolve(import.meta.dirname, '..', '..', 'build', 'ui');

let cachedHtml: string | null = null;
async function getAppHtml(): Promise<string> {
  if (!cachedHtml) {
    const htmlPath = path.join(UI_DIR, 'chart.html');
    try {
      cachedHtml = await fs.readFile(htmlPath, 'utf-8');
    } catch (err) {
      logger.error('render_chart.missing_ui_artifact', {
        htmlPath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(`Missing UI build artifact: ${htmlPath} — run "npm run build" first`, { cause: err });
    }
  }
  return cachedHtml;
}

// ── Description ──────────────────────────────────────────────────────────────

const description = `\
RETURNS:
Renders an interactive chart inline in the conversation. Supports 14 chart types:
bar, line, pie, doughnut, radar, polarArea, bubble, scatter, sankey,
matrix (heatmap), treemap, boxplot, funnel, graph.
The chart is interactive — hover for tooltips, click legend to toggle datasets.
Uses a built-in palette by default.

Annotations (threshold/target lines and bands) can be layered on top of bar, line,
scatter, bubble, matrix, and mixed charts via options.annotations — ideal for target
thresholds, SLA bands, comfort/operating zones, office-hours boxes on calendar
heatmaps.

WHEN TO USE:
Any request that calls for a visualization — explicit ("show me a chart", "graph this", "visualize") or implicit (questions about trend, distribution, ranking, spread, 2D-patterns, correlation, or flows that a single number or a table wouldn't answer). Pick \`type\` using the REFUSE rules on that parameter + the decision path below.

WHEN NOT TO USE:
- The answer is a single number or short list → respond with text
- User wants to browse/sort/filter individual records → use render_table
- You need to fetch data first → call the appropriate data source THEN pass the result here
- More than 3000 data points per dataset (line), 500 (most types), 2000 cells (matrix), or 200 flows/nodes (sankey/graph) → pre-aggregate first

INTERPRETATION:
Question-first decision path (ask these before picking \`type\`; the per-type rules on \`type\` give the final gates):
1. Is the x-axis continuous (time/numeric) or categorical? Continuous → line / scatter / matrix / bubble. Categorical → bar / pie / treemap / radar / sankey / funnel / graph / boxplot / polarArea.
2. How many series / categories / datapoints? Pie hard-caps at 5, radar at 3 overlays, line at 5 series, sankey at 10 flows per tier, matrix sweet spots 7×24 / 12×N / 52×N.
3. Is the total meaningful, just proportions, or both? Total → stacked. Proportions only → 100% stacked or percentage bars. Both → grouped bar or small multiples (multiple render_chart calls).
4. What is the purpose — ranking, distribution, flow, correlation, composition, deviation, trend? This is the primary trigger for the \`type\` rules.
5. Are units consistent across series? No → no radar, no dual-axis line+bar unless there's a mechanistic link.
6. Is there a target/baseline/SLA? Yes → add an \`options.annotations\` overlay.

Hard rejections — if the agent catches itself drifting toward any of these, pick the alternative instead:
- Pie for a ranking question → horizontal bar, sorted desc
- Line with a categorical x-axis → bar
- Radar with mixed units or >3 overlays → matrix or small multiples (normalize to 0-100 if you must use radar)
- Sankey without a natural flow → bar
- Treemap with one item >80% → horizontal bar with log scale
- Matrix with a dense continuous dimension (365 daily dates on one axis) → aggregate to week/month, or line
- Boxplot with n<5 per category → dot plot (scatter with individual points)
- Funnel with stages that can grow (non-subset) → bar
- Stacked bar with >5 segments → grouped bar, or aggregate to "top-N + other"
- Dual-axis with two same-unit series → single axis

Question → chart patterns (use these when the question matches; they cover the non-obvious choices):
- Hours-by-person × week aggregated → matrix (capacity/anomaly grid); raw daily rows per person → boxplot (outliers = misbookings; SLA annotation line where relevant)
- Quarter-hourly usage aggregated to hour × weekday → matrix (calendar heatmap; add \`options.annotations\` box for office hours / weekend columns); per-unit kWh/m² across many buildings → horizontal bar + annotation line on target (e.g. Paris Proof 70 kWh/m² offices, 100 residential)
- Gas usage vs heating-degree-days → scatter + trendline (slope = m³/HDD efficiency; outliers = heating issues)
- Revenue × margin × volume → bubble (x=revenue, y=margin%, r=volume) with quadrant annotation lines on x=median and y=median; budgeted vs realised → scatter + 45° diagonal annotation (above line = over budget)
- Hierarchical breakdown (project → phase → item, ≥6 items, max 3 levels) → treemap; cost flow over 2-3 tiers (budget → discipline → cost item) → sankey
- Pareto — which codes cause 80% → bar sorted desc + line dataset with type="line" for cumulative % + annotation line on 80; lead-time by priority → boxplot + annotation SLA line
- 1-3 entities over ≤6 normalized dimensions → radar; 10+ entities over the same dimensions → matrix (radar falls apart past 3 overlays)
- Per-discipline → category → family hierarchy → treemap; element dependencies across systems → graph with layout="force"
- Energy mix (electric / gas / heat, 3 slices) → pie; monthly trend per year → line (≤5 series); allocation source → system → end-use → sankey

Annotation overlay: add via \`options.annotations\` on bar / line / scatter / bubble / matrix whenever a target, SLA, threshold, budget, benchmark-zone or event-marker is relevant. \`scaleID\` is REQUIRED on every line-type annotation ('y' for horizontal, 'x' for vertical) — without it nothing renders. Not supported on pie / doughnut / radar / polarArea / sankey / treemap / funnel / graph.

QUERY STRATEGY:
1. Fetch data from the relevant data source
2. Use summaryOnly=true or limit results to keep data under 500 points
3. Transform the response into labels[] + datasets[] (or sankey.flows[])
4. Call render_chart with the prepared data
NEVER pass raw API responses directly — always extract and reshape the specific fields you need.

OUTPUT EFFICIENCY (important — tool-call payloads are user-visible and expensive to stream):
- Pass the prepared data directly. Do NOT print/echo the JSON to chat or to stdout in an analysis step first.
- Prefer TUPLE SHORTHAND across every payload-heavy shape:
    Datasets:      ["<label>", [<number>, <number>, ...]]       instead of {label, data}
    Sankey flow:   ["<from>", "<to>", <number>]                  instead of {from, to, flow}
    Matrix cell:   [<x>, <y>, <v>]                               instead of {x, y, v}
    Treemap row:   [<groupVal>, ..., <numericValue>]             instead of {<col>: ..., ...}   (requires treemap.columns[])
    Graph node:    ["<id>"] or ["<id>","<label>"] or ["<id>","<label>","<group>"]   instead of {id, label?, group?}
    Graph edge:    ["<source>","<target>"] or ["<source>","<target>",<weight>]      instead of {source, target, weight?}
  Tuples save ~40-60% per entry on dense data — especially important for matrix (up to 2000 cells), treemap (up to 500 rows), and graph (up to 500 edges). Fall back to the keyed object form only when you need extra optional fields (e.g. pre-computed node coordinates, edge weight, dataset styling overrides, scatter/bubble scatterData, dashed lines, mixed chart type overrides, area fill, or tension).
- Omit optional fields when the default is fine. Chart colors auto-cycle through the default palette — don't set backgroundColor/borderColor unless overriding.
- Keep datasets short. Each dataset is one legend entry; 5-7 series is the practical max for legibility regardless of payload cost.

RELATED TOOLS:
- render_table — for tabular data with sorting/filtering/pagination (complementary: chart for visual insight, table for detail drill-down)
- render_map — for geographic context (complementary: chart for numeric trends, map for spatial patterns)

ALERTS:
Always check that data is pre-processed (aggregated, filtered, limited) before passing.
Payload caps: line 3000 points (Decimation plugin auto-downsamples); bar/pie/doughnut/radar/polarArea/scatter/bubble 500; sankey 200 flows; matrix 2000 cells; treemap 500 rows; graph 200 nodes and 500 edges; boxplot 500 samples per category; funnel 20 segments.
Labels array is REQUIRED for bar, line, pie, doughnut, radar, polarArea, boxplot, and funnel. Omitting labels for those types causes an invisible chart with no error. Not needed for scatter, bubble, sankey, matrix, treemap, or graph (those use their own coordinate/structure fields).`;

// ── Input schema ─────────────────────────────────────────────────────────────
// Raw Zod shape (NOT z.object()) — required by registerAppTool

const inputSchema = {
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
    .describe(
      'Chart type. Each rule has a primary trigger and a hard rejection — pick the type whose trigger matches the question, then check the rejection clause:\n' +
        "- bar: rankings and 'hoeveel per X'. Horizontal for >8 items or long labels (projectnamen, adressen); vertical for time buckets. Sort desc for ranking, stacked cap 4 segments. REFUSE on continuous x-axis (use line) or truncated y-axis.\n" +
        '- line: trend over continuous x-axis (time/numeric). ≤5 series; otherwise filter top-N or split. Area (fill=true) only for 1 series or a meaningful stacked total. REFUSE on categorical x-axis (use bar).\n' +
        "- pie: 2-5 slices with one clear dominance. Hard cap 5 — aggregate to 'top 4 + overig' beyond that. REFUSE for ranking questions, similar-sized slices, or side-by-side period comparison.\n" +
        '- doughnut: pie with a KPI in the center hole. Without a center value, use pie instead.\n' +
        '- radar: one profile across ≤6 axes with the same scale, OR ≤3 overlays normalized to a shared scale (0-100). REFUSE on >8 axes, >3 series, mixed units, or ranking questions.\n' +
        '- polarArea: cyclical data only (months, weekdays, hours). REFUSE on non-cyclical categories (leveranciers, projecten) — use bar.\n' +
        '- bubble: 3 numeric dimensions (x, y, size). Size = area (plot √value), normalize r to 5-40px. REFUSE when size ranking is the actual question (use scatter + label) or when sizes vary >10×.\n' +
        '- scatter: correlation/distribution of 2 numeric variables. Add a trendline for correlation questions; add a 45° diagonal for actual-vs-target. REFUSE on categorical x-axis.\n' +
        '- sankey: flows across 2-3 tiers, ≤10 flows per tier, consistent unit across flows. Use the sankey field. REFUSE without a natural flow (sales per regio is not flow), >3 tiers (hairball), or cycles/loops (use graph).\n' +
        '- matrix: 2 categorical dimensions + numeric intensity per cell. Use the matrix field. Sweet spots 7×24, 12×N, 52×N. REFUSE on one dense continuous dimension (365 daily dates → line) or on two numeric dimensions (→ scatter).\n' +
        '- treemap: hierarchical part-to-whole, 6+ items, area = value. Use the treemap field. Max 3 levels. REFUSE on flat data (→ bar), on one item >80% (it swallows the rest), or on precise-ranking questions.\n' +
        '- boxplot: distribution (median, IQR, outliers) per category, n≥5 per box. Use samples or stats on each dataset. REFUSE on n<5 (→ dot plot) or when the question is only about the mean.\n' +
        '- funnel: 3-6 strictly decreasing stages where each stage is a subset of the previous one. REFUSE on non-linear processes, branching, or stages that can grow (→ bar).\n' +
        '- graph: relational networks where edges carry meaning (dependencies, many-to-many, cross-tier). Use the graph field; layouts: force / tree / dendrogram. REFUSE on strict parent-child hierarchy (→ treemap) or on plain list views (→ table).'
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Chart title displayed above the visualization. Use Dutch, concise (e.g. "Energieverbruik per maand", "Uren per medewerker Q1 2025").'
    ),
  labels: z
    .array(z.string())
    .optional()
    .describe(
      'Category labels for the x-axis (bar, line) or segments (pie, doughnut, radar, polarArea). ' +
        'REQUIRED for all chart types except scatter, bubble, and sankey — omitting labels causes an invisible chart. ' +
        'Must have the same length as the data array. ' +
        'Examples: month names ["Jan", "Feb", ...], employee names, project numbers, energy types.'
    ),
  datasets: z
    .array(
      z.union([
        // Tuple shorthand: [label, data] — for simple datasets with no extra styling.
        // ~20 chars saved per dataset vs the keyed object form. Use for the common
        // line/bar case where default palette auto-cycling is fine.
        // Modeled as a loose positional array (NOT z.tuple) so the emitted JSON
        // Schema uses single-object `items` instead of the array-form `items: [...]`
        // that strict connectors (OpenAI/ChatGPT) reject. Payload stays identical.
        // .length(2) restores the tuple's arity check via minItems/maxItems (not
        // array-form items), so a malformed [label] can't yield data:undefined.
        z.array(z.union([z.string(), z.array(z.number().nullable())])).length(2),
        // Full object form — required for scatter/bubble (scatterData), dashed lines,
        // custom colors, per-dataset type overrides, area fill, tension, etc.
        z.object({
          label: z
            .string()
            .describe(
              'Legend label for this dataset. Use Dutch domain terms (e.g. "Elektriciteit (kWh)", "Gewerkte uren", "Materiaalkosten").'
            ),
          data: z
            .array(z.number().nullable())
            .describe(
              'Numeric values, one per label. Use null for missing data points (creates a gap in lines, skips bar). For scatter/bubble use scatterData instead.'
            ),
          spanGaps: z
            .boolean()
            .optional()
            .describe(
              'true = draw a line through null gaps instead of breaking the line. Only for type=line. ' +
                'Use when missing data should be interpolated visually (e.g. sensor outage mid-month). ' +
                'Default: false (shows gap).\n' +
                'BEST PRACTICE for interpolated gaps: use TWO datasets instead of spanGaps. ' +
                'Dataset 1: actual data (solid line). Dataset 2: only the interpolated segments ' +
                '(null everywhere except the gap range), with a dashed borderDash=[5,5] and a muted/lighter color. ' +
                'This makes interpolated values visually distinct from real measurements.'
            ),
          scatterData: z
            .array(
              z.object({
                x: z.number(),
                y: z.number(),
                r: z.number().optional(),
              })
            )
            .optional()
            .describe(
              'For scatter: [{x, y}]. For bubble: [{x, y, r}]. r = bubble radius in pixels — normalize to 5-40 range.'
            ),
          backgroundColor: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe(
              'Fill color(s). Omit to use default palette auto-cycling. Single string for uniform, array for per-segment (pie/doughnut).'
            ),
          borderColor: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe('Border color(s). Omit to use default palette.'),
          borderDash: z
            .array(z.number())
            .optional()
            .describe(
              'Dash pattern [dashLength, gapLength] in pixels. E.g. [5,5] for dashed, [10,5] for long dash. ' +
                'Only for type=line. Use to visually distinguish interpolated/estimated data from real measurements.'
            ),
          fill: z
            .boolean()
            .optional()
            .describe(
              'true = area chart (fill under line). Only for type=line. Creates stacked area effect with multiple datasets.'
            ),
          tension: z
            .number()
            .optional()
            .describe('Line smoothing 0-1. 0=straight, 0.3=smooth curves. Only for type=line.'),
          type: z
            .string()
            .optional()
            .describe(
              'Per-dataset type override for mixed charts. E.g. main type=bar, one dataset type="line" to overlay a trend line on bars.'
            ),
          order: z
            .number()
            .optional()
            .describe(
              'Drawing order for mixed charts. Higher number = drawn first (behind). E.g. bars order=2, line order=1 (line on top).'
            ),
          samples: z
            .array(z.array(z.number()))
            .optional()
            .describe(
              'For type=boxplot: raw value arrays, one inner array per category label. ' +
                'Outer length MUST equal labels.length. Each inner array ≤ 500 values. ' +
                'The plugin computes min/q1/median/q3/max/outliers automatically. ' +
                'Example (2 projects, 5 marges each): [[12,15,18,22,27], [8,10,11,13,35]].'
            ),
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
              })
            )
            .optional()
            .describe(
              'For type=boxplot: pre-computed stats per category (use when you have aggregated results). ' +
                'Array length MUST equal labels.length. Prefer samples when raw values are available — the plugin renders richer whiskers/outliers from samples.'
            ),
        }),
      ])
    )
    .optional()
    .describe(
      'Chart datasets. Each dataset is one series/legend entry. Omit for sankey type (use sankey field instead).\n' +
        'Two accepted shapes per entry:\n' +
        '- Tuple shorthand: [label, data]  — preferred for simple bar/line series. Use default palette default.\n' +
        '  Example: ["Elektriciteit (kWh)", [1800, 1620, 1240, null, null, 120]]\n' +
        '- Full object: {label, data, backgroundColor?, borderColor?, borderDash?, fill?, tension?, scatterData?, type?, order?, spanGaps?}\n' +
        '  Required when you need styling overrides, scatter/bubble data, dashed lines, mixed charts, or area fills.'
    ),
  sankey: z
    .object({
      flows: z
        .array(
          z.union([
            // Tuple shorthand: [from, to, flow] — big win on large diagrams (50+ flows).
            // Loose positional array (not z.tuple) for connector-safe JSON Schema;
            // .length(3) restores arity via minItems/maxItems so flow can't be undefined.
            z.array(z.union([z.string(), z.number()])).length(3),
            z.object({
              from: z.string().describe('Source node name (e.g. "Elektriciteit", "Budget Projecten")'),
              to: z.string().describe('Target node name (e.g. "Warmtepomp", "Afdeling W")'),
              flow: z.number().describe('Flow value (e.g. kWh, euros, uren). Determines link thickness.'),
            }),
          ])
        )
        .describe(
          'Array of flows. Each flow links a source node to a target node with a magnitude. Max 200 flows.\n' +
            'Two accepted shapes per flow:\n' +
            '- Tuple shorthand: [from, to, flow]  — preferred, ~40% smaller per flow.\n' +
            '  Example: [["Elektriciteit", "Warmtepomp", 1800], ["Gas", "CV-ketel", 450]]\n' +
            '- Object: {from, to, flow}  — fine for small diagrams.'
        ),
      labels: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Display labels per node. Keys = node names from flows, values = display text. E.g. {"Electricity": "Elektriciteit (netaansluiting)"}'
        ),
      colors: z
        .record(z.string(), z.string())
        .optional()
        .describe('Custom color per node. Keys = node names, values = hex colors. Omit to use default palette.'),
      priority: z
        .record(z.string(), z.number())
        .optional()
        .describe(
          'Vertical ordering per node. Lower number = higher position. Use to group related nodes (e.g. sources at top, sinks at bottom).'
        ),
      colorMode: z
        .enum(['gradient', 'from', 'to'])
        .optional()
        .describe(
          'Link coloring: gradient (default, smooth blend source→target), from (link color = source node), to (link color = target node).'
        ),
    })
    .optional()
    .describe(
      'Sankey-specific config. Use ONLY with type=sankey. ' +
        'Perfect for energy flow analysis (bron→systeem→toepassing), cost allocation (budget→afdeling→post), ' +
        'or any source→destination flow. Nodes are auto-discovered from flow from/to values.'
    ),
  matrix: z
    .object({
      cells: z
        .array(
          z.union([
            // Tuple shorthand: [x, y, v] — preferred for dense heatmaps (saves ~20 chars/cell).
            // Loose positional array (not z.tuple) for connector-safe JSON Schema;
            // .length(3) restores arity via minItems/maxItems so v can't be undefined.
            z.array(z.union([z.string(), z.number()])).length(3),
            z.object({
              x: z.union([z.string(), z.number()]).describe('X-axis category or numeric position'),
              y: z.union([z.string(), z.number()]).describe('Y-axis category or numeric position'),
              v: z.number().describe('Cell value — drives color intensity'),
            }),
          ])
        )
        .describe(
          'Heatmap cells. Max 2000.\n' +
            'Two accepted shapes per cell:\n' +
            '- Tuple shorthand: [x, y, v]  — preferred (saves ~50% per cell).\n' +
            '  Example: [["Ma","09",4.2], ["Ma","10",4.5], ...]\n' +
            '- Object: {x, y, v}'
        ),
      xLabels: z
        .array(z.string())
        .optional()
        .describe(
          'X-axis category labels (order matters). REQUIRED when cells use string x values. ' +
            'Example for calendar heatmap: ["Ma","Di","Wo","Do","Vr","Za","Zo"].'
        ),
      yLabels: z
        .array(z.string())
        .optional()
        .describe(
          'Y-axis category labels (order matters). REQUIRED when cells use string y values. ' +
            'Example for calendar heatmap: ["00","01",...,"23"].'
        ),
      colorScale: z
        .object({
          min: z
            .string()
            .optional()
            .describe('Low-value color (hex or CSS color). Default: palette primary-lighter.'),
          max: z.string().optional().describe('High-value color (hex or CSS color). Default: palette primary.'),
          reverse: z.boolean().optional().describe('Reverse scale (high values get the low color).'),
        })
        .optional()
        .describe('Optional color gradient endpoints. Defaults to Warmteblauw brand gradient.'),
    })
    .optional()
    .describe(
      'Matrix (heatmap) config. Use ONLY with type=matrix. ' +
        'Each cell combines an x, y, and value — color intensity encodes the value. ' +
        'Perfect for 2D density patterns: uur × dag kWh (calendar heatmap), week × installatietype storingen, voertuig × dag bezetting.'
    ),
  treemap: z
    .object({
      tree: z
        .array(
          z.union([
            // Tuple shorthand: positional array aligned with `columns`. Saves ~50% per row for dense trees.
            z.array(z.union([z.string(), z.number()])),
            z.record(z.string(), z.union([z.string(), z.number()])),
          ])
        )
        .describe(
          'Flat rows of data. Max 500 rows.\n' +
            'Two accepted shapes per row:\n' +
            '- Tuple shorthand: positional array aligned with `columns` — preferred for large trees.\n' +
            '  Example (with columns=["project","fase","uren"]): [["G25011600","Uitvoering",145], ...]\n' +
            '- Object: {<groupCol>: string, ..., <keyCol>: number}.\n' +
            '  Example: [{project:"G25011600", fase:"Uitvoering", uren:145}, ...]'
        ),
      columns: z
        .array(z.string())
        .optional()
        .describe(
          'Column names in positional order — REQUIRED when tree rows use the tuple shorthand. ' +
            'Must include every entry in `groups` plus the `key` column. Example: ["project","fase","uren"].'
        ),
      key: z.string().describe('Column name holding the numeric value (cell area). E.g. "uren", "kosten", "m2".'),
      groups: z
        .array(z.string())
        .optional()
        .describe(
          'Hierarchy column names, top → bottom (max 3). Omit for a flat treemap keyed on index. ' +
            'Example: ["project","fase"] groups first by project then by fase within each project.'
        ),
      labels: z
        .object({
          display: z.boolean().optional().describe('Show labels inside rectangles. Default: true.'),
          formatter: z
            .enum(['name', 'name-value', 'name-percent'])
            .optional()
            .describe('Label format. Default: "name-value".'),
        })
        .optional()
        .describe('Optional label formatting.'),
    })
    .optional()
    .describe(
      'Treemap config. Use ONLY with type=treemap. ' +
        'Hierarchical nested rectangles where area is proportional to the value. ' +
        'Perfect for: kosten project→fase→post, BIM discipline→category→family, portfolio gebruikstype→energielabel.'
    ),
  graph: z
    .object({
      layout: z
        .enum(['force', 'tree', 'dendrogram'])
        .describe(
          'Layout algorithm: "force" = force-directed (undirected clusters, best general default), ' +
            '"tree" = top-down hierarchy, "dendrogram" = branching tree (requires parent-child edges).'
        ),
      nodes: z
        .array(
          z.union([
            // Tuple shorthand: [id] | [id, label] | [id, label, group]
            // Loose positional array (not z.tuple) for connector-safe JSON Schema;
            // .min(1).max(3) restores arity via minItems/maxItems so id can't be undefined.
            z.array(z.string()).min(1).max(3),
            z.object({
              id: z.string().describe('Unique node identifier referenced from edges.'),
              label: z.string().optional().describe('Display label. Falls back to id.'),
              x: z.number().optional().describe('Optional pre-computed x position (skips layout).'),
              y: z.number().optional().describe('Optional pre-computed y position (skips layout).'),
              group: z.string().optional().describe('Group key for color cycling.'),
            }),
          ])
        )
        .describe(
          'Graph nodes. Max 200.\n' +
            'Three accepted shapes per node:\n' +
            '- Tuple shorthand: [id] or [id, label] or [id, label, group] — preferred.\n' +
            '  Example: [["AH","Albert Heijn","klant"], ["R250312","AH 1460","project"]]\n' +
            '- Object: {id, label?, group?, x?, y?} — use for pre-computed coordinates.'
        ),
      edges: z
        .array(
          z.union([
            // Tuple shorthand: [source, target] or [source, target, weight]
            // Loose positional array (not z.tuple) for connector-safe JSON Schema;
            // .min(2).max(3) restores arity via minItems/maxItems so target can't be undefined.
            z
              .array(z.union([z.string(), z.number()]))
              .min(2)
              .max(3),
            z.object({
              source: z.string().describe('Source node id (must match a node.id).'),
              target: z.string().describe('Target node id (must match a node.id).'),
              weight: z.number().optional().describe('Edge weight (affects line thickness).'),
            }),
          ])
        )
        .describe(
          'Graph edges. Max 500. Every source/target must match a node id.\n' +
            'Three accepted shapes per edge:\n' +
            '- Tuple shorthand: [source, target] or [source, target, weight] — preferred.\n' +
            '  Example: [["AH","R250312"], ["JUMBO","JW",3]]\n' +
            '- Object: {source, target, weight?}'
        ),
      directed: z.boolean().optional().describe('Draw edge arrows. Default: false.'),
    })
    .optional()
    .describe(
      'Graph config. Use ONLY with type=graph. ' +
        'Perfect for relational data: element dependencies, network graphs, hierarchical trees.'
    ),
  options: z
    .object({
      indexAxis: z
        .enum(['x', 'y'])
        .optional()
        .describe(
          '"y" = horizontal bar chart (bars grow left to right). Useful for long category labels like project names or addresses.'
        ),
      stacked: z
        .boolean()
        .optional()
        .describe(
          'true = stacked bar/line. Shows composition within each category. E.g. stacked bar: uren Wst + Kst + Art per project.'
        ),
      showLegend: z
        .boolean()
        .optional()
        .describe('Show legend. Default: true for multi-dataset, false for single dataset.'),
      showGrid: z
        .boolean()
        .optional()
        .describe('Show grid lines. Default: true. Set false for cleaner pie/doughnut/radar.'),
      aspectRatio: z
        .number()
        .optional()
        .describe(
          'Width/height ratio. Default: 2 (wide). Use 1 for square charts (pie, radar). Use 3+ for sparkline-style.'
        ),
      yAxisLabel: z.string().optional().describe('Y-axis title. Use units (e.g. "kWh", "Uren", "€", "m³").'),
      xAxisLabel: z
        .string()
        .optional()
        .describe('X-axis title. Use for time periods or categories (e.g. "Maand", "Project").'),
      annotations: z
        .array(
          z.object({
            type: z
              .enum(['line', 'box', 'label'])
              .describe(
                '"line" = horizontal/vertical threshold; "box" = rectangular band (comfort zone, SLA band); "label" = free-floating text marker.'
              ),
            scaleID: z
              .enum(['x', 'y', 'y1'])
              .optional()
              .describe(
                'REQUIRED for type="line" — without it nothing renders. y = horizontal line on left y-axis, y1 = horizontal line on right y-axis (mixed charts), x = vertical line on x-axis.'
              ),
            value: z
              .union([z.number(), z.string()])
              .optional()
              .describe(
                'For type="line": the position on scaleID. Number for numeric/time axes (e.g. value:70 for Paris Proof). For a categorical x-axis (labels[] is strings, e.g. dates), pass the label string verbatim (e.g. value:"30 apr") — Chart.js resolves it against the category scale.'
              ),
            xMin: z.union([z.number(), z.string()]).optional().describe('For box/label: x-axis lower bound.'),
            xMax: z.union([z.number(), z.string()]).optional().describe('For box/label: x-axis upper bound.'),
            yMin: z.number().optional().describe('For box/label: y-axis lower bound.'),
            yMax: z.number().optional().describe('For box/label: y-axis upper bound.'),
            borderColor: z.string().optional().describe('Line/box border color. Default: palette warning.'),
            borderDash: z
              .array(z.number())
              .optional()
              .describe('Dash pattern [dashLen, gapLen]. E.g. [6,6] for dashed target line.'),
            borderWidth: z.number().optional().describe('Line width in px. Default: 2.'),
            backgroundColor: z
              .string()
              .optional()
              .describe('Box fill (with alpha for transparency). E.g. "rgba(0,128,0,0.08)" for comfort zone.'),
            label: z
              .object({
                content: z.string().describe('Label text shown on the annotation.'),
                position: z
                  .enum(['start', 'center', 'end'])
                  .optional()
                  .describe('Position along the line/edge. Default: end.'),
                display: z.boolean().optional().describe('Show the label. Default: false (bare line).'),
              })
              .optional()
              .describe('Optional label rendered on the annotation.'),
          })
        )
        .optional()
        .describe(
          'Threshold lines, bands, and labels overlaid on the chart. Supported on bar / line / scatter / bubble / matrix only — unsupported on pie / doughnut / radar / polarArea / sankey / treemap / funnel / graph. ' +
            'For type="line" annotations, scaleID is REQUIRED or the annotation silently renders nothing. ' +
            'Example — Paris Proof target: [{type:"line", scaleID:"y", value:70, borderColor:"#d32f2f", borderDash:[6,6], label:{content:"Paris Proof", display:true}}]. ' +
            'Example — comfort band: [{type:"box", yMin:18, yMax:22, backgroundColor:"rgba(0,128,0,0.08)"}]. ' +
            'Example — event marker on a categorical x-axis (e.g. labels=["1 apr","2 apr",...,"30 apr"]): [{type:"line", scaleID:"x", value:"30 apr", borderColor:"#d32f2f", label:{content:"Wapenstilstand", display:true}}]. The string MUST match a value in labels[] exactly.'
        ),
    })
    .optional()
    .describe('Chart options. Most have sensible defaults — only set what you need to override.'),
  width: z
    .number()
    .optional()
    .describe('Chart width in pixels. Default: 600. Use 800 for data-dense charts, 400 for compact dashboards.'),
  height: z
    .number()
    .optional()
    .describe('Chart height in pixels. Default: 400. Use 300 for sparklines, 500 for complex charts with many labels.'),
};

// ── Types ────────────────────────────────────────────────────────────────────

interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean?: number;
  outliers?: number[];
  items?: number[];
}

interface ChartDataset {
  label: string;
  data: (number | null)[];
  spanGaps?: boolean;
  scatterData?: Array<{ x: number; y: number; r?: number }>;
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderDash?: number[];
  fill?: boolean;
  tension?: number;
  type?: string;
  order?: number;
  samples?: number[][];
  stats?: BoxStats[];
}

interface MatrixCell {
  x: string | number;
  y: string | number;
  v: number;
}
type MatrixCellTuple = [string | number, string | number, number];

interface MatrixConfig {
  cells: Array<MatrixCell | MatrixCellTuple>;
  xLabels?: string[];
  yLabels?: string[];
  colorScale?: { min?: string; max?: string; reverse?: boolean };
}

interface TreemapConfig {
  tree: Array<Record<string, string | number> | Array<string | number>>;
  columns?: string[];
  key: string;
  groups?: string[];
  labels?: { display?: boolean; formatter?: 'name' | 'name-value' | 'name-percent' };
}

interface GraphNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  group?: string;
}
type GraphNodeTuple = [string] | [string, string] | [string, string, string];

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}
type GraphEdgeTuple = [string, string] | [string, string, number];

interface GraphConfig {
  layout: 'force' | 'tree' | 'dendrogram';
  nodes: Array<GraphNode | GraphNodeTuple>;
  edges: Array<GraphEdge | GraphEdgeTuple>;
  directed?: boolean;
}

interface AnnotationConfig {
  type: 'line' | 'box' | 'label';
  scaleID?: 'x' | 'y' | 'y1';
  value?: number | string;
  xMin?: number | string;
  xMax?: number | string;
  yMin?: number;
  yMax?: number;
  borderColor?: string;
  borderDash?: number[];
  borderWidth?: number;
  backgroundColor?: string;
  label?: { content: string; position?: 'start' | 'center' | 'end'; display?: boolean };
}

/** Dataset tuple shorthand: [label, data] */
type DatasetTuple = [string, (number | null)[]];

interface SankeyFlow {
  from: string;
  to: string;
  flow: number;
}

/** Sankey flow tuple shorthand: [from, to, flow] */
type FlowTuple = [string, string, number];

interface ChartArgs {
  type: string;
  title?: string;
  labels?: string[];
  datasets?: Array<ChartDataset | DatasetTuple>;
  sankey?: {
    flows: Array<SankeyFlow | FlowTuple>;
    labels?: Record<string, string>;
    colors?: Record<string, string>;
    priority?: Record<string, number>;
    colorMode?: string;
  };
  matrix?: MatrixConfig;
  treemap?: TreemapConfig;
  graph?: GraphConfig;
  options?: {
    indexAxis?: string;
    stacked?: boolean;
    showLegend?: boolean;
    showGrid?: boolean;
    aspectRatio?: number;
    yAxisLabel?: string;
    xAxisLabel?: string;
    annotations?: AnnotationConfig[];
  };
  width?: number;
  height?: number;
}

/** Normalize a dataset entry (tuple or object) to the full keyed shape. */
function normalizeDataset(entry: ChartDataset | DatasetTuple): ChartDataset {
  return Array.isArray(entry) ? { label: entry[0], data: entry[1] } : entry;
}

/** Normalize a sankey flow entry (tuple or object) to the keyed shape. */
function normalizeFlow(entry: SankeyFlow | FlowTuple): SankeyFlow {
  return Array.isArray(entry) ? { from: entry[0], to: entry[1], flow: entry[2] } : entry;
}

function normalizeMatrixCell(entry: MatrixCell | MatrixCellTuple): MatrixCell {
  return Array.isArray(entry) ? { x: entry[0], y: entry[1], v: entry[2] } : entry;
}

function normalizeGraphNode(entry: GraphNode | GraphNodeTuple): GraphNode {
  if (!Array.isArray(entry)) return entry;
  const [id, label, group] = entry;
  const node: GraphNode = { id };
  if (label !== undefined) node.label = label;
  if (group !== undefined) node.group = group;
  return node;
}

function normalizeGraphEdge(entry: GraphEdge | GraphEdgeTuple): GraphEdge {
  if (!Array.isArray(entry)) return entry;
  const edge: GraphEdge = { source: entry[0], target: entry[1] };
  if (entry.length === 3) edge.weight = entry[2];
  return edge;
}

/**
 * Normalize a treemap row entry to the keyed shape.
 * Callers must validate that `columns` is provided when any row is a tuple
 * (use `treemapNeedsColumns` to detect) before invoking this.
 */
function normalizeTreemapRow(
  entry: Record<string, string | number> | Array<string | number>,
  columns?: string[]
): Record<string, string | number> {
  if (!Array.isArray(entry)) return entry;
  if (!columns || columns.length === 0) return {};
  const out: Record<string, string | number> = {};
  columns.forEach((col, i) => {
    if (i < entry.length) out[col] = entry[i];
  });
  return out;
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerRenderChartTool(server: McpServer): void {
  // Register the ui:// resource (serves the Vite-built Angular app)
  registerAppResource(server, 'Chart App', RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [
      {
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await getAppHtml(),
      },
    ],
  }));

  // Register the tool with MCP App UI metadata
  registerAppTool(
    server,
    'render_chart',
    {
      title: 'Render Chart',
      description,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (rawArgs, extra: { authInfo?: AuthInfo }) => {
      const start = Date.now();
      let auth: { email: string; userId: string; roles: string[] } | null = null;

      // The input schema models tuple shorthands as loose positional arrays
      // (for connector-safe JSON Schema), so the inferred arg type is wider than
      // ChartArgs's precise tuple types. Positional access + normalize* + the
      // runtime checks below validate the actual shape, so assert ChartArgs here.
      const args = rawArgs as unknown as ChartArgs;

      try {
        auth = getAuthExtra(extra.authInfo);

        const fail = (text: string) => ({
          content: [{ type: 'text' as const, text }],
          isError: true as const,
        });

        // Treemap tuple rows require `columns` for positional interpretation.
        // Check before normalization — otherwise normalizeTreemapRow silently
        // produces empty-object rows and the downstream "missing numeric value"
        // error fires on every row, obscuring the real problem.
        if (args.treemap?.tree?.some((row) => Array.isArray(row))) {
          if (!args.treemap.columns || args.treemap.columns.length === 0) {
            return fail(
              'Treemap tuple rows require "columns" to be provided alongside "tree". Example: { columns:["project","fase","uren"], tree:[["G25011600","Uitvoering",145]], key:"uren" }.'
            );
          }
        }

        // Normalize tuple-shorthand inputs to the keyed shapes before any
        // validation or downstream consumption. Keeps validation / limits /
        // UI rendering uniform regardless of which input form the agent used.
        const datasets: ChartDataset[] | undefined = args.datasets?.map(normalizeDataset);
        const sankey = args.sankey ? { ...args.sankey, flows: args.sankey.flows.map(normalizeFlow) } : undefined;
        const matrix = args.matrix ? { ...args.matrix, cells: args.matrix.cells.map(normalizeMatrixCell) } : undefined;
        const treemap = args.treemap
          ? { ...args.treemap, tree: args.treemap.tree.map((row) => normalizeTreemapRow(row, args.treemap?.columns)) }
          : undefined;
        const graph = args.graph
          ? {
              ...args.graph,
              nodes: args.graph.nodes.map(normalizeGraphNode),
              edges: args.graph.edges.map(normalizeGraphEdge),
            }
          : undefined;

        // ── Validate payload limits ──────────────────────────────────
        // Line: 3000. Boxplot samples: 500 per category. Other datasets: 500.
        const maxPoints = args.type === 'line' ? 3000 : 500;

        if (args.type === 'sankey') {
          if (sankey && sankey.flows.length > 200) {
            return fail(
              `Too many sankey flows (${sankey.flows.length}). Maximum 200. Pre-aggregate before calling render_chart.`
            );
          }
        } else if (args.type === 'matrix') {
          if (!matrix || matrix.cells.length === 0) {
            return fail(
              `type=matrix requires a "matrix" field with "cells" array. Example: { cells: [["Ma","09",42], ...], xLabels:[...], yLabels:[...] }.`
            );
          }
          if (matrix.cells.length > 2000) {
            return fail(
              `Too many matrix cells (${matrix.cells.length}). Maximum 2000. Pre-aggregate before calling render_chart.`
            );
          }
          if (matrix.xLabels) {
            const xSet = new Set(matrix.xLabels);
            for (const cell of matrix.cells as MatrixCell[]) {
              if (typeof cell.x === 'string' && !xSet.has(cell.x)) {
                return fail(
                  `Matrix cell x="${cell.x}" is not in xLabels. Every string x value must appear in xLabels.`
                );
              }
            }
          }
          if (matrix.yLabels) {
            const ySet = new Set(matrix.yLabels);
            for (const cell of matrix.cells as MatrixCell[]) {
              if (typeof cell.y === 'string' && !ySet.has(cell.y)) {
                return fail(
                  `Matrix cell y="${cell.y}" is not in yLabels. Every string y value must appear in yLabels.`
                );
              }
            }
          }
        } else if (args.type === 'treemap') {
          if (!treemap || treemap.tree.length === 0) {
            return fail(
              `type=treemap requires a "treemap" field with "tree" and "key". Example: { columns:["project","fase","uren"], tree:[["G25011600","Uitvoering",145]], key:"uren", groups:["project","fase"] }.`
            );
          }
          if (treemap.tree.length > 500) {
            return fail(
              `Too many treemap rows (${treemap.tree.length}). Maximum 500. Aggregate to a coarser grouping before calling render_chart.`
            );
          }
          if (treemap.groups && treemap.groups.length > 3) {
            return fail(
              `Treemap supports at most 3 group levels (got ${treemap.groups.length}). Flatten or drop a level.`
            );
          }
          for (const row of treemap.tree as Record<string, string | number>[]) {
            if (typeof row[treemap.key] !== 'number') {
              return fail(
                `Treemap row is missing numeric value for key "${treemap.key}". Every row must have a number at that column.`
              );
            }
          }
        } else if (args.type === 'graph') {
          if (!graph || graph.nodes.length === 0) {
            return fail(
              `type=graph requires a "graph" field with "layout", "nodes", and "edges". Example: { layout:"force", nodes:[["a"],["b"]], edges:[["a","b"]] }.`
            );
          }
          if (graph.nodes.length > 200) {
            return fail(
              `Too many graph nodes (${graph.nodes.length}). Maximum 200. Reduce the graph before calling render_chart.`
            );
          }
          if (graph.edges.length > 500) {
            return fail(
              `Too many graph edges (${graph.edges.length}). Maximum 500. Reduce the graph before calling render_chart.`
            );
          }
          const ids = new Set((graph.nodes as GraphNode[]).map((n) => n.id));
          for (const e of graph.edges as GraphEdge[]) {
            if (!ids.has(e.source)) return fail(`Graph edge source "${e.source}" does not match any node id.`);
            if (!ids.has(e.target)) return fail(`Graph edge target "${e.target}" does not match any node id.`);
          }
        } else if (args.type === 'boxplot') {
          if (!datasets || datasets.length === 0) {
            return fail(`type=boxplot requires at least one dataset with "samples" (or "stats").`);
          }
          for (const ds of datasets) {
            const hasSamples = Array.isArray(ds.samples) && ds.samples.length > 0;
            const hasStats = Array.isArray(ds.stats) && ds.stats.length > 0;
            if (!hasSamples && !hasStats) {
              return fail(
                `Dataset "${ds.label}" has no "samples" or "stats". boxplot charts require one of those — the tuple shorthand [label, data] is not supported for boxplot.`
              );
            }
            if (hasSamples) {
              for (const inner of ds.samples!) {
                if (inner.length > 500) {
                  return fail(
                    `Dataset "${ds.label}" has ${inner.length} samples in one category. Maximum 500 per category for boxplot. Pre-aggregate or bin the data.`
                  );
                }
              }
            }
          }
        } else if (args.type === 'funnel') {
          if (!datasets || datasets.length !== 1) {
            return fail(`type=funnel requires exactly one dataset (the funnel stages). Got ${datasets?.length ?? 0}.`);
          }
          if (datasets[0].data.length > 20) {
            return fail(`Too many funnel segments (${datasets[0].data.length}). Maximum 20.`);
          }
        } else if (datasets) {
          for (const ds of datasets) {
            const pointCount = ds.scatterData ? ds.scatterData.length : ds.data.length;
            if (pointCount > maxPoints) {
              return fail(
                `Too many data points in dataset "${ds.label}" (${pointCount}). Maximum ${maxPoints} per dataset for ${args.type} charts. Pre-aggregate or filter before calling render_chart.`
              );
            }
          }
        }

        // ── Validate labels + dataset shape for label-based charts ───
        // Types that use labels[] on an axis. matrix/treemap/graph use their
        // own coordinate/structure fields; scatter/bubble use scatterData.
        const NO_LABEL_TYPES = ['scatter', 'bubble', 'sankey', 'matrix', 'treemap', 'graph'];
        const needsLabels = !NO_LABEL_TYPES.includes(args.type);
        if (needsLabels && datasets?.length && (!args.labels || args.labels.length === 0)) {
          return fail(
            `Missing "labels" array. ${args.type} charts require labels (one per data point). Provide labels matching the length of your data arrays.`
          );
        }

        // Data-length must match labels-length per dataset for label-based charts.
        if (needsLabels && datasets?.length && args.labels) {
          for (const ds of datasets) {
            const axisLength = args.type === 'boxplot' ? (ds.samples?.length ?? ds.stats?.length ?? 0) : ds.data.length;
            if (axisLength !== args.labels.length) {
              const fieldName = args.type === 'boxplot' ? 'samples/stats' : 'data';
              return fail(
                `Dataset "${ds.label}" has ${axisLength} ${fieldName} entries but labels has ${args.labels.length}. For ${args.type} charts each dataset must match labels.length so values align with the axis.`
              );
            }
          }
        }

        // scatter / bubble charts render scatterData, not the flat data array.
        // Tuple-shorthand datasets ([label, data]) have no scatterData slot, so
        // they're unusable for these types. Reject early with an explicit
        // message rather than rendering an empty chart.
        if (['scatter', 'bubble'].includes(args.type) && datasets?.length) {
          for (const ds of datasets) {
            if (!ds.scatterData || ds.scatterData.length === 0) {
              return fail(
                `Dataset "${ds.label}" has no "scatterData". ${args.type} charts require the full object form {label, scatterData: [{x,y${args.type === 'bubble' ? ',r' : ''}}]} — the tuple shorthand [label, data] is not supported for ${args.type}.`
              );
            }
          }
        }

        // annotations only apply to x/y axis charts
        const ANNOTATION_TYPES = ['bar', 'line', 'scatter', 'bubble', 'matrix'];
        if (args.options?.annotations?.length && !ANNOTATION_TYPES.includes(args.type)) {
          return fail(
            `options.annotations is not supported on type=${args.type}. Use annotations on bar, line, scatter, bubble, matrix, or mixed charts only.`
          );
        }

        // String annotation values must match a category label exactly — otherwise
        // Chart.js silently renders nothing and the agent gets "success" without a marker.
        if (args.options?.annotations?.length) {
          const xLabels = args.type === 'matrix' ? matrix?.xLabels : args.labels;
          const yLabels = args.type === 'matrix' ? matrix?.yLabels : undefined;
          for (const annotation of args.options.annotations) {
            if (annotation.type !== 'line' || typeof annotation.value !== 'string') continue;
            const domain = annotation.scaleID === 'x' ? xLabels : annotation.scaleID === 'y' ? yLabels : undefined;
            const domainName =
              annotation.scaleID === 'x'
                ? args.type === 'matrix'
                  ? 'matrix.xLabels'
                  : 'labels'
                : args.type === 'matrix'
                  ? 'matrix.yLabels'
                  : `the ${annotation.scaleID}-axis`;
            if (!domain) {
              return fail(
                `Annotation value "${annotation.value}" is a string but ${domainName} is not defined. String annotation values only work on categorical axes — pass a number for numeric/time axes.`
              );
            }
            if (!domain.includes(annotation.value)) {
              return fail(
                `Annotation value "${annotation.value}" is not present in ${domainName}. The string must match a category label exactly.`
              );
            }
          }
        }

        await logToolCall({
          auth,
          args: { ...args, datasets, sankey, matrix, treemap, graph },
          start,
          status: 'success',
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Chart rendered: ${args.type} — "${args.title ?? 'Untitled'}"`,
            },
          ],
          // Ship normalized keyed shapes to the UI so it doesn't need to re-implement
          // the same conversion client-side.
          structuredContent: { ...args, datasets, sankey, matrix, treemap, graph },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('tool.error', {
          tool: 'render_chart',
          connector: 'RenderChart',
          user: auth?.email ?? 'unknown',
          userId: auth?.userId ?? 'unknown',
          error: errorMessage,
          durationMs: Date.now() - start,
        });

        await logToolCall({ auth, args, start, status: 'error' });

        return {
          content: [{ type: 'text' as const, text: `Error in render_chart: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

async function logToolCall({
  auth,
  args,
  start,
  status,
}: {
  auth: { email: string; userId: string; roles: string[] } | null;
  args: ChartArgs;
  start: number;
  status: 'success' | 'error';
}): Promise<void> {
  const ctx = requestContext.getStore();
  if (ctx) {
    await writeToolCallLog({
      sessionId: ctx.sessionId,
      environment: ctx.environment,
      server: 'metadata-demo',
      user: auth?.email ?? 'unknown',
      userId: auth?.userId ?? 'unknown',
      tool: 'render_chart',
      connector: 'RenderChart',
      queryIntent: args.title ?? args.type ?? 'chart',
      filters: [],
      filterCount: 0,
      summaryOnly: false,
      skip: 0,
      take: 0,
      status,
      rowCount: 1,
      hasMore: false,
      durationMs: Date.now() - start,
      errorType: status === 'error' ? 'ToolError' : null,
    });
  }
}
