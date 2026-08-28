/**
 * Footer aggregation for the render_table MCP App.
 *
 * Angular-free and side-effect-free, for the same reason `pagination-state.ts` is: the component
 * owns rendering, this module owns the arithmetic behind a footer total — and arithmetic is
 * testable without a TestBed, which this repo has none of.
 *
 * ## Why the mean is ours and not upstream's (design review)
 *
 * This rework replaced the hand-rolled `computeFooter` / `formatFooter` with v9 stable's
 * `rowAggregationFeature`. `sum` / `min` / `max` / `count` map onto upstream fns with exact parity,
 * but `aggregationFn_mean` does not: it coerces every non-nullish cell with unary `+`, where the
 * hand-rolled version filtered on `typeof v === 'number'` first. Two consequences, both reachable —
 * `data` cells are `z.unknown()` at the tool boundary, so a `""` or a numeric string is valid input:
 *
 * - an empty string in a number/currency column counts as a zero and drags the average down
 *   (`[10, 20, '']` averaged 15 before, 10 with upstream's mean);
 * - numeric strings count toward `avg` while `aggregationFn_sum` still treats them as 0, so two
 *   footers on the same column disagree about which rows exist (`[10, '20']` → sum 10, avg 15).
 *
 * So `avg` keeps the per-cell type guard. `NaN` is a number and still propagates, exactly as before.
 */

// Type-only: `constructAggregationFn` is a pure typing helper, and importing it as a VALUE drags
// `@tanstack/angular-table`'s directives — and so the Angular JIT compiler — into this module,
// which would put it out of reach of the node-environment tests this file exists to be reachable by.
import type { AggregationFnDef } from '@tanstack/angular-table';

/** `avg` — the mean of the cells that really are numbers, matching the pre-rework footer. */
export const aggregationFn_numericMean: AggregationFnDef = {
  aggregate: ({ rows, getValue }) => {
    let count = 0;
    let sum = 0;
    for (const row of rows) {
      const value = getValue(row);
      if (typeof value !== 'number') continue;
      count++;
      sum += value;
    }
    return count ? sum / count : undefined;
  },
};
