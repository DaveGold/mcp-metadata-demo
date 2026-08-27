/**
 * The render_table app's TanStack feature registration — the one object that says which features,
 * row models and fn registries this table has.
 *
 * ## Why this is not in the component (design review)
 *
 * `pagination-rowmodel.test.ts` is the regression net for the row-model bug AND the canary for the
 * v9 stable migration, but it used to build its own `tableFeatures({ … })` call. A canary that
 * restates the wiring cannot see the wiring change: it registered four of the six features the design names,
 * so a migration that broke row selection or column visibility left it green. Both now import THIS
 * object, so the table under test is registered exactly like the table that ships.
 *
 * Imports come from `@tanstack/table-core` rather than `@tanstack/angular-table` on purpose.
 * `angular-table` re-exports every symbol here, but its module also defines Angular directives, so
 * importing it as a value drags the Angular JIT compiler into any node-environment test that touches
 * this file — the same trap `footer-aggregation.ts` documents. `table-core` is declared as a direct
 * devDependency, pinned to the exact version `angular-table` resolves to, so the two cannot drift.
 *
 * `coreReactivityFeature` is deliberately absent: `injectTable` merges its own Angular binding in
 * (`angularReactivity(injector)`), and the test supplies the vanilla `storeReactivityBindings()`.
 * That slot is the one legitimate difference between the two tables.
 */

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowAggregationFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  aggregationFn_count,
  aggregationFn_max,
  aggregationFn_min,
  aggregationFn_sum,
} from '@tanstack/table-core';
import { aggregationFn_numericMean } from './footer-aggregation';

// v9 stable registers each feature together with its row model and fn registry as slots in this one
// object; the old top-level `rowModels` option on injectTable is gone. The bulk `sortFns` / `filterFns`
// registries still work — they bundle every built-in, which is what the column types here need.
export const TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns,
  // Without this, `enableGlobalFilter` + `globalFilterFn` are inert: the filtered row model ignores
  // `state.globalFilter` and the search box filters nothing. Global filtering reuses the
  // column-filtering pipeline, so it needs no row model of its own.
  globalFilteringFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnVisibilityFeature,
  // Footer totals. v9 stable computes aggregations independently of grouping, which is what the
  // hand-rolled footer math used to work around. Only the five the tool's `footer` spec exposes are
  // registered — the registry object would pull in six more. `mean` is ours rather than upstream's:
  // see `footer-aggregation.ts` for the coercion divergence that costs.
  rowAggregationFeature,
  aggregationFns: {
    sum: aggregationFn_sum,
    mean: aggregationFn_numericMean,
    min: aggregationFn_min,
    max: aggregationFn_max,
    count: aggregationFn_count,
  },
});

/**
 * The tool's five footer specs, mapped onto the registry above. Only `avg` is renamed; `count` counts
 * rows regardless of the column's values, exactly as the hand-rolled version did.
 *
 * Lives here rather than in the component for the same reason `TABLE_FEATURES` does: the footer test
 * asserts against the real mapping instead of a copy that can drift away from it.
 *
 * The value type is derived from the registry above rather than written as `string`. It used to be
 * `Record<string, string>` in the component, where it flowed into a `columnDef: any` and a typo in a
 * value (`'mean'` → `'meen'`) compiled and silently rendered a `0` footer — the same silent-wrong-number
 * failure this rework exists to kill (design review). Now renaming a registry key breaks the map.
 */
export const FOOTER_AGGREGATION_FNS = {
  sum: 'sum',
  avg: 'mean',
  min: 'min',
  max: 'max',
  count: 'count',
} as const satisfies Record<string, keyof (typeof TABLE_FEATURES)['aggregationFns']>;

/** A `col.footer` value the tool's schema actually allows (`z.enum(['sum','avg','count','min','max'])`). */
export type FooterSpec = keyof typeof FOOTER_AGGREGATION_FNS;

/** The registry key a footer spec resolves to — `avg` is the one that is not its own name (`mean`). */
export type AggregationFnKey = (typeof FOOTER_AGGREGATION_FNS)[FooterSpec];

/**
 * Narrow an arbitrary `col.footer` string onto a registered aggregation, or `undefined`.
 *
 * `ColumnConfig.footer` is typed `string` on both sides of the boundary, so the guard has to live
 * somewhere; here it is explicit and returns `undefined` for anything unregistered, instead of
 * indexing straight through and letting an unknown spec silently produce a `0` footer.
 */
export function resolveFooterAggregationFn(footer: string | undefined): AggregationFnKey | undefined {
  if (footer === undefined) return undefined;
  return footer in FOOTER_AGGREGATION_FNS ? FOOTER_AGGREGATION_FNS[footer as FooterSpec] : undefined;
}
