import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  FlexRender,
  injectTable,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  createPaginatedRowModel,
  createFilteredRowModel,
  sortFns,
  filterFns,
  isFunction,
} from '@tanstack/angular-table';
import type {
  SortingState,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  ColumnVisibilityState,
  Updater,
} from '@tanstack/angular-table';
import { McpBridgeService } from '../../shared/mcp-bridge.service';
import { decodeUnicodeEscapes } from '../../shared/decode-escapes';
import {
  NL_NUMBER,
  NL_CURRENCY,
  NL_PERCENT,
  NL_DATE,
  parseIsoDate,
  extractLinkLabel,
  extractLinkHref,
  isSafeImageUrl,
  detectAutoTextShape,
  type AutoTextShape,
} from '../../shared/auto-format';
import { TABLE_ICONS } from './table-icons';

// ── Types ────────────────────────────────────────────────────────────────────

interface ColumnConfig {
  key: string;
  header: string;
  type?: string;
  align?: string;
  width?: string;
  sortable?: boolean;
  filterable?: boolean;
  badgeMap?: Record<string, { label?: string; color: string }>;
  iconMap?: Record<string, { icon: string; color?: string; label?: string }>;
  sparklineConfig?: { color?: string; sortBy?: 'last' | 'avg' | 'min' | 'max' };
  progressConfig?: { thresholds?: { warn: number; danger: number }; invertColors?: boolean };
  trendConfig?: { valueType?: 'number' | 'currency' | 'percentage'; invertColors?: boolean };
  linkConfig?: { target?: '_blank' | '_self' };
  ratingConfig?: { max?: number; shape?: 'stars' | 'dots'; color?: string };
  imageConfig?: { width?: number; height?: number; alt?: string; shape?: 'square' | 'circle' };
  footer?: string;
}

interface TableInput {
  columns: ColumnConfig[];
  /**
   * Either:
   * - Array of records: `[{Id: "3451", Naam: "André"}]`
   * - Array of arrays (positional, values match `columns[]` order): `[["3451", "André"]]`
   * The second form cuts payload size ~40% on large datasets by omitting key repetition.
   */
  data: Array<Record<string, unknown>> | Array<Array<unknown>>;
  features?: {
    sorting?: boolean;
    filtering?: boolean;
    globalSearch?: boolean;
    pagination?: boolean;
    pageSize?: number;
    selection?: boolean;
    columnVisibility?: boolean;
  };
  title?: string;
  emptyMessage?: string;
  density?: string;
  striped?: boolean;
  bordered?: boolean;
  theme?: string;
  maxHeight?: string;
}

// ── TanStack v9 Feature Registration ─────────────────────────────────────────

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
});

// Row models created inline in injectTable to satisfy generic constraints

// ── Column Meta Extension ────────────────────────────────────────────────────

declare module '@tanstack/angular-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures, TData, TValue> {
    type?: string;
    align?: string;
    header?: string;
    badgeMap?: Record<string, { label?: string; color: string }>;
    footerAgg?: string;
    width?: string;
    filterable?: boolean;
    iconMap?: Record<string, { icon: string; color?: string; label?: string }>;
    sparklineConfig?: { color?: string; sortBy?: 'last' | 'avg' | 'min' | 'max' };
    progressConfig?: { thresholds?: { warn: number; danger: number }; invertColors?: boolean };
    trendConfig?: { valueType?: 'number' | 'currency' | 'percentage'; invertColors?: boolean };
    linkConfig?: { target?: '_blank' | '_self' };
    ratingConfig?: { max?: number; shape?: 'stars' | 'dots'; color?: string };
    imageConfig?: { width?: number; height?: number; alt?: string; shape?: 'square' | 'circle' };
  }
}

// ── Formatting Helpers ───────────────────────────────────────────────────────

function formatCell(value: unknown, type: string): string {
  if (value == null) return '';
  switch (type) {
    case 'number':
      return typeof value === 'number' ? NL_NUMBER.format(value) : String(value);
    case 'currency':
      return typeof value === 'number' ? NL_CURRENCY.format(value) : String(value);
    case 'percentage':
      return typeof value === 'number' ? NL_PERCENT.format(value) : String(value);
    case 'date': {
      const d = parseIsoDate(String(value));
      return isNaN(d.getTime()) ? String(value) : NL_DATE.format(d);
    }
    case 'boolean':
      return value ? '\u2713' : '\u2717'; // fallback text; template uses SVG icons
    default:
      return String(value);
  }
}

function formatFooter(spec: string, values: number[]): number {
  switch (spec) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count':
      return values.length;
    case 'min':
      return values.length ? Math.min(...values) : 0;
    case 'max':
      return values.length ? Math.max(...values) : 0;
    default:
      return 0;
  }
}

const DEFAULT_ALIGN: Record<string, string> = {
  text: 'left',
  number: 'right',
  currency: 'right',
  percentage: 'right',
  date: 'left',
  boolean: 'center',
  badge: 'center',
  icon: 'center',
  sparkline: 'center',
  progress: 'left',
  trend: 'right',
  multi_badge: 'left',
  link: 'left',
  rating: 'center',
  image: 'center',
};

const DENSITY_CLASSES: Record<string, string> = {
  compact: 'px-2 py-1 text-xs',
  normal: 'px-3 py-2 text-sm',
  comfortable: 'px-4 py-3 text-base',
};

const BADGE_COLORS: Record<string, string> = {
  green: 'bg-success/15 text-success',
  red: 'bg-error/15 text-error',
  yellow: 'bg-warning/15 text-warning',
  blue: 'bg-petrol/15 text-petrol',
  gray: 'bg-grey-blue/15 text-grey-blue-darker',
  orange: 'bg-warning/15 text-warning-darker',
};

const ICON_COLORS: Record<string, string> = {
  green: 'text-success',
  red: 'text-error',
  yellow: 'text-warning',
  blue: 'text-petrol',
  gray: 'text-grey-blue',
  orange: 'text-warning-darker',
  primary: 'text-primary',
};

const ALIGN_CLASSES: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// ── Helpers for new cell types ───────────────────────────────────────────────

const PROGRESS_TRACK_CLASS = 'bg-wb-gray-200 dark:bg-dark-surface-raised';
const PROGRESS_OK_CLASS = 'bg-success';
const PROGRESS_WARN_CLASS = 'bg-warning';
const PROGRESS_DANGER_CLASS = 'bg-error';

const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 24;
const SPARKLINE_PAD = 2;

/** Matches the MAX_IMAGES_PER_CALL cap in fetch-image.ts — keep in sync. */
const IMAGE_FETCH_BATCH_SIZE = 50;

function aggregateSparkline(values: unknown, mode: 'last' | 'avg' | 'min' | 'max'): number {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const nums = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));
  if (nums.length === 0) return 0;
  switch (mode) {
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    case 'last':
    default:
      return nums[nums.length - 1] ?? 0;
  }
}

/**
 * Build an inline SVG polyline for a sparkline. Returns null for arrays with < 2 valid points.
 */
function buildSparklineSvg(values: unknown): string | null {
  if (!Array.isArray(values) || values.length < 2) return null;
  const nums = values.map((v) => (typeof v === 'number' && !isNaN(v) ? v : null));
  const valid = nums.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const innerW = SPARKLINE_WIDTH - SPARKLINE_PAD * 2;
  const innerH = SPARKLINE_HEIGHT - SPARKLINE_PAD * 2;
  const step = innerW / (nums.length - 1);

  const points: string[] = [];
  nums.forEach((v, idx) => {
    if (v === null) return;
    const x = SPARKLINE_PAD + idx * step;
    const y = SPARKLINE_PAD + innerH - ((v - min) / range) * innerH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (points.length < 2) return null;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}" ` +
    `width="${SPARKLINE_WIDTH}" height="${SPARKLINE_HEIGHT}" aria-hidden="true">` +
    `<polyline fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ` +
    `stroke-linejoin="round" points="${points.join(' ')}" /></svg>`
  );
}

/**
 * Pick a progress bar color class given a 0..1 value and config.
 * Default semantics: low is good (green <70%, orange 70-90%, red >90%).
 * invertColors=true flips this (high is good).
 */
function progressColorClass(
  value: number,
  config: { thresholds?: { warn: number; danger: number }; invertColors?: boolean } | undefined
): string {
  const warn = config?.thresholds?.warn ?? 0.7;
  const danger = config?.thresholds?.danger ?? 0.9;
  if (config?.invertColors) {
    if (value >= danger) return PROGRESS_OK_CLASS;
    if (value >= warn) return PROGRESS_WARN_CLASS;
    return PROGRESS_DANGER_CLASS;
  }
  if (value >= danger) return PROGRESS_DANGER_CLASS;
  if (value >= warn) return PROGRESS_WARN_CLASS;
  return PROGRESS_OK_CLASS;
}

interface TrendValue {
  value: number;
  delta: number;
  direction?: 'up' | 'down' | 'flat';
}

function extractTrendValue(raw: unknown): number | null {
  if (raw && typeof raw === 'object' && 'value' in raw && typeof (raw as TrendValue).value === 'number') {
    return (raw as TrendValue).value;
  }
  return null;
}

function trendDirection(value: TrendValue): 'up' | 'down' | 'flat' {
  if (value.direction) return value.direction;
  if (value.delta > 0.0001) return 'up';
  if (value.delta < -0.0001) return 'down';
  return 'flat';
}

// ── Export Helpers ────────────────────────────────────────────────────────────

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
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlexRender],
  template: `
    @if (!bridge.connected() && !bridge.error()) {
      <div class="rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card overflow-hidden">
        <div class="bg-primary px-3 py-1.5">
          <div class="h-4 w-32 bg-white/20 rounded animate-pulse"></div>
        </div>
        <div class="p-4 space-y-2">
          @for (_ of skeletonRows; track $index) {
            <div class="h-8 bg-wb-gray-100 dark:bg-dark-surface rounded animate-pulse"></div>
          }
        </div>
      </div>
    }

    @if (bridge.error()) {
      <div class="rounded-[var(--radius-card)] bg-white dark:bg-dark-surface-raised shadow-card p-6 text-center">
        <p class="text-sm text-wb-gray-500 dark:text-grey-blue">{{ bridge.error() }}</p>
      </div>
    }

    @if (bridge.connected() && !bridge.error() && input()) {
      <div class="w-full">
        <!-- Table wrapper (title + toolbar + table in one block) -->
        <div
          class="overflow-hidden rounded-[var(--radius-card)] border border-wb-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
        >
          <div class="bg-primary px-3 py-1.5 flex items-center justify-between gap-2">
            @if (title()) {
              <h3 class="text-sm font-medium text-white truncate">{{ title() }}</h3>
            }
            <button
              type="button"
              (click)="exportCsv()"
              aria-label="Download als CSV"
              class="ml-auto inline-flex items-center rounded-[var(--radius-s)] px-2 py-0.5 text-xs font-medium
                     text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50
                     transition-colors whitespace-nowrap"
            >
              CSV
            </button>
          </div>

          <!-- Global search + column visibility toolbar -->
          @if (input()!.features?.globalSearch || input()!.features?.columnVisibility) {
            <div
              class="px-3 py-2 bg-wb-gray-50 dark:bg-dark-surface-raised border-b border-wb-gray-200 dark:border-dark-border flex items-center gap-3"
            >
              @if (input()!.features?.globalSearch) {
                <input
                  type="text"
                  placeholder="Zoeken..."
                  [value]="globalFilter()"
                  (input)="onGlobalFilter($event)"
                  class="flex-1 rounded-[var(--radius-s)] border border-wb-gray-300
                       bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1
                       focus:ring-focus/50 focus:border-focus
                       dark:bg-dark-surface dark:border-dark-border
                       dark:text-grey-beige-lighter"
                />
              }
              @if (input()!.features?.columnVisibility) {
                <div class="flex flex-wrap gap-1">
                  @for (col of input()!.columns; track col.key) {
                    <label
                      class="inline-flex items-center gap-1 rounded-[var(--radius-s)] border border-wb-gray-200
                           dark:border-dark-border px-2 py-0.5 text-xs cursor-pointer bg-white
                           hover:bg-wb-gray-100 dark:bg-dark-surface dark:hover:bg-dark-surface-raised"
                    >
                      <input
                        type="checkbox"
                        [checked]="columnVisibility()[col.key] !== false"
                        (change)="toggleColumnVisibility(col.key)"
                        class="accent-primary"
                      />
                      {{ col.header }}
                    </label>
                  }
                </div>
              }
            </div>
          }
          <div class="overflow-auto" [style.maxHeight]="input()!.maxHeight ?? null">
            <table class="w-full border-collapse">
              <!-- Header -->
              <thead class="sticky top-0 z-10">
                @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
                  <!-- Column headers -->
                  <tr class="bg-wb-gray-600 text-white">
                    @if (input()!.features?.selection) {
                      <th class="w-8 px-2 py-2">
                        <input
                          type="checkbox"
                          [checked]="table.getIsAllRowsSelected()"
                          (change)="table.toggleAllRowsSelected()"
                          class="accent-white"
                        />
                      </th>
                    }
                    @for (header of headerGroup.headers; track header.id) {
                      <th
                        class="font-medium whitespace-nowrap select-none"
                        [class]="getHeaderClasses(header.column.columnDef)"
                        [class.cursor-pointer]="header.column.getCanSort()"
                        [class.hover:bg-wb-gray-600]="header.column.getCanSort()"
                        [style.width]="header.column.columnDef.meta?.width ?? null"
                        (click)="
                          header.column.getCanSort() ? header.column.toggleSorting(undefined, $event.shiftKey) : null
                        "
                      >
                        <div
                          class="flex items-center gap-1"
                          [class.justify-end]="getAlign(header.column.columnDef) === 'right'"
                          [class.justify-center]="getAlign(header.column.columnDef) === 'center'"
                        >
                          <ng-container *flexRenderHeader="header; let headerText">
                            {{ headerText }}
                          </ng-container>
                          @if (header.column.getIsSorted() === 'asc') {
                            <span class="w-3.5 h-3.5 inline-block opacity-80" [innerHTML]="sortUpIcon"></span>
                          }
                          @if (header.column.getIsSorted() === 'desc') {
                            <span class="w-3.5 h-3.5 inline-block opacity-80" [innerHTML]="sortDownIcon"></span>
                          }
                        </div>
                      </th>
                    }
                  </tr>
                  <!-- Filter row (separate from headers) -->
                  @if (input()!.features?.filtering) {
                    <tr
                      class="bg-wb-gray-50 dark:bg-dark-surface-raised border-b border-wb-gray-200 dark:border-dark-border"
                    >
                      @if (input()!.features?.selection) {
                        <td class="w-8"></td>
                      }
                      @for (header of headerGroup.headers; track header.id) {
                        <td class="px-2 py-1.5">
                          @if (header.column.columnDef.meta?.filterable !== false) {
                            <input
                              type="text"
                              placeholder="Filter..."
                              [value]="getFilterValue(header.column)"
                              (input)="header.column.setFilterValue(getInputValue($event))"
                              class="w-full rounded-[var(--radius-s)] border border-wb-gray-300
                                   bg-white px-2 py-1 text-xs text-wb-gray-700
                                   placeholder:text-wb-gray-400 focus:outline-none focus:ring-1
                                   focus:ring-focus/50 focus:border-focus
                                   dark:bg-dark-surface dark:border-dark-border dark:text-grey-beige-lighter"
                            />
                          }
                        </td>
                      }
                    </tr>
                  }
                }
              </thead>

              <!-- Body -->
              <tbody class="divide-y divide-wb-gray-100 dark:divide-dark-border">
                @for (row of table.getRowModel().rows; track row.id; let even = $even) {
                  <tr [class]="rowClasses(even, row.getIsSelected())">
                    @if (input()!.features?.selection) {
                      <td class="w-8 px-2 text-center" [class]="densityClass()">
                        <input
                          type="checkbox"
                          [checked]="row.getIsSelected()"
                          (change)="row.toggleSelected()"
                          class="accent-primary"
                        />
                      </td>
                    }
                    @for (cell of row.getVisibleCells(); track cell.id) {
                      <td
                        [class]="
                          getCellClasses(cell.column.columnDef) +
                          (input()!.bordered ? ' border-r border-wb-gray-200 dark:border-dark-border' : '')
                        "
                      >
                        @if (cell.column.columnDef.meta?.type === 'badge') {
                          @if (getBadgeConfig(cell.column.columnDef, cell.getValue()); as badge) {
                            <span
                              class="inline-flex items-center rounded-[var(--radius-badge)] px-2 py-0.5 text-xs font-medium"
                              [class]="badge.colorClass"
                            >
                              {{ badge.label }}
                            </span>
                          } @else {
                            {{ formatCellValue(cell.getValue(), 'text') }}
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'boolean') {
                          @if (getIconConfig(cell.column.columnDef, cell.getValue()); as ic) {
                            <span
                              class="w-4 h-4 inline-block"
                              [class]="ic.colorClass"
                              [innerHTML]="ic.svg"
                              [title]="ic.label"
                            ></span>
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'icon') {
                          @if (getIconConfig(cell.column.columnDef, cell.getValue()); as ic) {
                            <span
                              class="w-4 h-4 inline-block"
                              [class]="ic.colorClass"
                              [innerHTML]="ic.svg"
                              [title]="ic.label"
                            ></span>
                          } @else {
                            {{ formatCellValue(cell.getValue(), 'text') }}
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'sparkline') {
                          @if (getSparklineRender(cell.column.columnDef, cell.getValue()); as sl) {
                            <span
                              class="inline-block align-middle"
                              [class]="sl.colorClass"
                              [innerHTML]="sl.svg"
                              [title]="sl.title"
                            ></span>
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'progress') {
                          @if (getProgressRender(cell.column.columnDef, cell.getValue()); as pg) {
                            <!-- Outer wrapper is the hover target: fills the cell's content area so hovering
                                 anywhere in the cell — not just the thin 8px bar — shows the tooltip. -->
                            <div
                              class="flex items-center w-full min-w-[80px] py-2 -my-2"
                              [attr.role]="'progressbar'"
                              [attr.aria-valuenow]="pg.percent"
                              [attr.aria-valuemin]="0"
                              [attr.aria-valuemax]="100"
                              [attr.aria-label]="pg.label"
                              [title]="pg.label"
                            >
                              <div class="h-2 w-full rounded-full overflow-hidden" [class]="pg.trackClass">
                                <div
                                  class="h-full rounded-full"
                                  [class]="pg.barClass"
                                  [style.width.%]="pg.percent"
                                ></div>
                              </div>
                            </div>
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'trend') {
                          @if (getTrendRender(cell.column.columnDef, cell.getValue()); as tr) {
                            <span class="inline-flex items-center gap-1 tabular-nums" [title]="tr.title">
                              <span>{{ tr.valueLabel }}</span>
                              <span
                                class="w-3 h-3 inline-block"
                                [class]="tr.colorClass"
                                [innerHTML]="tr.arrowSvg"
                              ></span>
                              <span class="text-xs" [class]="tr.colorClass">{{ tr.deltaLabel }}</span>
                            </span>
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'multi_badge') {
                          <span class="inline-flex flex-wrap gap-1">
                            @for (b of getMultiBadgeRender(cell.column.columnDef, cell.getValue()); track $index) {
                              <span
                                class="inline-flex items-center rounded-[var(--radius-badge)] px-2 py-0.5 text-xs font-medium"
                                [class]="b.colorClass"
                              >
                                {{ b.label }}
                              </span>
                            }
                          </span>
                        } @else if (cell.column.columnDef.meta?.type === 'link') {
                          @let link = getLinkRender(cell.column.columnDef, cell.getValue());
                          @if (link.href) {
                            <a
                              [href]="link.href"
                              [target]="link.target"
                              rel="noopener noreferrer"
                              class="text-petrol hover:text-petrol-darker underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-petrol/50 rounded"
                              (click)="onLinkClick($event, link.href)"
                            >
                              {{ link.label }}
                            </a>
                          } @else {
                            {{ link.label }}
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'rating') {
                          @if (getRatingRender(cell.column.columnDef, cell.getValue()); as rt) {
                            <span
                              class="inline-flex items-center gap-0.5"
                              [class]="rt.colorClass"
                              [title]="rt.title"
                              role="img"
                              [attr.aria-label]="rt.title"
                            >
                              @for (g of rt.glyphs; track $index) {
                                @if (g.state === 'full') {
                                  <span>{{ g.shape === 'dots' ? '●' : '★' }}</span>
                                } @else if (g.state === 'half') {
                                  @if (g.shape === 'dots') {
                                    <span>◐</span>
                                  } @else {
                                    <!-- Half star: filled star clipped to left 50% over an empty-star baseline. -->
                                    <span class="relative inline-block">
                                      <span class="opacity-30">☆</span>
                                      <span
                                        class="absolute inset-y-0 left-0 overflow-hidden"
                                        style="width: 50%"
                                        aria-hidden="true"
                                        >★</span
                                      >
                                    </span>
                                  }
                                } @else {
                                  <span class="opacity-30">{{ g.shape === 'dots' ? '○' : '☆' }}</span>
                                }
                              }
                            </span>
                          }
                        } @else if (cell.column.columnDef.meta?.type === 'image') {
                          @if (getImageRender(cell.column.columnDef, cell.getValue()); as im) {
                            @if (im.src) {
                              <img
                                [src]="im.src"
                                [alt]="im.alt"
                                [width]="im.width"
                                [height]="im.height"
                                [class]="
                                  im.rounded
                                    ? 'rounded-full object-cover inline-block'
                                    : 'rounded object-cover inline-block'
                                "
                                loading="lazy"
                              />
                            } @else {
                              <span
                                [class]="
                                  im.rounded
                                    ? 'rounded-full bg-wb-gray-200 dark:bg-dark-surface-raised inline-block animate-pulse'
                                    : 'rounded bg-wb-gray-200 dark:bg-dark-surface-raised inline-block animate-pulse'
                                "
                                [style.width.px]="im.width"
                                [style.height.px]="im.height"
                                [attr.aria-label]="'laden…'"
                              ></span>
                            }
                          } @else {
                            <span class="text-xs text-wb-gray-400 dark:text-grey-blue italic">geen afbeelding</span>
                          }
                        } @else if (
                          (cell.column.columnDef.meta?.type ?? 'text') === 'text' && getAutoTextRender(cell.getValue());
                          as auto
                        ) {
                          @if (auto.href) {
                            <a
                              [href]="auto.href"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-petrol hover:text-petrol-darker underline underline-offset-2 focus:outline-none focus:ring-1 focus:ring-petrol/50 rounded"
                              (click)="onLinkClick($event, auto.href)"
                            >
                              {{ auto.label }}
                            </a>
                          } @else {
                            {{ auto.label }}
                          }
                        } @else {
                          {{ formatCellValue(cell.getValue(), cell.column.columnDef.meta?.type ?? 'text') }}
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td
                      [attr.colspan]="totalColumns()"
                      class="px-4 py-8 text-center text-sm text-wb-gray-400 dark:text-grey-blue"
                    >
                      {{ input()!.emptyMessage ?? 'Geen data beschikbaar' }}
                    </td>
                  </tr>
                }
              </tbody>

              <!-- Footer (aggregation) -->
              @if (hasFooter()) {
                <tfoot
                  class="bg-wb-gray-300 dark:bg-dark-surface-raised font-semibold text-wb-gray-800 dark:text-grey-beige-lighter"
                >
                  <tr>
                    @if (input()!.features?.selection) {
                      <td class="px-2"></td>
                    }
                    @for (col of input()!.columns; track col.key; let first = $first) {
                      <td [class]="getCellClassesForCol(col)">
                        @if (col.footer) {
                          {{ computeFooter(col) }}
                        } @else if (first) {
                          Totaal
                        }
                      </td>
                    }
                  </tr>
                </tfoot>
              }
            </table>
          </div>

          <!-- Pagination (inside wrapper so it sticks to the table) -->
          @if (input()!.features?.pagination !== false && table.getPageCount() > 1) {
            <div
              class="flex items-center justify-between px-3 py-2
                   bg-wb-gray-600 text-white text-sm
                   dark:bg-dark-surface-raised dark:text-grey-beige-lighter"
            >
              <span> Rij {{ paginationStart() }}–{{ paginationEnd() }} van {{ totalRowCount() }} </span>
              <div class="flex items-center gap-1">
                <select
                  [value]="pagination().pageSize"
                  (change)="onPageSizeChange($event)"
                  class="rounded-[var(--radius-s)] border border-white/30 bg-white/10 px-2 py-1 text-xs text-white
                       dark:bg-dark-surface dark:border-dark-border"
                >
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
                  <option [value]="50">50</option>
                  <option [value]="100">100</option>
                </select>
                <button
                  [disabled]="!table.getCanPreviousPage()"
                  (click)="table.previousPage()"
                  class="rounded-[var(--radius-s)] px-2 py-1 border border-white/30
                       hover:bg-white/10 disabled:opacity-40
                       dark:border-dark-border dark:hover:bg-dark-surface"
                >
                  Vorige
                </button>
                <button
                  [disabled]="!table.getCanNextPage()"
                  (click)="table.nextPage()"
                  class="rounded-[var(--radius-s)] px-2 py-1 border border-white/30
                       hover:bg-white/10 disabled:opacity-40
                       dark:border-dark-border dark:hover:bg-dark-surface"
                >
                  Volgende
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class TableComponent implements OnInit {
  readonly bridge = inject(McpBridgeService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly skeletonRows = Array(5);
  readonly icons = TABLE_ICONS;
  readonly sortUpIcon = this.sanitizer.bypassSecurityTrustHtml(TABLE_ICONS['chevron-up'] ?? '');
  readonly sortDownIcon = this.sanitizer.bypassSecurityTrustHtml(TABLE_ICONS['chevron-down'] ?? '');

  // ── State signals ──────────────────────────────────────────────────────

  readonly sorting = signal<SortingState>([]);
  readonly columnFilters = signal<ColumnFiltersState>([]);
  readonly globalFilter = signal<string>('');
  readonly pagination = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly rowSelection = signal<RowSelectionState>({});
  readonly columnVisibility = signal<ColumnVisibilityState>({});

  /** Cache of http(s) image URL → resolved data URL (populated via bridge.callTool('fetch_image')). */
  readonly fetchedImages = signal<Record<string, string>>({});
  private readonly pendingImageUrls = new Set<string>();

  // ── Computed from bridge ───────────────────────────────────────────────

  readonly input = computed(() => {
    const result = this.bridge.toolResult();
    if (!result || !result['columns']) return null;
    return result as unknown as TableInput;
  });

  readonly title = computed(() => {
    const t = this.input()?.title;
    return t ? decodeUnicodeEscapes(t) : null;
  });

  /**
   * Normalizes data to record shape regardless of input form. When rows are
   * arrays, values are zipped with `columns[]` positionally — the first value
   * maps to `columns[0].key`, etc. Extra values (more values than columns) and
   * missing values (shorter rows) are handled gracefully.
   */
  readonly data = computed<Array<Record<string, unknown>>>(() => {
    const inp = this.input();
    if (!inp) return [];
    const raw = inp.data;
    if (!Array.isArray(raw) || raw.length === 0) return [];

    if (Array.isArray(raw[0])) {
      const keys = inp.columns.map((c) => c.key);
      return (raw as Array<Array<unknown>>).map((row) => {
        const record: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) record[keys[i]!] = row[i];
        return record;
      });
    }

    return raw as Array<Record<string, unknown>>;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly columns = computed<any[]>(() => {
    const inp = this.input();
    if (!inp) return [];

    return inp.columns.map((col) => {
      const type = col.type ?? 'text';
      // Images default to non-sortable unless the agent opts in explicitly.
      const enableSorting = col.sortable === false ? false : col.sortable === true ? true : type !== 'image';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decodedHeader = col.header ? decodeUnicodeEscapes(col.header) : col.header;
      const columnDef: any = {
        accessorKey: col.key,
        header: decodedHeader,
        enableSorting,
        meta: {
          type,
          align: col.align ?? DEFAULT_ALIGN[type] ?? 'left',
          header: decodedHeader,
          badgeMap: col.badgeMap,
          iconMap: col.iconMap,
          sparklineConfig: col.sparklineConfig,
          progressConfig: col.progressConfig,
          trendConfig: col.trendConfig,
          linkConfig: col.linkConfig,
          ratingConfig: col.ratingConfig,
          imageConfig: col.imageConfig,
          footerAgg: col.footer,
          width: col.width,
          filterable: col.filterable,
        },
      };

      // Custom sortingFn + filterFn for types whose cell values aren't primitives.
      // Filter matches the RENDERED text, not JSON.stringify of the raw value.
      if (type === 'sparkline') {
        const agg = col.sparklineConfig?.sortBy ?? 'last';
        columnDef.sortingFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowA: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowB: any,
          columnId: string
        ): number =>
          aggregateSparkline(rowA.getValue(columnId), agg) - aggregateSparkline(rowB.getValue(columnId), agg);
      } else if (type === 'trend') {
        columnDef.sortingFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowA: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowB: any,
          columnId: string
        ): number =>
          (extractTrendValue(rowA.getValue(columnId)) ?? 0) - (extractTrendValue(rowB.getValue(columnId)) ?? 0);
        const valueType = col.trendConfig?.valueType ?? 'number';
        columnDef.filterFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row: any,
          columnId: string,
          filterValue: unknown
        ): boolean => {
          const raw = row.getValue(columnId);
          if (!raw || typeof raw !== 'object' || !('value' in raw) || !('delta' in raw)) return false;
          const tv = raw as TrendValue;
          if (typeof tv.value !== 'number' || typeof tv.delta !== 'number') return false;
          const text = `${formatCell(tv.value, valueType)} ${NL_PERCENT.format(tv.delta)}`.toLowerCase();
          return text.includes(String(filterValue ?? '').toLowerCase());
        };
      } else if (type === 'multi_badge') {
        columnDef.sortingFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowA: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowB: any,
          columnId: string
        ): number => {
          const a = rowA.getValue(columnId);
          const b = rowB.getValue(columnId);
          return (Array.isArray(a) ? a.length : 0) - (Array.isArray(b) ? b.length : 0);
        };
        const badgeMap = col.badgeMap;
        columnDef.filterFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row: any,
          columnId: string,
          filterValue: unknown
        ): boolean => {
          const raw = row.getValue(columnId);
          if (!Array.isArray(raw)) return false;
          const text = raw
            .map((item) => {
              const key = String(item ?? '');
              return badgeMap?.[key]?.label ?? key;
            })
            .join(' ')
            .toLowerCase();
          return text.includes(String(filterValue ?? '').toLowerCase());
        };
      } else if (type === 'link') {
        columnDef.sortingFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowA: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rowB: any,
          columnId: string
        ): number => extractLinkLabel(rowA.getValue(columnId)).localeCompare(extractLinkLabel(rowB.getValue(columnId)));
        columnDef.filterFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row: any,
          columnId: string,
          filterValue: unknown
        ): boolean =>
          extractLinkLabel(row.getValue(columnId))
            .toLowerCase()
            .includes(String(filterValue ?? '').toLowerCase());
      } else if (type === 'image') {
        const altText = col.imageConfig?.alt ?? col.header ?? '';
        columnDef.filterFn = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          row: any,
          columnId: string,
          filterValue: unknown
        ): boolean => {
          const raw = row.getValue(columnId);
          const url = typeof raw === 'string' ? raw : '';
          const search = String(filterValue ?? '').toLowerCase();
          return url.toLowerCase().includes(search) || altText.toLowerCase().includes(search);
        };
      }

      return columnDef;
    });
  });

  readonly densityClass = computed(() => {
    const d = this.input()?.density ?? 'normal';
    return DENSITY_CLASSES[d] ?? DENSITY_CLASSES['normal'];
  });

  readonly hasFooter = computed(() => {
    const inp = this.input();
    return inp?.columns.some((c) => c.footer) ?? false;
  });

  readonly totalColumns = computed(() => {
    const inp = this.input();
    const base = inp?.columns.length ?? 0;
    return inp?.features?.selection ? base + 1 : base;
  });

  readonly totalRowCount = computed(() => this.table.getFilteredRowModel().rows.length);

  readonly paginationStart = computed(() => {
    const p = this.pagination();
    return this.totalRowCount() === 0 ? 0 : p.pageIndex * p.pageSize + 1;
  });

  readonly paginationEnd = computed(() => {
    const p = this.pagination();
    return Math.min((p.pageIndex + 1) * p.pageSize, this.totalRowCount());
  });

  // ── TanStack Table ─────────────────────────────────────────────────────

  readonly table = injectTable(() => ({
    features,
    rowModels: {
      sortedRowModel: createSortedRowModel(sortFns),
      paginatedRowModel: createPaginatedRowModel(),
      filteredRowModel: createFilteredRowModel(filterFns),
    },
    data: this.data(),
    columns: this.columns(),
    state: {
      sorting: this.sorting(),
      columnFilters: this.columnFilters(),
      globalFilter: this.globalFilter(),
      pagination: this.pagination(),
      rowSelection: this.rowSelection(),
      columnVisibility: this.columnVisibility(),
    },
    enableGlobalFilter: true,
    globalFilterFn: 'includesString',
    enableRowSelection: true,
    onSortingChange: (u: Updater<SortingState>) => (isFunction(u) ? this.sorting.update(u) : this.sorting.set(u)),
    onPaginationChange: (u: Updater<PaginationState>) =>
      isFunction(u) ? this.pagination.update(u) : this.pagination.set(u),
    onColumnFiltersChange: (u: Updater<ColumnFiltersState>) =>
      isFunction(u) ? this.columnFilters.update(u) : this.columnFilters.set(u),
    onGlobalFilterChange: (u: Updater<string>) =>
      isFunction(u) ? this.globalFilter.update(u) : this.globalFilter.set(u),
    onRowSelectionChange: (u: Updater<RowSelectionState>) =>
      isFunction(u) ? this.rowSelection.update(u) : this.rowSelection.set(u),
    onColumnVisibilityChange: (u: Updater<ColumnVisibilityState>) =>
      isFunction(u) ? this.columnVisibility.update(u) : this.columnVisibility.set(u),
  }));

  constructor() {
    // Set initial page size from input when it arrives
    effect(() => {
      const inp = this.input();
      if (inp?.features?.pageSize) {
        this.pagination.set({ pageIndex: 0, pageSize: inp.features.pageSize });
      }
    });

    // When the table input changes, collect all external http(s) image URLs and
    // resolve them via fetch_image (server-side proxy bypasses iframe CSP).
    effect(() => {
      const inp = this.input();
      if (!inp) return;
      const imageKeys = inp.columns.filter((c) => (c.type ?? 'text') === 'image').map((c) => c.key);
      if (imageKeys.length === 0) return;

      const urls = new Set<string>();
      for (const row of this.data()) {
        for (const key of imageKeys) {
          const v = row[key];
          if (typeof v !== 'string') continue;
          const lower = v.trim().toLowerCase();
          if (lower.startsWith('http://') || lower.startsWith('https://')) {
            urls.add(v);
          }
        }
      }

      const cache = this.fetchedImages();
      const missing = [...urls].filter((u) => !cache[u] && !this.pendingImageUrls.has(u));
      if (missing.length === 0) return;
      missing.forEach((u) => this.pendingImageUrls.add(u));
      // fetch_image caps at 50 URLs per call — split into chunks so tables with 51+ unique images work.
      for (let index = 0; index < missing.length; index += IMAGE_FETCH_BATCH_SIZE) {
        void this.fetchImagesBatch(missing.slice(index, index + IMAGE_FETCH_BATCH_SIZE));
      }
    });
  }

  private async fetchImagesBatch(urls: string[]): Promise<void> {
    try {
      const result = await this.bridge.callTool('fetch_image', { urls });
      const text = (result as { content?: { text?: string }[] })?.content?.[0]?.text;
      if (!text) {
        urls.forEach((u) => this.pendingImageUrls.delete(u));
        return;
      }
      let parsed: { url: string; data: string | null; mime?: string }[];
      try {
        parsed = JSON.parse(text);
      } catch {
        urls.forEach((u) => this.pendingImageUrls.delete(u));
        return;
      }
      const updates: Record<string, string> = {};
      for (const entry of parsed) {
        this.pendingImageUrls.delete(entry.url);
        if (entry.data) {
          const mime = entry.mime ?? 'image/jpeg';
          updates[entry.url] = `data:${mime};base64,${entry.data}`;
        }
      }
      if (Object.keys(updates).length > 0) {
        this.fetchedImages.update((prev) => ({ ...prev, ...updates }));
      }
    } catch (err) {
      console.error('[TableComponent] fetch_image failed:', err);
      urls.forEach((u) => this.pendingImageUrls.delete(u));
    }
  }

  ngOnInit(): void {
    this.bridge.connect().catch((err) => {
      console.error('[TableComponent] Bridge connection failed:', err);
    });
  }

  // ── Template helpers ───────────────────────────────────────────────────

  rowClasses(even: boolean, selected: boolean): string {
    let cls = 'hover:bg-primary-surface dark:hover:bg-dark-surface-raised transition-colors';
    if (this.input()?.striped !== false && even) {
      cls += ' stripe-even';
    }
    if (selected) {
      cls += ' bg-petrol-lighter/10';
    }
    return cls;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAlign(colDef: any): string {
    return colDef.meta?.align ?? 'left';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getHeaderClasses(colDef: any): string {
    const type = colDef.meta?.type;
    if (type === 'icon' || type === 'boolean') {
      return 'px-1 py-2 text-sm text-center';
    }
    const align = ALIGN_CLASSES[colDef.meta?.align ?? 'left'] ?? 'text-left';
    return `px-3 py-2 text-sm ${align}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCellClasses(colDef: any): string {
    const type = colDef.meta?.type;
    // Icon cells: minimal padding so they sit tight against adjacent columns
    if (type === 'icon' || type === 'boolean') {
      return 'px-1 py-1 text-center';
    }
    const density = this.densityClass();
    const align = ALIGN_CLASSES[colDef.meta?.align ?? 'left'] ?? 'text-left';
    return `${density} ${align}`;
  }

  getCellClassesForCol(col: ColumnConfig): string {
    const density = this.densityClass();
    const align = ALIGN_CLASSES[col.align ?? DEFAULT_ALIGN[col.type ?? 'text'] ?? 'left'] ?? 'text-left';
    return `${density} ${align}`;
  }

  formatCellValue(value: unknown, type: string): string {
    return formatCell(value, type);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getBadgeConfig(colDef: any, value: unknown): { label: string; colorClass: string } | null {
    const map = colDef.meta?.badgeMap;
    if (!map || value == null) return null;
    const entry = map[String(value)];
    if (!entry) return null;
    return {
      label: entry.label ?? String(value),
      colorClass: BADGE_COLORS[entry.color] ?? BADGE_COLORS['gray'],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getIconConfig(colDef: any, value: unknown): { svg: SafeHtml; colorClass: string; label: string } | null {
    const type = colDef.meta?.type;
    const iconMap = colDef.meta?.iconMap;

    let iconName: string;
    let colorClass = '';
    let label = String(value ?? '');

    if (type === 'boolean') {
      // Boolean type: built-in mapping
      const isTrue = !!value;
      iconName = isTrue ? 'check-circle' : 'x-circle';
      colorClass = isTrue ? ICON_COLORS['green'] : ICON_COLORS['red'];
      label = isTrue ? 'Ja' : 'Nee';
    } else if (iconMap && iconMap[String(value)]) {
      // Icon type with iconMap: lookup value → icon + color
      const entry = iconMap[String(value)];
      iconName = entry.icon;
      colorClass = entry.color ? (ICON_COLORS[entry.color] ?? '') : '';
      label = entry.label ?? String(value);
    } else {
      // Icon type without iconMap: value IS the icon name
      iconName = String(value);
    }

    const rawSvg = this.icons[iconName];
    if (!rawSvg) return null;
    return { svg: this.sanitizer.bypassSecurityTrustHtml(rawSvg), colorClass, label };
  }

  // ── Helpers for new cell types ─────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSparklineRender(colDef: any, value: unknown): { svg: SafeHtml; colorClass: string; title: string } | null {
    const svg = buildSparklineSvg(value);
    if (!svg) return null;
    const color = colDef.meta?.sparklineConfig?.color;
    const colorClass = color ? (ICON_COLORS[color] ?? 'text-primary') : 'text-primary';
    const nums = (value as number[]).filter((v) => typeof v === 'number' && !isNaN(v));
    const first = nums[0] ?? 0;
    const last = nums[nums.length - 1] ?? 0;
    const delta = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    const title =
      `${nums.length} punten — min ${NL_NUMBER.format(Math.min(...nums))}, ` +
      `max ${NL_NUMBER.format(Math.max(...nums))}, laatst ${NL_NUMBER.format(last)} ` +
      `(${delta >= 0 ? '+' : ''}${NL_NUMBER.format(delta)}%)`;
    return { svg: this.sanitizer.bypassSecurityTrustHtml(svg), colorClass, title };
  }

  getProgressRender(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colDef: any,
    value: unknown
  ): { percent: number; label: string; barClass: string; trackClass: string } | null {
    if (typeof value !== 'number' || isNaN(value)) return null;
    const clamped = Math.min(1, Math.max(0, value));
    const barClass = progressColorClass(clamped, colDef.meta?.progressConfig);
    return {
      percent: Math.round(clamped * 1000) / 10,
      label: NL_PERCENT.format(clamped),
      barClass,
      trackClass: PROGRESS_TRACK_CLASS,
    };
  }

  getTrendRender(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colDef: any,
    value: unknown
  ): { valueLabel: string; deltaLabel: string; arrowSvg: SafeHtml; colorClass: string; title: string } | null {
    if (!value || typeof value !== 'object' || !('value' in value) || !('delta' in value)) return null;
    const tv = value as TrendValue;
    if (typeof tv.value !== 'number' || typeof tv.delta !== 'number') return null;

    const cfg = colDef.meta?.trendConfig;
    const valueType = cfg?.valueType ?? 'number';
    const direction = trendDirection(tv);

    const iconName = direction === 'up' ? 'arrow-trending-up' : direction === 'down' ? 'arrow-trending-down' : 'minus';
    const rawSvg = this.icons[iconName] ?? '';

    // Default semantics: up = red (bad), down = green (good). invertColors flips it.
    const invert = cfg?.invertColors === true;
    let colorName: string;
    if (direction === 'flat') {
      colorName = 'gray';
    } else if (direction === 'up') {
      colorName = invert ? 'green' : 'red';
    } else {
      colorName = invert ? 'red' : 'green';
    }
    const colorClass = ICON_COLORS[colorName] ?? 'text-grey-blue';

    const valueLabel = formatCell(tv.value, valueType);
    const sign = tv.delta > 0 ? '+' : '';
    const deltaLabel = `${sign}${NL_PERCENT.format(tv.delta)}`;
    const title = `${valueLabel} (${deltaLabel} t.o.v. vorige periode)`;

    return {
      valueLabel,
      deltaLabel,
      arrowSvg: this.sanitizer.bypassSecurityTrustHtml(rawSvg),
      colorClass,
      title,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMultiBadgeRender(colDef: any, value: unknown): { label: string; colorClass: string }[] {
    if (!Array.isArray(value)) return [];
    const map = colDef.meta?.badgeMap as Record<string, { label?: string; color: string }> | undefined;
    return value.map((item) => {
      const key = String(item ?? '');
      const entry = map?.[key];
      return {
        label: entry?.label ?? key,
        colorClass: entry ? (BADGE_COLORS[entry.color] ?? BADGE_COLORS['gray']) : BADGE_COLORS['gray'],
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLinkRender(colDef: any, value: unknown): { label: string; href: string | null; target: string } {
    const label = extractLinkLabel(value) || String(value ?? '');
    const href = extractLinkHref(value);
    const target = colDef.meta?.linkConfig?.target ?? '_blank';
    return { label, href, target };
  }

  /**
   * Auto-detect email / URL / ISO date in a text-column value so Claude can
   * send plain strings without wrapping them in {label, href} objects or
   * setting type: 'date'. Returns null when the value is not auto-formattable;
   * the template falls back to plain text in that case.
   *
   * Thin wrapper around the shared `detectAutoTextShape` so the Angular
   * template can bind to a method (signals cleaner than importing a free
   * function in every `@if` guard). Same behavior as `detectAutoTextShape`.
   */
  getAutoTextRender(value: unknown): AutoTextShape | null {
    return detectAutoTextShape(value);
  }

  onLinkClick(event: MouseEvent, href: string): void {
    event.preventDefault();
    void this.bridge.openLink(href);
  }

  getRatingRender(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colDef: any,
    value: unknown
  ): {
    glyphs: { state: 'full' | 'half' | 'empty'; shape: 'stars' | 'dots' }[];
    colorClass: string;
    title: string;
  } | null {
    const num = typeof value === 'number' && !isNaN(value) ? value : typeof value === 'string' ? Number(value) : NaN;
    if (isNaN(num)) return null;

    const cfg = colDef.meta?.ratingConfig;
    const max = Math.max(1, Math.floor(cfg?.max ?? 5));
    const shape: 'stars' | 'dots' = cfg?.shape === 'dots' ? 'dots' : 'stars';
    const colorName = cfg?.color ?? 'yellow';
    const colorClass = ICON_COLORS[colorName] ?? 'text-warning';

    // Snap to the nearest 0.5 so 3.4 → 3.5 and 3.24 → 3.0 (standard half-rating rounding).
    const snapped = Math.max(0, Math.min(max, Math.round(num * 2) / 2));

    const glyphs: { state: 'full' | 'half' | 'empty'; shape: 'stars' | 'dots' }[] = [];
    for (let i = 1; i <= max; i++) {
      if (snapped >= i) glyphs.push({ state: 'full', shape });
      else if (snapped >= i - 0.5) glyphs.push({ state: 'half', shape });
      else glyphs.push({ state: 'empty', shape });
    }

    // Show the original value (not the snapped one) so "3.4/5" still reads as 3.4 for humans.
    const displayed = Number.isInteger(num) ? num.toString() : num.toFixed(1);
    return {
      glyphs,
      colorClass,
      title: `${displayed}/${max}`,
    };
  }

  getImageRender(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colDef: any,
    value: unknown
  ): { src: string | null; alt: string; width: number; height: number; rounded: boolean; loading: boolean } | null {
    if (!isSafeImageUrl(value)) return null;
    const cfg = colDef.meta?.imageConfig;
    const width = typeof cfg?.width === 'number' && cfg.width > 0 ? cfg.width : 32;
    const height = typeof cfg?.height === 'number' && cfg.height > 0 ? cfg.height : 32;
    const rounded = cfg?.shape === 'circle';
    const alt = cfg?.alt ?? colDef.meta?.header ?? '';

    if (value.toLowerCase().startsWith('data:image/')) {
      return { src: value, alt, width, height, rounded, loading: false };
    }

    // http(s) — check cache; if miss, return null src + loading=true (placeholder).
    const cached = this.fetchedImages()[value];
    if (cached) {
      return { src: cached, alt, width, height, rounded, loading: false };
    }
    return { src: null, alt, width, height, rounded, loading: true };
  }

  computeFooter(col: ColumnConfig): string {
    const rows = this.table.getFilteredRowModel().rows;

    // count works on all rows regardless of type
    if (col.footer === 'count') {
      return `${rows.length} rijen`;
    }

    const values = rows
      .map((r) => r.getValue<number>(col.key))
      .filter((v): v is number => v != null && typeof v === 'number');
    const result = formatFooter(col.footer!, values);
    return formatCell(result, col.type ?? 'number');
  }

  toggleColumnVisibility(key: string): void {
    this.columnVisibility.update((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  }

  onGlobalFilter(event: Event): void {
    this.globalFilter.set((event.target as HTMLInputElement).value);
  }

  onPageSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.pagination.set({ pageIndex: 0, pageSize: size });
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFilterValue(column: any): string {
    return (column.getFilterValue() as string) ?? '';
  }

  exportCsv(): void {
    const inp = this.input();
    if (!inp) return;

    const sep = ';';
    const visibleCols = inp.columns.filter((col) => this.columnVisibility()[col.key] !== false);
    const rows = this.table.getFilteredRowModel().rows;

    const header = visibleCols.map((col) => csvField(col.header, sep)).join(sep);

    const dataRows = rows.map((row) =>
      visibleCols
        .map((col) => {
          const value = row.getValue(col.key);
          const type = col.type ?? 'text';

          if (type === 'badge' && col.badgeMap) {
            const entry = col.badgeMap[String(value)];
            return csvField(entry?.label ?? String(value ?? ''), sep);
          }
          if (type === 'boolean') {
            return value ? 'Ja' : 'Nee';
          }
          if (type === 'icon' && col.iconMap) {
            const entry = col.iconMap[String(value)];
            return csvField(entry?.label ?? String(value ?? ''), sep);
          }
          if (type === 'sparkline') {
            return csvField(Array.isArray(value) ? value.join(',') : '', sep);
          }
          if (type === 'progress') {
            return csvField(typeof value === 'number' ? NL_PERCENT.format(Math.min(1, Math.max(0, value))) : '', sep);
          }
          if (type === 'trend') {
            if (value && typeof value === 'object' && 'value' in value && 'delta' in value) {
              const tv = value as TrendValue;
              const valueType = col.trendConfig?.valueType ?? 'number';
              const sign = tv.delta > 0 ? '+' : '';
              return csvField(`${formatCell(tv.value, valueType)} (${sign}${NL_PERCENT.format(tv.delta)})`, sep);
            }
            return csvField('', sep);
          }
          if (type === 'multi_badge') {
            if (!Array.isArray(value)) return csvField('', sep);
            const labels = value.map((v) => {
              const entry = col.badgeMap?.[String(v)];
              return entry?.label ?? String(v ?? '');
            });
            return csvField(labels.join(' | '), sep);
          }
          if (type === 'link') {
            return csvField(extractLinkLabel(value) || String(value ?? ''), sep);
          }
          if (type === 'rating') {
            const max = Math.max(1, Math.floor(col.ratingConfig?.max ?? 5));
            const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
            if (isNaN(raw)) return csvField(`0/${max}`, sep);
            const snapped = Math.max(0, Math.min(max, Math.round(raw * 2) / 2));
            const label = Number.isInteger(snapped) ? snapped.toString() : snapped.toFixed(1);
            return csvField(`${label}/${max}`, sep);
          }
          if (type === 'image') {
            return csvField(typeof value === 'string' ? value : '', sep);
          }
          return csvField(formatCell(value, type), sep);
        })
        .join(sep)
    );

    const bom = '\uFEFF';
    const csv = bom + [header, ...dataRows].join('\r\n');
    const filename = slugify(inp.title ?? 'tabel') + '.csv';
    this.bridge.downloadFile(filename, csv, 'text/csv;charset=utf-8');
  }
}
