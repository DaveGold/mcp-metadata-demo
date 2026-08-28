/**
 * Tests for the render_table pagination decision.
 *
 * The point of these is the DECISION — whether we paginate at all, and at which page size — not the
 * slicing itself; `pagination-rowmodel.test.ts` covers what TanStack does with that decision. Both
 * exist because the bug was a disagreement between two places that each thought they owned it.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  resolveInitialPageSize,
  resolvePagination,
  type PaginationStateShape,
} from './pagination-state';

/** The state the component's signal holds before any resolution. */
const AT_DEFAULT: PaginationStateShape = { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE };

describe('resolvePagination', () => {
  it('turns pagination off when features.pagination is false — the reported bug', () => {
    const resolved = resolvePagination({ pagination: false }, AT_DEFAULT);

    expect(resolved.paginate).toBe(false);
  });

  it('keeps pagination off when a pageSize is passed alongside pagination: false', () => {
    const resolved = resolvePagination({ pagination: false, pageSize: 10 }, { pageIndex: 0, pageSize: 10 });

    expect(resolved.paginate).toBe(false);
  });

  it('pins pageIndex to 0 while pagination is off, so flipping it back on cannot land out of range', () => {
    const resolved = resolvePagination({ pagination: false }, { pageIndex: 4, pageSize: 10 });

    expect(resolved.state.pageIndex).toBe(0);
  });

  it('paginates at the configured size when pagination is true', () => {
    const resolved = resolvePagination({ pagination: true, pageSize: 25 }, { pageIndex: 1, pageSize: 25 });

    expect(resolved).toEqual({ paginate: true, state: { pageIndex: 1, pageSize: 25 } });
  });

  it('paginates when features are absent entirely — pagination is the default', () => {
    expect(resolvePagination(undefined, AT_DEFAULT).paginate).toBe(true);
    expect(resolvePagination({}, AT_DEFAULT).paginate).toBe(true);
  });

  // the second defect: these all bypassed TanStack's own Math.max(1, …) clamp, because the
  // component wrote features.pageSize straight into the signal. The tool schema is a bare
  // z.number(), so every one of them passes validation at the door.
  it.each([
    ['zero — an empty body and a pager with Infinity pages', 0],
    ['negative — the last N rows silently dropped, no pager', -5],
    ['NaN', Number.NaN],
    // Infinity is a "don't slice" signal to table-core 9.1.2, but manualPagination is how this app
    // expresses that (see Technical Notes), so here it is just an unusable size.
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('falls back to the default page size for %s', (_case, pageSize) => {
    const resolved = resolvePagination({ pagination: true }, { pageIndex: 0, pageSize });

    expect(resolved.state.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it.each([
    [10.5, 10],
    [25.9, 25],
  ])('floors a fractional page size (%s) rather than rejecting it', (pageSize, expected) => {
    expect(resolvePagination({}, { pageIndex: 0, pageSize }).state.pageSize).toBe(expected);
  });

  it('sanitises the page size even while pagination is off, so the state stays valid', () => {
    const resolved = resolvePagination({ pagination: false }, { pageIndex: 0, pageSize: 0 });

    expect(resolved.state.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('resolveInitialPageSize', () => {
  it('returns null when the input says nothing about page size, leaving the current state alone', () => {
    expect(resolveInitialPageSize(undefined)).toBeNull();
    expect(resolveInitialPageSize({})).toBeNull();
    expect(resolveInitialPageSize({ pagination: false })).toBeNull();
  });

  it('passes a usable page size through', () => {
    expect(resolveInitialPageSize({ pageSize: 25 })).toBe(25);
  });

  // The old guard was `if (inp?.features?.pageSize)`, so 0 was falsy and slipped through untouched —
  // which is how a table could end up with pageSize 0 and an infinite pager.
  it.each([0, -5, Number.NaN])('falls back to the default for an unusable page size (%s)', (pageSize) => {
    expect(resolveInitialPageSize({ pageSize })).toBe(DEFAULT_PAGE_SIZE);
  });
});
