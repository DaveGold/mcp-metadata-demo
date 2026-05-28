import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  RadarController,
  PolarAreaController,
  BubbleController,
  ScatterController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Legend,
  Tooltip,
  Filler,
  Colors,
  Decimation,
  type ChartConfiguration,
  type ChartDataset,
} from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import { FunnelController, TrapezoidElement } from 'chartjs-chart-funnel';
import { ForceDirectedGraphController, TreeController, DendrogramController, EdgeLine } from 'chartjs-chart-graph';
import annotationPlugin from 'chartjs-plugin-annotation';
import { McpBridgeService } from '../../shared/mcp-bridge.service';

// Tree-shaken selective imports — Decimation enables min/max downsampling for large line datasets
Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  RadarController,
  PolarAreaController,
  BubbleController,
  ScatterController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Legend,
  Tooltip,
  Filler,
  Colors,
  Decimation,
  SankeyController,
  Flow,
  MatrixController,
  MatrixElement,
  TreemapController,
  TreemapElement,
  BoxPlotController,
  BoxAndWiskers,
  FunnelController,
  TrapezoidElement,
  ForceDirectedGraphController,
  TreeController,
  DendrogramController,
  EdgeLine,
  annotationPlugin
);

// ── Types ────────────────────────────────────────────────────────────────────

interface BoxStatsInput {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean?: number;
  outliers?: number[];
  items?: number[];
}

interface ChartDatasetInput {
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
  stats?: BoxStatsInput[];
}

interface MatrixCellInput {
  x: string | number;
  y: string | number;
  v: number;
}
type MatrixCellTupleInput = [string | number, string | number, number];

interface MatrixInput {
  cells: Array<MatrixCellInput | MatrixCellTupleInput>;
  xLabels?: string[];
  yLabels?: string[];
  colorScale?: { min?: string; max?: string; reverse?: boolean };
}

interface TreemapInput {
  tree: Array<Record<string, string | number> | Array<string | number>>;
  columns?: string[];
  key: string;
  groups?: string[];
  labels?: { display?: boolean; formatter?: 'name' | 'name-value' | 'name-percent' };
}

interface GraphNodeInput {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  group?: string;
}
type GraphNodeTupleInput = [string] | [string, string] | [string, string, string];

interface GraphEdgeInput {
  source: string;
  target: string;
  weight?: number;
}
type GraphEdgeTupleInput = [string, string] | [string, string, number];

interface GraphInput {
  layout: 'force' | 'tree' | 'dendrogram';
  nodes: Array<GraphNodeInput | GraphNodeTupleInput>;
  edges: Array<GraphEdgeInput | GraphEdgeTupleInput>;
  directed?: boolean;
}

interface AnnotationInput {
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

type DatasetTuple = [string, (number | null)[]];

interface SankeyFlow {
  from: string;
  to: string;
  flow: number;
}

type FlowTuple = [string, string, number];

interface ChartInput {
  type: string;
  title?: string;
  labels?: string[];
  /**
   * Datasets — either full objects or positional tuples `[label, data]`.
   * Server ships normalized objects in production; viewer demo injection
   * may ship tuples directly, so we normalize defensively in the component.
   */
  datasets?: Array<ChartDatasetInput | DatasetTuple>;
  sankey?: {
    /** Flows — either full objects or positional tuples `[from, to, flow]`. */
    flows: Array<SankeyFlow | FlowTuple>;
    labels?: Record<string, string>;
    colors?: Record<string, string>;
    priority?: Record<string, number>;
    colorMode?: string;
  };
  matrix?: MatrixInput;
  treemap?: TreemapInput;
  graph?: GraphInput;
  options?: {
    indexAxis?: string;
    stacked?: boolean;
    showLegend?: boolean;
    showGrid?: boolean;
    aspectRatio?: number;
    yAxisLabel?: string;
    xAxisLabel?: string;
    annotations?: AnnotationInput[];
  };
  theme?: string;
  width?: number;
  height?: number;
}

type NormalizedChartInput = Omit<ChartInput, 'datasets' | 'sankey' | 'matrix' | 'treemap' | 'graph'> & {
  datasets?: ChartDatasetInput[];
  sankey?: Omit<NonNullable<ChartInput['sankey']>, 'flows'> & { flows: SankeyFlow[] };
  matrix?: Omit<MatrixInput, 'cells'> & { cells: MatrixCellInput[] };
  treemap?: Omit<TreemapInput, 'tree'> & { tree: Array<Record<string, string | number>> };
  graph?: Omit<GraphInput, 'nodes' | 'edges'> & { nodes: GraphNodeInput[]; edges: GraphEdgeInput[] };
};

function normalizeDataset(entry: ChartDatasetInput | DatasetTuple): ChartDatasetInput {
  return Array.isArray(entry) ? { label: entry[0], data: entry[1] } : entry;
}

function normalizeFlow(entry: SankeyFlow | FlowTuple): SankeyFlow {
  return Array.isArray(entry) ? { from: entry[0], to: entry[1], flow: entry[2] } : entry;
}

function normalizeMatrixCell(entry: MatrixCellInput | MatrixCellTupleInput): MatrixCellInput {
  return Array.isArray(entry) ? { x: entry[0], y: entry[1], v: entry[2] } : entry;
}

function normalizeGraphNode(entry: GraphNodeInput | GraphNodeTupleInput): GraphNodeInput {
  if (!Array.isArray(entry)) return entry;
  const [id, label, group] = entry;
  const out: GraphNodeInput = { id };
  if (label !== undefined) out.label = label;
  if (group !== undefined) out.group = group;
  return out;
}

function normalizeGraphEdge(entry: GraphEdgeInput | GraphEdgeTupleInput): GraphEdgeInput {
  if (!Array.isArray(entry)) return entry;
  const out: GraphEdgeInput = { source: entry[0], target: entry[1] };
  if (entry.length === 3) out.weight = entry[2];
  return out;
}

function normalizeTreemapRow(
  entry: Record<string, string | number> | Array<string | number>,
  columns?: string[]
): Record<string, string | number> {
  if (!Array.isArray(entry)) return entry;
  if (!columns) return {};
  const out: Record<string, string | number> = {};
  columns.forEach((col, i) => {
    if (i < entry.length) out[col] = entry[i];
  });
  return out;
}

function normalizeChartInput(raw: ChartInput): NormalizedChartInput {
  return {
    ...raw,
    datasets: raw.datasets?.map(normalizeDataset),
    sankey: raw.sankey ? { ...raw.sankey, flows: raw.sankey.flows.map(normalizeFlow) } : undefined,
    matrix: raw.matrix ? { ...raw.matrix, cells: raw.matrix.cells.map(normalizeMatrixCell) } : undefined,
    treemap: raw.treemap
      ? { ...raw.treemap, tree: raw.treemap.tree.map((row) => normalizeTreemapRow(row, raw.treemap?.columns)) }
      : undefined,
    graph: raw.graph
      ? {
          ...raw.graph,
          nodes: raw.graph.nodes.map(normalizeGraphNode),
          edges: raw.graph.edges.map(normalizeGraphEdge),
        }
      : undefined,
  };
}

// ── Warmtebouw Palette ───────────────────────────────────────────────────────

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildPalette(isDark: boolean): { backgrounds: string[]; borders: string[] } {
  // Dark mode uses lighter/brighter variants for contrast against dark surfaces.
  // Light mode uses the base (darker) brand colors against white/beige backgrounds.
  const tokens = isDark
    ? [
        '--color-primary-lighter',
        '--color-warning',
        '--color-success',
        '--color-petrol-lighter',
        '--color-secondary-low',
        '--color-primary-low',
        '--color-grey-blue',
        '--color-petrol-low',
      ]
    : [
        '--color-primary',
        '--color-warning',
        '--color-success',
        '--color-petrol-lighter',
        '--color-secondary',
        '--color-primary-lighter',
        '--color-grey-blue',
        '--color-petrol',
      ];
  return {
    backgrounds: tokens.map((t) => `${readToken(t)}${isDark ? '59' : '80'}`),
    borders: tokens.map((t) => readToken(t)),
  };
}

function applyChartTheme(theme: 'light' | 'dark'): void {
  if (theme === 'dark') {
    Chart.defaults.color = readToken('--color-grey-beige-lighter') || '#ecebea';
    Chart.defaults.borderColor = `${readToken('--color-dark-border') || '#303036'}80`;
  } else {
    Chart.defaults.color = readToken('--color-primary-darker') || '#000c14';
    Chart.defaults.borderColor = `${readToken('--color-wb-gray-200') || '#E5E7EB'}CC`;
  }
}

// ── Export Helpers ───────────────────────────────────────────────────────────

function csvField(value: string, sep: string): string {
  if (value.includes(sep) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'export'
  );
}

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!bridge.connected() && !bridge.error()) {
      <div class="relative w-full rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card p-4">
        <div class="h-6 w-48 bg-wb-gray-200 dark:bg-dark-border rounded animate-pulse mb-3"></div>
        <div class="h-64 bg-wb-gray-50 dark:bg-dark-surface rounded-[var(--radius-m)] animate-pulse"></div>
      </div>
    }

    @if (bridge.error()) {
      <div class="rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card p-6 text-center">
        <p class="text-sm text-wb-gray-500 dark:text-grey-blue">{{ bridge.error() }}</p>
      </div>
    }

    @if (bridge.connected() && !bridge.error() && input()) {
      <div class="w-full">
        <div class="bg-primary px-3 py-1.5 flex items-center justify-between gap-2">
          @if (title()) {
            <h3 class="text-sm font-medium text-white truncate">{{ title() }}</h3>
          }
          <div class="ml-auto flex items-center gap-1">
            <button
              type="button"
              (click)="exportPng()"
              aria-label="Download als PNG"
              class="inline-flex items-center gap-1 rounded-[var(--radius-s)] px-2 py-0.5 text-xs font-medium
                     text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50
                     transition-colors whitespace-nowrap"
            >
              PNG
            </button>
            <button
              type="button"
              (click)="exportCsv()"
              aria-label="Download als CSV"
              class="inline-flex items-center gap-1 rounded-[var(--radius-s)] px-2 py-0.5 text-xs font-medium
                     text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50
                     transition-colors whitespace-nowrap"
            >
              CSV
            </button>
          </div>
        </div>
        <div
          class="relative w-full bg-white dark:bg-dark-surface-raised rounded-[var(--radius-card)] shadow-card p-4"
          [style.height.px]="chartHeight()"
        >
          <canvas #chartCanvas></canvas>
        </div>
      </div>
    }
  `,
})
export class ChartComponent implements OnInit, OnDestroy {
  readonly bridge = inject(McpBridgeService);
  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart: Chart | null = null;
  private readonly viewReady = signal(false);

  readonly input = computed<NormalizedChartInput | null>(() => {
    const result = this.bridge.toolResult();
    if (!result || !result['type']) return null;
    return normalizeChartInput(result as unknown as ChartInput);
  });

  readonly title = computed(() => this.input()?.title ?? null);

  readonly chartHeight = computed(() => {
    const inp = this.input();
    return inp?.height ?? 400;
  });

  constructor() {
    // afterNextRender guarantees canvas is laid out in DOM before Chart.js reads dimensions
    afterNextRender(() => {
      this.viewReady.set(true);
    });

    // Reactive chart creation/update — gated by viewReady to ensure DOM is ready
    effect(() => {
      if (!this.viewReady()) return;
      const inp = this.input();
      const canvas = this.chartCanvas();
      if (!inp || !canvas) return;

      const theme = this.bridge.hostTheme();
      applyChartTheme(theme === 'dark' ? 'dark' : 'light');

      const config = this.buildChartConfig(inp);

      // Always recreate — Chart.defaults (color, borderColor) don't propagate
      // to existing instances, so theme changes require a fresh chart.
      if (this.chart) {
        this.chart.destroy();
      }
      this.chart = new Chart(canvas.nativeElement, config);
    });
  }

  ngOnInit(): void {
    this.bridge.connect().catch((err) => {
      console.error('[ChartComponent] Bridge connection failed:', err);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  async exportPng(): Promise<void> {
    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/png').split(',')[1];
    const filename = slugify(this.title() ?? 'grafiek') + '.png';
    await this.bridge.downloadBinaryFile(filename, base64, 'image/png');
  }

  exportCsv(): void {
    const inp = this.input();
    if (!inp) return;

    const sep = ';';
    let csv: string;

    if (inp.type === 'sankey' && inp.sankey) {
      const header = ['Van', 'Naar', 'Stroom'].map((h) => csvField(h, sep)).join(sep);
      const rows = inp.sankey.flows.map((f) => {
        const fromLabel = inp.sankey!.labels?.[f.from] ?? f.from;
        const toLabel = inp.sankey!.labels?.[f.to] ?? f.to;
        return [csvField(fromLabel, sep), csvField(toLabel, sep), String(f.flow)].join(sep);
      });
      csv = [header, ...rows].join('\r\n');
    } else if (inp.type === 'matrix' && inp.matrix) {
      const header = ['x', 'y', 'v'].map((h) => csvField(h, sep)).join(sep);
      const rows = inp.matrix.cells.map((c) =>
        [csvField(String(c.x), sep), csvField(String(c.y), sep), String(c.v)].join(sep)
      );
      csv = [header, ...rows].join('\r\n');
    } else if (inp.type === 'treemap' && inp.treemap) {
      const cols = [...(inp.treemap.groups ?? []), inp.treemap.key];
      const header = cols.map((h) => csvField(h, sep)).join(sep);
      const rows = inp.treemap.tree.map((row) => cols.map((c) => csvField(String(row[c] ?? ''), sep)).join(sep));
      csv = [header, ...rows].join('\r\n');
    } else if (inp.type === 'graph' && inp.graph) {
      const nodesHeader = ['# Nodes', '', ''].map((h) => csvField(h, sep)).join(sep);
      const nodeCols = ['id', 'label', 'group'].map((h) => csvField(h, sep)).join(sep);
      const nodeRows = inp.graph.nodes.map((n) =>
        [csvField(n.id, sep), csvField(n.label ?? '', sep), csvField(n.group ?? '', sep)].join(sep)
      );
      const edgeCols = ['source', 'target', 'weight'].map((h) => csvField(h, sep)).join(sep);
      const edgeRows = inp.graph.edges.map((e) =>
        [csvField(e.source, sep), csvField(e.target, sep), String(e.weight ?? '')].join(sep)
      );
      csv = [nodesHeader, nodeCols, ...nodeRows, '', '# Edges', edgeCols, ...edgeRows].join('\r\n');
    } else if (inp.type === 'boxplot' && inp.datasets?.some((ds) => ds.samples || ds.stats)) {
      const header = ['Categorie', 'Dataset', 'Waarde'].map((h) => csvField(h, sep)).join(sep);
      const rows: string[] = [];
      const cats = inp.labels ?? [];
      for (const ds of inp.datasets ?? []) {
        if (ds.samples) {
          ds.samples.forEach((inner, i) => {
            const cat = cats[i] ?? String(i);
            for (const v of inner) rows.push([csvField(cat, sep), csvField(ds.label, sep), String(v)].join(sep));
          });
        } else if (ds.stats) {
          ds.stats.forEach((s, i) => {
            const cat = cats[i] ?? String(i);
            const entries: Array<[string, number]> = [
              ['min', s.min],
              ['q1', s.q1],
              ['median', s.median],
              ['q3', s.q3],
              ['max', s.max],
            ];
            if (s.mean !== undefined) entries.push(['mean', s.mean]);
            for (const [stat, v] of entries) {
              rows.push([csvField(cat, sep), csvField(`${ds.label} (${stat})`, sep), String(v)].join(sep));
            }
          });
        }
      }
      csv = [header, ...rows].join('\r\n');
    } else if (['scatter', 'bubble'].includes(inp.type) && inp.datasets?.some((ds) => ds.scatterData)) {
      const hasBubble = inp.type === 'bubble';
      const headerCols = hasBubble ? ['Dataset', 'x', 'y', 'r'] : ['Dataset', 'x', 'y'];
      const header = headerCols.map((h) => csvField(h, sep)).join(sep);
      const rows: string[] = [];
      for (const ds of inp.datasets ?? []) {
        for (const pt of ds.scatterData ?? []) {
          const row = [csvField(ds.label, sep), String(pt.x), String(pt.y)];
          if (hasBubble) row.push(String(pt.r ?? ''));
          rows.push(row.join(sep));
        }
      }
      csv = [header, ...rows].join('\r\n');
    } else {
      const datasets = inp.datasets ?? [];
      const headerCols = ['Label', ...datasets.map((ds) => ds.label)];
      const header = headerCols.map((h) => csvField(h, sep)).join(sep);
      const rows = (inp.labels ?? []).map((label, i) => {
        const values = datasets.map((ds) => {
          const val = ds.data[i];
          return val != null ? String(val) : '';
        });
        return [csvField(label, sep), ...values].join(sep);
      });
      csv = [header, ...rows].join('\r\n');
    }

    const bom = '\uFEFF';
    const filename = slugify(this.title() ?? 'grafiek') + '.csv';
    this.bridge.downloadFile(filename, bom + csv, 'text/csv;charset=utf-8');
  }

  private buildChartConfig(inp: NormalizedChartInput): ChartConfiguration {
    const isDark = this.bridge.hostTheme() === 'dark';
    const palette = buildPalette(isDark);
    const chartType = inp.type as ChartConfiguration['type'];

    // Theme-aware colors for scales (Chart.defaults don't reliably propagate to all elements)
    const textColor = isDark
      ? readToken('--color-grey-beige-lighter') || '#ecebea'
      : readToken('--color-primary-darker') || '#000c14';
    const gridColor = isDark
      ? `${readToken('--color-dark-border') || '#303036'}99`
      : `${readToken('--color-wb-gray-200') || '#E5E7EB'}CC`;
    const backdropColor = isDark ? 'rgba(18, 18, 20, 0.75)' : 'rgba(255, 255, 255, 0.75)';

    if (inp.type === 'sankey' && inp.sankey) {
      return this.buildSankeyConfig(inp, palette);
    }
    if (inp.type === 'matrix' && inp.matrix) {
      return this.buildMatrixConfig(inp, isDark, textColor, gridColor);
    }
    if (inp.type === 'treemap' && inp.treemap) {
      return this.buildTreemapConfig(inp, palette);
    }
    if (inp.type === 'graph' && inp.graph) {
      return this.buildGraphConfig(inp, palette, isDark);
    }

    const isBoxLike = inp.type === 'boxplot';

    // Detect mixed chart: some datasets override the chart type (e.g. type:'line' on a bar chart)
    const isMixed = (inp.datasets ?? []).some((ds) => ds.type && ds.type !== inp.type);

    const datasets: ChartDataset[] = (inp.datasets ?? []).map((ds, i) => {
      const isScatterLike = inp.type === 'scatter' || inp.type === 'bubble';
      const isPieType = inp.type === 'pie' || inp.type === 'doughnut' || inp.type === 'polarArea';
      // Funnel has one dataset but many segments — color per segment (like pie) instead of per dataset.
      const isSegmentColored = isPieType || inp.type === 'funnel';

      // Decimation plugin requires parsing:false + {x,y} data + linear/time x-axis.
      // Only enable for line datasets that actually use scatterData (pre-parsed format).
      const useRawParsing = inp.type === 'line' && !!ds.scatterData;

      const isLineLike = inp.type === 'line' || ds.type === 'line';

      // boxplot accepts either raw samples (number[][]) or pre-computed stats.
      // The plugin auto-detects the shape on the dataset's `data` field.
      const boxData = isBoxLike ? (ds.samples ?? ds.stats ?? []) : null;

      const base: Record<string, unknown> = {
        label: ds.label,
        ...(useRawParsing ? { parsing: false } : {}),
        data: boxData ?? (isScatterLike && ds.scatterData ? ds.scatterData : ds.data),
        backgroundColor:
          ds.backgroundColor ??
          (isSegmentColored ? palette.backgrounds : palette.backgrounds[i % palette.backgrounds.length]),
        borderColor:
          ds.borderColor ?? (isSegmentColored ? palette.borders : palette.borders[i % palette.borders.length]),
        borderWidth: isPieType ? 2 : 2,
        ...(isLineLike ? { pointHitRadius: 12, pointHoverRadius: 5 } : {}),
      };

      if (ds.fill !== undefined) base['fill'] = ds.fill;
      if (ds.tension !== undefined) base['tension'] = ds.tension;
      if (ds.spanGaps !== undefined) base['spanGaps'] = ds.spanGaps;
      if (ds.borderDash) base['borderDash'] = ds.borderDash;
      if (ds.type) base['type'] = ds.type;
      if (ds.order !== undefined) base['order'] = ds.order;

      // Mixed chart: override datasets get secondary y-axis (right side)
      if (isMixed && ds.type) {
        base['yAxisID'] = 'y1';
      } else if (isMixed) {
        base['yAxisID'] = 'y';
      }

      return base as unknown as ChartDataset;
    });

    const opts = inp.options ?? {};
    const showLegend = opts.showLegend ?? datasets.length > 1;
    const showGrid = opts.showGrid ?? !['pie', 'doughnut', 'radar', 'polarArea', 'funnel'].includes(inp.type);
    // Funnel keeps its category axis so stage labels are readable, but without gridlines.
    const noAxes = ['pie', 'doughnut', 'sankey'].includes(inp.type);

    const tooltipConfig = this.buildTooltipConfig();
    const legendConfig = this.buildLegendConfig(showLegend);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scales: Record<string, any> = {};
    const isRadial = inp.type === 'radar' || inp.type === 'polarArea';
    if (!noAxes && !isRadial) {
      const xKey = opts.indexAxis === 'y' ? 'y' : 'x';
      const yKey = opts.indexAxis === 'y' ? 'x' : 'y';

      scales[xKey] = {
        display: true,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor },
        stacked: opts.stacked ?? false,
        ...(opts.xAxisLabel ? { title: { display: true, text: opts.xAxisLabel, color: textColor } } : {}),
      };
      scales[yKey] = {
        display: true,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor },
        stacked: opts.stacked ?? false,
        ...(opts.yAxisLabel ? { title: { display: true, text: opts.yAxisLabel, color: textColor } } : {}),
      };

      // Mixed chart: add secondary y-axis on right side
      if (isMixed) {
        const overlayDs = (inp.datasets ?? []).find((ds) => ds.type);
        scales['y1'] = {
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: textColor },
          ...(overlayDs ? { title: { display: true, text: overlayDs.label, color: textColor } } : {}),
        };
      }
    } else if (isRadial) {
      scales['r'] = {
        display: true,
        grid: { display: showGrid, color: gridColor },
        ticks: { color: textColor, backdropColor: isDark ? 'transparent' : backdropColor },
        ...(inp.type === 'radar' ? { pointLabels: { color: textColor } } : {}),
      };
    }

    // Line/bar: tooltip triggers on nearest x-axis position, not just on the point itself
    const useCrosshair = ['line', 'bar'].includes(inp.type) || isMixed;
    const interaction = useCrosshair ? { mode: 'index' as const, intersect: false } : undefined;

    return {
      type: chartType,
      data: {
        labels: inp.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        indexAxis: (opts.indexAxis as 'x' | 'y') ?? 'x',
        ...(interaction ? { interaction } : {}),
        plugins: {
          tooltip: tooltipConfig,
          legend: legendConfig,
          // Decimation: auto-downsample large line datasets for performance
          // Requires parsing: false (data already parsed) and indexAxis x with linear/time x-scale
          ...(inp.type === 'line' ? { decimation: { enabled: true, algorithm: 'min-max' } } : {}),
          ...this.buildAnnotationPlugin(opts.annotations, palette),
        },
        ...(Object.keys(scales).length > 0 ? { scales } : {}),
      },
    };
  }

  private buildAnnotationPlugin(
    annotations: AnnotationInput[] | undefined,
    palette: { backgrounds: string[]; borders: string[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> {
    if (!annotations?.length) return {};
    const warning = readToken('--color-warning') || palette.borders[1] || '#d32f2f';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: Record<string, any> = {};
    annotations.forEach((a, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry: Record<string, any> = {
        type: a.type,
        borderColor: a.borderColor ?? warning,
        borderWidth: a.borderWidth ?? 2,
      };
      if (a.type === 'line') {
        if (a.scaleID !== undefined) entry['scaleID'] = a.scaleID;
        if (a.value !== undefined) entry['value'] = a.value;
        if (a.borderDash) entry['borderDash'] = a.borderDash;
      } else if (a.type === 'box') {
        if (a.xMin !== undefined) entry['xMin'] = a.xMin;
        if (a.xMax !== undefined) entry['xMax'] = a.xMax;
        if (a.yMin !== undefined) entry['yMin'] = a.yMin;
        if (a.yMax !== undefined) entry['yMax'] = a.yMax;
        entry['backgroundColor'] = a.backgroundColor ?? `${warning}20`;
      } else if (a.type === 'label') {
        if (a.xMin !== undefined) entry['xValue'] = a.xMin;
        if (a.yMin !== undefined) entry['yValue'] = a.yMin;
      }
      if (a.label) {
        entry['label'] = {
          content: a.label.content,
          display: a.label.display ?? true,
          position: a.label.position ?? 'end',
          backgroundColor: a.backgroundColor ?? warning,
          color: '#fff',
          padding: 4,
        };
      }
      entries[`annotation_${idx}`] = entry;
    });
    return { annotation: { annotations: entries } };
  }

  private buildSankeyConfig(
    inp: NormalizedChartInput,
    palette: { backgrounds: string[]; borders: string[] }
  ): ChartConfiguration {
    const sankey = inp.sankey!;

    // Build node color map
    const nodeColors = new Map<string, string>();
    let colorIdx = 0;
    const getNodeColor = (node: string): string => {
      if (sankey.colors?.[node]) return sankey.colors[node];
      if (!nodeColors.has(node)) {
        nodeColors.set(node, palette.borders[colorIdx % palette.borders.length]);
        colorIdx++;
      }
      return nodeColors.get(node)!;
    };

    // Pre-populate colors for all nodes
    const allNodes = new Set<string>();
    for (const f of sankey.flows) {
      allNodes.add(f.from);
      allNodes.add(f.to);
    }
    for (const node of allNodes) getNodeColor(node);

    return {
      type: 'sankey' as ChartConfiguration['type'],
      data: {
        datasets: [
          {
            data: sankey.flows,
            colorFrom: (ctx) => {
              const item = (ctx.dataset.data as Array<{ from: string }>)[ctx.dataIndex];
              return item ? getNodeColor(item.from) : '#ccc';
            },
            colorTo: (ctx) => {
              const item = (ctx.dataset.data as Array<{ to: string }>)[ctx.dataIndex];
              return item ? getNodeColor(item.to) : '#ccc';
            },
            colorMode: sankey.colorMode ?? 'gradient',
            labels: sankey.labels ?? {},
            priority: sankey.priority ?? {},
          } as ChartDataset,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        plugins: {
          tooltip: this.buildTooltipConfig(),
          legend: { display: false },
        },
      },
    };
  }

  private buildMatrixConfig(
    inp: NormalizedChartInput,
    isDark: boolean,
    textColor: string,
    gridColor: string
  ): ChartConfiguration {
    const matrix = inp.matrix!;
    const cells = matrix.cells;
    const minV = Math.min(...cells.map((c) => c.v));
    const maxV = Math.max(...cells.map((c) => c.v));
    const range = maxV - minV || 1;

    const lowColor = matrix.colorScale?.min ?? readToken('--color-primary-lighter') ?? '#8FC4E6';
    const highColor = matrix.colorScale?.max ?? readToken('--color-primary') ?? '#002b49';
    const reverse = matrix.colorScale?.reverse ?? false;

    // Simple linear rgba interpolation between two hex colors.
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      const full =
        clean.length === 3
          ? clean
              .split('')
              .map((c) => c + c)
              .join('')
          : clean.slice(0, 6);
      return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
    };
    const lowRgb = hexToRgb(lowColor);
    const highRgb = hexToRgb(highColor);
    const interpolate = (v: number): string => {
      const t = reverse ? 1 - (v - minV) / range : (v - minV) / range;
      const r = Math.round(lowRgb[0] + (highRgb[0] - lowRgb[0]) * t);
      const g = Math.round(lowRgb[1] + (highRgb[1] - lowRgb[1]) * t);
      const b = Math.round(lowRgb[2] + (highRgb[2] - lowRgb[2]) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const xLabels = matrix.xLabels ?? Array.from(new Set(cells.map((c) => String(c.x))));
    const yLabels = matrix.yLabels ?? Array.from(new Set(cells.map((c) => String(c.y))));

    return {
      type: 'matrix' as ChartConfiguration['type'],
      data: {
        datasets: [
          {
            label: inp.title ?? 'Matrix',
            data: cells as unknown as number[],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            backgroundColor: (ctx: any) => {
              const cell = ctx.dataset.data[ctx.dataIndex] as MatrixCellInput | undefined;
              return cell ? interpolate(cell.v) : 'transparent';
            },
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            borderWidth: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            width: (ctx: any) => {
              const area = ctx.chart.chartArea;
              return area ? area.width / xLabels.length - 2 : 20;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            height: (ctx: any) => {
              const area = ctx.chart.chartArea;
              return area ? area.height / yLabels.length - 2 : 20;
            },
          } as unknown as ChartDataset,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        plugins: {
          tooltip: {
            ...this.buildTooltipConfig(),
            callbacks: {
              title: () => '',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label: (ctx: any) => {
                const cell = ctx.dataset.data[ctx.dataIndex] as MatrixCellInput;
                return `${cell.x} × ${cell.y}: ${cell.v}`;
              },
            },
          },
          legend: { display: false },
        },
        scales: {
          x: {
            type: 'category',
            labels: xLabels,
            grid: { display: false, color: gridColor },
            ticks: { color: textColor },
            ...(inp.options?.xAxisLabel
              ? { title: { display: true, text: inp.options.xAxisLabel, color: textColor } }
              : {}),
          },
          y: {
            type: 'category',
            labels: yLabels,
            offset: true,
            reverse: true,
            grid: { display: false, color: gridColor },
            ticks: { color: textColor },
            ...(inp.options?.yAxisLabel
              ? { title: { display: true, text: inp.options.yAxisLabel, color: textColor } }
              : {}),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as unknown as any,
      },
    };
  }

  private buildTreemapConfig(
    inp: NormalizedChartInput,
    palette: { backgrounds: string[]; borders: string[] }
  ): ChartConfiguration {
    const treemap = inp.treemap!;
    const labelOpts = treemap.labels ?? { display: true, formatter: 'name-value' };

    return {
      type: 'treemap' as ChartConfiguration['type'],
      data: {
        datasets: [
          {
            label: inp.title ?? 'Treemap',
            tree: treemap.tree,
            key: treemap.key,
            groups: treemap.groups,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            backgroundColor: (ctx: any) => {
              if (ctx.type !== 'data') return 'transparent';
              const node = ctx.raw?._data ?? ctx.raw;
              if (!node) return palette.backgrounds[0];
              const groupKey = treemap.groups?.[0];
              const groupVal = groupKey ? String(node[groupKey] ?? '') : String(ctx.dataIndex);
              // Stable-ish index: hash first group value
              let hash = 0;
              for (let i = 0; i < groupVal.length; i++) hash = (hash * 31 + groupVal.charCodeAt(i)) | 0;
              const idx = Math.abs(hash) % palette.backgrounds.length;
              return palette.backgrounds[idx];
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            borderColor: (ctx: any) => {
              if (ctx.type !== 'data') return 'transparent';
              return 'rgba(255,255,255,0.6)';
            },
            borderWidth: 1,
            spacing: 1,
            labels: {
              display: labelOpts.display ?? true,
              color: '#fff',
              font: { family: readToken('--font-sans') || 'Roboto, sans-serif', size: 11, weight: '600' as const },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter: (ctx: any) => {
                const node = ctx.raw?._data ?? ctx.raw;
                if (!node) return '';
                const leafKey = treemap.groups?.[treemap.groups.length - 1] ?? treemap.key;
                const name = String(node[leafKey] ?? '');
                const value = node[treemap.key];
                if (labelOpts.formatter === 'name') return name;
                if (labelOpts.formatter === 'name-percent' && typeof value === 'number') {
                  const total = treemap.tree.reduce((acc, r) => acc + (Number(r[treemap.key]) || 0), 0);
                  return total > 0 ? `${name}\n${((value / total) * 100).toFixed(1)}%` : name;
                }
                return `${name}\n${value ?? ''}`;
              },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as unknown as any,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        plugins: {
          tooltip: {
            ...this.buildTooltipConfig(),
            callbacks: {
              title: () => '',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label: (ctx: any) => {
                const node = ctx.raw?._data ?? ctx.raw;
                if (!node) return '';
                const parts: string[] = [];
                for (const g of treemap.groups ?? []) {
                  if (node[g] != null) parts.push(`${g}: ${node[g]}`);
                }
                parts.push(`${treemap.key}: ${node[treemap.key]}`);
                return parts;
              },
            },
          },
          legend: { display: false },
        },
      },
    };
  }

  private buildGraphConfig(
    inp: NormalizedChartInput,
    palette: { backgrounds: string[]; borders: string[] },
    isDark: boolean
  ): ChartConfiguration {
    const graph = inp.graph!;
    const typeMap: Record<'force' | 'tree' | 'dendrogram', string> = {
      force: 'forceDirectedGraph',
      tree: 'tree',
      dendrogram: 'dendrogram',
    };
    const chartJsType = typeMap[graph.layout];

    // Group → color index
    const groupColor = new Map<string, string>();
    const nodeColors = graph.nodes.map((n, i) => {
      const key = n.group ?? '_default';
      if (!groupColor.has(key)) {
        groupColor.set(key, palette.borders[groupColor.size % palette.borders.length]);
      }
      return groupColor.get(key) ?? palette.borders[i % palette.borders.length];
    });

    // Convert edges to {source, target} index pairs (chartjs-chart-graph requires indices).
    // The backend already rejects dangling edges, so this is belt-and-suspenders —
    // but the viewer injects demos directly (bypassing the backend), so a typo in a
    // demo would silently drop edges with no signal. Warn in dev so data-quality
    // issues surface immediately.
    const idToIndex = new Map(graph.nodes.map((n, i) => [n.id, i] as const));
    const droppedEdges: GraphEdgeInput[] = [];
    const edgeData = graph.edges
      .map((e) => {
        const s = idToIndex.get(e.source);
        const t = idToIndex.get(e.target);
        if (s === undefined || t === undefined) {
          droppedEdges.push(e);
          return null;
        }
        return { source: s, target: t };
      })
      .filter((edge): edge is { source: number; target: number } => edge !== null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDev = Boolean((import.meta as any).env?.DEV);
    if (droppedEdges.length > 0 && isDev) {
      console.warn(
        `[ChartComponent] graph: dropped ${droppedEdges.length} edge(s) with unknown source/target node id(s):`,
        droppedEdges
      );
    }

    // Node positions: only pass {x, y} when the caller explicitly provided them.
    // For auto-layout (force/tree/dendrogram), use empty objects — letting the
    // plugin's simulation populate positions. Passing {x: NaN, y: NaN} causes
    // Chart.js to compute NaN scale ranges after the animation, which wipes
    // all elements off the viewport.
    const nodePoints = graph.nodes.map((n) => (n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : {}));
    const labels = graph.nodes.map((n) => n.label ?? n.id);

    // Edges share the dataset's borderColor/borderWidth. Chart.defaults.borderColor
    // is set to a very light theme token for gridlines — without explicit colors
    // here the EdgeLine renders nearly invisibly on white.
    const edgeColor = isDark ? 'rgba(236, 235, 234, 0.55)' : 'rgba(0, 43, 73, 0.6)';

    return {
      type: chartJsType as ChartConfiguration['type'],
      data: {
        labels,
        datasets: [
          {
            pointBackgroundColor: nodeColors,
            pointBorderColor: isDark ? '#1a1a1f' : '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 7,
            pointHoverRadius: 10,
            borderColor: edgeColor,
            borderWidth: 1.5,
            data: nodePoints,
            edges: edgeData,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as unknown as any,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        layout: { padding: 24 },
        plugins: {
          tooltip: {
            ...this.buildTooltipConfig(),
            callbacks: {
              title: () => '',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label: (ctx: any) => {
                const node = graph.nodes[ctx.dataIndex];
                if (!node) return '';
                const parts = [node.label ?? node.id];
                if (node.group) parts.push(`(${node.group})`);
                return parts.join(' ');
              },
            },
          },
          legend: { display: false },
        },
        // Explicit bounded scales — without these, Chart.js auto-fits scales to
        // the simulation output and occasionally computes a degenerate range,
        // which pushes every element off-canvas after the animation completes.
        scales: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          x: { type: 'linear', display: false, min: -1, max: 1 } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y: { type: 'linear', display: false, min: -1, max: 1 } as any,
        },
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildTooltipConfig(): Record<string, any> {
    return {
      backgroundColor: readToken('--color-primary') || '#002b49',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: readToken('--color-primary-high') || '#00538f',
      borderWidth: 1,
      cornerRadius: parseInt(readToken('--radius-s')) || 6,
      padding: 8,
      titleFont: { family: readToken('--font-sans') || 'Roboto, sans-serif', weight: '600' as const },
      bodyFont: { family: readToken('--font-sans') || 'Roboto, sans-serif' },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildLegendConfig(show: boolean): Record<string, any> {
    return {
      display: show,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 16,
        font: { family: readToken('--font-sans') || 'Roboto, sans-serif', size: 12 },
      },
    };
  }
}
