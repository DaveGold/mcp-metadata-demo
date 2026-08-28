/**
 * Pagination decision for the render_table MCP App.
 *
 * Deliberately Angular-free and side-effect-free: the component owns rendering, this module owns
 * *whether we paginate at all, and at which page size*. That split is what makes the decision
 * unit-testable without a TestBed — and the decision is where the earlier version went wrong.
 *
 * ## Why this looks the way it does
 *
 * `paginatedRowModel` was registered unconditionally and the pagination signal defaulted to
 * `pageSize: 10`, while `features.pagination === false` gated only the pager controls. TanStack kept
 * slicing, so a 13-row table on the documented "quick overview, no pagination" path rendered 10 rows
 * with no pager and no error — while the footer and the CSV export read the filtered row model and
 * reported all 13. Two sources of truth for "are we paginating", disagreeing silently.
 *
 * So there is one source now: `resolvePagination()`. The component feeds `paginate` to TanStack's
 * `manualPagination` (which bypasses the page slice while leaving sorting and filtering intact — "all
 * rows" means all *filtered* rows) and gates the pager on the same flag.
 *
 * The second defect lived in the same six lines: the initial-page-size effect wrote
 * `features.pageSize` straight into the signal, bypassing `table.setPageSize()` and its
 * `Math.max(1, …)` clamp. The tool schema is a bare `z.number()`, so `0` (empty body + an infinite
 * pager), negatives (last N rows silently dropped) and floats (overlapping page boundaries) all pass
 * validation. `sanitizePageSize()` is that clamp, applied on every read rather than only at intake.
 */

/** Page size used when none is given, or when the given one is unusable. */
export const DEFAULT_PAGE_SIZE = 10;

/** Only what the decision needs — structurally satisfied by the component's `TableInput['features']`. */
export interface PaginationFeatures {
  pagination?: boolean;
  pageSize?: number;
}

/** Structurally satisfied by TanStack's `PaginationState`. */
export interface PaginationStateShape {
  pageIndex: number;
  pageSize: number;
}

export interface ResolvedPagination {
  /** false → feed TanStack `manualPagination: true`; `getRowModel()` returns every filtered row. */
  readonly paginate: boolean;
  readonly state: PaginationStateShape;
}

/**
 * Clamp a page size to something a table can actually be sliced by: a positive integer.
 * Non-finite, zero, negative and fractional values fall back to `DEFAULT_PAGE_SIZE` / `Math.floor`.
 */
function sanitizePageSize(size: number | undefined): number {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.floor(size);
}

/**
 * The page size to seed the component's pagination signal with when a tool input arrives.
 * `null` means "the input said nothing about page size" — leave the current state alone.
 * A present-but-unusable value is NOT null: it falls back to `DEFAULT_PAGE_SIZE`.
 */
export function resolveInitialPageSize(features?: PaginationFeatures): number | null {
  if (features?.pageSize === undefined) return null;
  return sanitizePageSize(features.pageSize);
}

/**
 * The single source of truth for "are we paginating, and how".
 *
 * `features.pagination === false` wins over everything, `features.pageSize` included: the page
 * size is still sanitised so the state stays valid, but nothing slices and `pageIndex` is pinned to 0
 * — so flipping back to paginating can never land on an out-of-range page.
 */
export function resolvePagination(
  features: PaginationFeatures | undefined,
  current: PaginationStateShape
): ResolvedPagination {
  const pageSize = sanitizePageSize(current.pageSize);

  if (features?.pagination === false) {
    return { paginate: false, state: { pageIndex: 0, pageSize } };
  }

  return { paginate: true, state: { pageIndex: current.pageIndex, pageSize } };
}
