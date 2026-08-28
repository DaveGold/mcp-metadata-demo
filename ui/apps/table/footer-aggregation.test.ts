/**
 * Footer parity tests for render_table (design review).
 *
 * The rework requires the `rowAggregationFeature` footer to match the pre-change values. That was verified
 * by walking the four footer-bearing demos — which all carry clean numeric literals, so the walk
 * could not see the one aggregation that actually changed: upstream `aggregationFn_mean` coerces
 * non-number cells with unary `+`, where the hand-rolled `computeFooter` filtered them out first.
 *
 * These tests hold every one of the five specs against the deleted helper's own arithmetic, on the
 * loose input the tool boundary actually admits (`data` cells are `z.unknown()`), so a future swap
 * back to an upstream fn fails here instead of on someone's screen.
 */

import { describe, expect, it } from 'vitest';
import { aggregationFn_mean, constructTable, tableFeatures } from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { aggregationFn_numericMean } from './footer-aggregation';
import { resolveFooterAggregationFn, TABLE_FEATURES, type FooterSpec } from './table-features';

/**
 * The deleted `formatFooter` + `computeFooter`, verbatim, as the oracle. Parity is defined against
 * this — not against whatever upstream happens to do.
 */
function legacyFooter(spec: FooterSpec, raw: unknown[]): number {
  const values = raw.filter((v): v is number => v != null && typeof v === 'number');
  switch (spec) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count':
      return raw.length;
    case 'min':
      return values.length ? Math.min(...values) : 0;
    case 'max':
      return values.length ? Math.max(...values) : 0;
    default:
      return 0;
  }
}

// IS the component's registration, with the vanilla reactivity binding standing in for the Angular
// one — so dropping rowAggregationFeature or swapping a registered fn breaks this file.
const features = tableFeatures({
  ...TABLE_FEATURES,
  coreReactivityFeature: storeReactivityBindings(),
});

/** The component's `footerValues` arithmetic: aggregate the filtered rows, guard the result. */
function tableFooter(spec: FooterSpec, cells: unknown[], columnFilter?: string): number {
  const table = constructTable({
    features,
    data: cells.map((bedrag, i) => ({ id: `r${i}`, bedrag })),
    columns: [
      { accessorKey: 'id', id: 'id' },
      { accessorKey: 'bedrag', id: 'bedrag', aggregationFn: resolveFooterAggregationFn(spec) },
    ],
    state: { columnFilters: columnFilter ? [{ id: 'id', value: columnFilter }] : [] },
  });

  const rows = table.getFilteredRowModel().rows;
  if (spec === 'count') return rows.length;

  const result = table.getColumn('bedrag')?.getAggregationValue({ rows });
  return typeof result === 'number' ? result : 0;
}

const SPECS = ['sum', 'avg', 'count', 'min', 'max'] as const satisfies readonly FooterSpec[];

describe('footer aggregation parity with the pre-rework helper', () => {
  const CASES: Array<[string, unknown[]]> = [
    ['clean numbers — what the demos cover', [100, 200, 300]],
    ['negatives and zero', [-50, 0, 125]],
    ['nulls interleaved — a missing AFAS value', [100, null, 300]],
    // The regression the demo walk could not see: upstream's mean coerces these, ours does not.
    ['an empty string — an agent emitting "" for a missing number', [10, 20, '']],
    ['a numeric string alongside a number', [10, '20']],
    ['numeric strings only', ['100', '200', '300']],
    ['a boolean', [10, true]],
    ['no usable value at all', [null, 'n.v.t.']],
    ['an empty table', []],
  ];

  for (const [name, cells] of CASES) {
    for (const spec of SPECS) {
      it(`${spec}: ${name}`, () => {
        expect(tableFooter(spec, cells)).toBe(legacyFooter(spec, cells));
      });
    }
  }
});

describe('footer scope', () => {
  it('totals the FILTERED rows, not every row (unchanged by the swap)', () => {
    // id filter "r0" keeps only the first row, so the total must follow the filter.
    expect(tableFooter('sum', [100, 200, 300], 'r0')).toBe(100);
    expect(tableFooter('count', [100, 200, 300], 'r0')).toBe(1);
  });

  it('reads 0 rather than "undefined" when a filter narrows to nothing', () => {
    for (const spec of SPECS) {
      expect(tableFooter(spec, [100, 200, 300], 'geen-enkele-match')).toBe(0);
    }
  });
});

describe('the divergence this pins', () => {
  it('upstream mean coerces non-numbers where ours does not — the reason for the local fn', () => {
    const rows = [10, 20, ''].map((bedrag) => ({ bedrag, subRows: [] }));
    const context = { rows, getValue: (row: { bedrag: unknown }) => row.bedrag };

    // Upstream: '' becomes 0 and counts, dragging the average down.
    expect(aggregationFn_mean.aggregate(context as never)).toBe(10);
    // Ours: '' is not a number, so it is not a row — the pre-change answer.
    expect(aggregationFn_numericMean.aggregate(context as never)).toBe(15);
  });
});
