/**
 * Row-model regression tests for render_table.
 *
 * `pagination-state.test.ts` proves the DECISION; this file proves TanStack acts on it. That split
 * matters: the bug was never in the decision — `features.pagination === false` was read correctly by
 * the pager gate — it was that `getRowModel()` kept slicing anyway. A resolver-only test would have
 * passed against the broken build.
 *
 * There is no TestBed or jsdom project in this repo, so the component itself is untestable. Instead
 * this builds a real table-core table from `TABLE_FEATURES` — the very object the component hands to
 * `injectTable` — through the vanilla `storeReactivityBindings()` adapter, with the same controlled
 * state. That makes it a real canary for the TanStack v9 stable migration: a bump that changes how
 * features, row models or fn registries are registered breaks this file, because it is the shipping
 * registration under test, not a restatement of it. (It used to restate it, and so registered four of
 * the six features the design names — design review.)
 *
 * The residual gap, stated plainly so nobody reads more into this file than it delivers: it builds the
 * table itself, so it still cannot see the component's own CALL — deleting `manualPagination` from
 * `table.component.ts` brings the reported symptom straight back with this suite green. Only a
 * component-level test catches that, and this repo has no TestBed to run one. The pager gate reads the
 * same resolver, so the failure would again be silent. That is what the Manual test task is for.
 */

import { describe, expect, it } from 'vitest';
import {
  columnFilteringFeature,
  constructTable,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';
import { DEFAULT_PAGE_SIZE, resolvePagination, type PaginationFeatures } from './pagination-state';
import { TABLE_FEATURES } from './table-features';

/** The reported case: 13 rows on a table the agent asked not to paginate. */
interface Vehicle {
  kenteken: string;
  merk: string;
  km: number;
}

const VEHICLES: Vehicle[] = [
  { kenteken: 'RN-342-X', merk: 'RENAULT TRAFIC', km: 3420 },
  { kenteken: 'PE-118-Z', merk: 'PEUGEOT EXPERT', km: 2890 },
  { kenteken: 'RN-567-Y', merk: 'RENAULT TRAFIC', km: 4150 },
  { kenteken: 'PE-224-A', merk: 'PEUGEOT EXPERT', km: 1280 },
  { kenteken: 'RN-891-B', merk: 'RENAULT KANGOO VAN', km: 2100 },
  { kenteken: 'PE-445-C', merk: 'PEUGEOT BOXER', km: 3890 },
  { kenteken: 'RN-203-D', merk: 'RENAULT TRAFIC', km: 3060 },
  { kenteken: 'PE-776-E', merk: 'PEUGEOT PARTNER', km: 1740 },
  { kenteken: 'RN-118-F', merk: 'RENAULT MASTER', km: 4620 },
  { kenteken: 'PE-509-G', merk: 'PEUGEOT EXPERT', km: 2380 },
  { kenteken: 'RN-654-H', merk: 'RENAULT KANGOO VAN', km: 1590 },
  { kenteken: 'PE-937-J', merk: 'PEUGEOT BOXER', km: 4030 },
  { kenteken: 'RN-482-K', merk: 'RENAULT TRAFIC', km: 2750 },
];

// IS the component's registration, not a copy of it — only the reactivity slot differs, exactly as
// it differs at runtime: `injectTable` merges in `angularReactivity(injector)`, and here the vanilla
// binding stands in for it.
const features = tableFeatures({
  ...TABLE_FEATURES,
  coreReactivityFeature: storeReactivityBindings(),
});

const columns = [
  { accessorKey: 'kenteken', id: 'kenteken' },
  { accessorKey: 'merk', id: 'merk' },
  { accessorKey: 'km', id: 'km' },
];

interface TableCase {
  /** What the agent passed as `features` on the tool call. */
  input?: PaginationFeatures;
  /** What the component's pagination signal holds. */
  current?: { pageIndex: number; pageSize: number };
  sorting?: Array<{ id: string; desc: boolean }>;
  globalFilter?: string;
}

/** Builds the table exactly as the component wires it, through the resolver under test. */
function buildTable({ input, current, sorting, globalFilter }: TableCase = {}) {
  const resolved = resolvePagination(input, current ?? { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });

  return constructTable({
    features,
    columns,
    data: VEHICLES,
    enableGlobalFilter: true,
    globalFilterFn: 'includesString' as const,
    state: {
      pagination: resolved.state,
      sorting: sorting ?? [],
      globalFilter: globalFilter ?? '',
    },
    manualPagination: !resolved.paginate,
  });
}

const kentekens = (table: ReturnType<typeof buildTable>): string[] =>
  table.getRowModel().rows.map((row) => row.getValue<string>('kenteken'));

describe('render_table row models', () => {
  it('renders every row when pagination is off — the reported symptom', () => {
    const rows = kentekens(buildTable({ input: { pagination: false } }));

    expect(rows).toHaveLength(VEHICLES.length);
    expect(rows.at(-1)).toBe('RN-482-K');
  });

  it('still slices to one page when pagination is on', () => {
    const rows = kentekens(buildTable({ input: { pagination: true } }));

    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);
    // The reported symptom, verbatim: ten rows on screen, three the user never sees.
    expect(rows).not.toContain('RN-482-K');
  });

  it('renders every row when pagination is off even with a pageSize passed', () => {
    const rows = kentekens(
      buildTable({ input: { pagination: false, pageSize: 5 }, current: { pageIndex: 0, pageSize: 5 } })
    );

    expect(rows).toHaveLength(VEHICLES.length);
  });

  it('keeps sorting when pagination is off — "all rows" is all SORTED rows', () => {
    const table = buildTable({ input: { pagination: false }, sorting: [{ id: 'km', desc: true }] });

    expect(table.getRowModel().rows).toHaveLength(VEHICLES.length);
    expect(table.getRowModel().rows[0]?.getValue('km')).toBe(4620);
  });

  it('keeps filtering when pagination is off — "all rows" means all FILTERED rows', () => {
    const rows = kentekens(buildTable({ input: { pagination: false }, globalFilter: 'RENAULT TRAFIC' }));

    expect(rows).toEqual(['RN-342-X', 'RN-567-Y', 'RN-203-D', 'RN-482-K']);
  });

  it('returns page 0 when pagination is switched back on from a stale page index', () => {
    // Without the resolver pinning pageIndex to 0 while paginating is off, a table left on page 4
    // comes back to an out-of-range page and renders nothing at all.
    const rows = kentekens(
      buildTable({ input: { pagination: true }, current: { pageIndex: 4, pageSize: DEFAULT_PAGE_SIZE } })
    );

    expect(rows).toHaveLength(0);

    const afterReset = kentekens(
      buildTable({
        input: { pagination: true },
        current: resolvePagination({ pagination: false }, { pageIndex: 4, pageSize: DEFAULT_PAGE_SIZE }).state,
      })
    );

    expect(afterReset).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(afterReset[0]).toBe('RN-342-X');
  });
});

describe('global filtering', () => {
  it('filters the rows down to the matches', () => {
    expect(kentekens(buildTable({ input: { pagination: false }, globalFilter: 'BOXER' }))).toEqual([
      'PE-445-C',
      'PE-937-J',
    ]);
  });

  it('renders nothing for a term that matches nothing', () => {
    expect(kentekens(buildTable({ input: { pagination: false }, globalFilter: 'zzzznomatch' }))).toEqual([]);
  });

  it('is inert unless globalFilteringFeature is registered — the original fault, pinned', () => {
    // Negative control: what the component did before the fix — `enableGlobalFilter` and
    // `globalFilterFn` set, the feature never registered, so the filtered row model ignores the term
    // and every row survives.
    const withoutGlobalFiltering = tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowSortingFeature,
      sortedRowModel: createSortedRowModel(),
      sortFns,
      columnFilteringFeature,
      filteredRowModel: createFilteredRowModel(),
      filterFns,
      rowPaginationFeature,
      paginatedRowModel: createPaginatedRowModel(),
    });

    const table = constructTable({
      features: withoutGlobalFiltering,
      columns,
      data: VEHICLES,
      manualPagination: true,
      // Spread past the type system on purpose. On a table without globalFilteringFeature these
      // three are not valid options at all — tsc rejects them outright, which is the fix's first
      // line of defence and worth stating. The runtime behaviour underneath is what this asserts.
      ...({
        enableGlobalFilter: true,
        globalFilterFn: 'includesString',
        state: { globalFilter: 'zzzznomatch' },
      } as object),
    });

    expect(table.getRowModel().rows).toHaveLength(VEHICLES.length);
  });
});

describe('migration canary — the features the design names, on the shipping registration', () => {
  // These cost nothing now that the test builds from TABLE_FEATURES: row selection and column
  // visibility were registered by the component but absent from this file's own copy, so a migration
  // that dropped either left the suite green and only the viewer walk to catch it.

  it('row selection resolves through the registered feature', () => {
    const table = constructTable({
      features,
      columns,
      data: VEHICLES,
      manualPagination: true,
      enableRowSelection: true,
      state: { pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE }, rowSelection: { '0': true, '2': true } },
    });

    expect(table.getSelectedRowModel().rows.map((row) => row.getValue('kenteken'))).toEqual(['RN-342-X', 'RN-567-Y']);
    expect(table.getIsAllRowsSelected()).toBe(false);
  });

  it('column visibility hides a column without touching the rows', () => {
    const table = constructTable({
      features,
      columns,
      data: VEHICLES,
      manualPagination: true,
      state: { pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE }, columnVisibility: { merk: false } },
    });

    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(['kenteken', 'km']);
    // Hiding a column must not drop rows — the bug this rework is about, in a different guise.
    expect(table.getRowModel().rows).toHaveLength(VEHICLES.length);
  });

  it('a column filter narrows the rows, with pagination off', () => {
    const table = constructTable({
      features,
      columns,
      data: VEHICLES,
      manualPagination: true,
      state: {
        pagination: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
        columnFilters: [{ id: 'merk', value: 'BOXER' }],
      },
    });

    expect(table.getRowModel().rows.map((row) => row.getValue('kenteken'))).toEqual(['PE-445-C', 'PE-937-J']);
  });

  it('sorting runs in both directions', () => {
    const ascending = buildTable({ input: { pagination: false }, sorting: [{ id: 'km', desc: false }] });
    const descending = buildTable({ input: { pagination: false }, sorting: [{ id: 'km', desc: true }] });

    expect(ascending.getRowModel().rows[0]?.getValue('km')).toBe(1280);
    expect(descending.getRowModel().rows[0]?.getValue('km')).toBe(4620);
  });
});
