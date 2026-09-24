/**
 * Reference-period weighted degree days: the data a partial-period weather correction needs.
 *
 * `fullYearGasNormalizationFactor` divides an ANNUAL reference (2800 weighted HDD) by a
 * period's degree days, so it is only valid for a full 12-month window. Weather-correcting
 * a quarter needs a reference for THAT quarter — the mean of the same calendar window over
 * previous years — which a model cannot produce without many extra calls. So the server
 * computes it and ships it as data (evals/results/2026-09-23-q16-fetch-vs-apply.json).
 *
 * Upstream cost: Open-Meteo weighs requests by data volume (~1 call per 14 days of data per
 * location). Fetching one span over all ten years costs ~260 weighted calls and exhausts the
 * hourly limit, so only the reference windows themselves are fetched (10 × ~7 weighted calls
 * for a quarter), and the result is cached: past years do not change.
 *
 * - The span is FIXED (see REFERENCE_END_YEARS), so every call's reference is comparable.
 * - Windows that cross a year boundary (a heating season Oct–Mar) are supported.
 * - A 29 February at either end maps to 28 February in non-leap years.
 * - Reference years never start before 1940 (archive start).
 * - A fetch failure returns `null` with a reason instead of failing the tool call.
 */

export interface DayWeightedHdd {
  date: string;
  weightedHdd: number;
}

export type ArchiveFetcher = (startDate: string, endDate: string) => Promise<DayWeightedHdd[]>;

/** Reference periods are immutable (they cover past years only), so a process-lifetime cache is safe. */
const cache = new Map<string, ReferencePeriod>();
export function clearReferenceCache(): void {
  cache.clear();
}

export interface ReferencePeriod {
  referencePeriodWeightedHDD: number;
  window: string;
  fromYear: number;
  toYear: number;
  yearsUsed: number;
  source: string;
}

const ARCHIVE_START_YEAR = 1940;

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

/** `yyyy` + `-MM-dd`, mapping -02-29 to -02-28 in a non-leap year. */
function dateIn(year: number, md: string): string {
  const fixed = md === '-02-29' && !isLeap(year) ? '-02-28' : md;
  return `${year}${fixed}`;
}

/**
 * The reference span: every reference window whose END falls in these years (inclusive).
 *
 * FIXED, not relative to the query, like a climatological normal. A relative span ("the 10 years
 * before this window") gives Q1 2023 and Q1 2024 different references, and comparing two periods
 * each normalised to its own reference then reports 6.6% improvement where 3.6% is right
 * (docs/weather-findings.md). Roll the span forward deliberately, never by making it relative to
 * today, which would move every figure silently each January.
 */
export const REFERENCE_END_YEARS = { from: 2014, to: 2023 } as const;

/**
 * Mean weighted HDD of the calendar window [windowFrom, windowTo] over the fixed reference span.
 * `windowTo` may fall in the next calendar year (a window crossing 31 Dec). The query year only
 * decides the window's month-days, never which years are averaged.
 * Returns `{ value: null, reason }` when it cannot be computed.
 */
export async function referencePeriodWeightedHDD(
  windowFrom: string,
  windowTo: string,
  fetchArchive: ArchiveFetcher,
  cacheScope = '',
  span: { from: number; to: number } = REFERENCE_END_YEARS
): Promise<ReferencePeriod | { value: null; reason: string }> {
  const yFrom = Number(windowFrom.slice(0, 4));
  const yTo = Number(windowTo.slice(0, 4));
  const cross = yTo - yFrom;
  if (cross < 0 || cross > 1) return { value: null, reason: 'window longer than one year boundary crossing' };
  const mdFrom = windowFrom.slice(4);
  const mdTo = windowTo.slice(4);
  if (cross === 1 && mdTo >= mdFrom) return { value: null, reason: 'window is a year or longer; use the annual reference' };

  const firstEnd = Math.max(ARCHIVE_START_YEAR + cross, span.from);
  const lastEnd = span.to;
  if (lastEnd < firstEnd) return { value: null, reason: 'reference span lies outside the archive' };

  const windows: Array<{ from: string; to: string }> = [];
  for (let end = firstEnd; end <= lastEnd; end++) windows.push({ from: dateIn(end - cross, mdFrom), to: dateIn(end, mdTo) });
  const firstYear = firstEnd - cross;
  const lastYear = lastEnd - cross;

  const key = `${cacheScope}|${mdFrom}|${mdTo}|${cross}|${firstEnd}-${lastEnd}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Sequential on purpose: ten parallel requests trip Open-Meteo's concurrency limit
  // ("Too many concurrent requests"). The cache makes the latency one-off.
  const perWindow: DayWeightedHdd[][] = [];
  try {
    for (const { from, to } of windows) perWindow.push(await fetchArchive(from, to));
  } catch (error) {
    return { value: null, reason: `reference archive fetch failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  // A year with no rows at all means the archive did not cover it; do not average in a zero.
  const covered = perWindow
    .map((rows, i) => rows.filter((r) => r.date >= windows[i].from && r.date <= windows[i].to))
    .filter((rows) => rows.length > 0)
    .map((rows) => rows.reduce((s, r) => s + r.weightedHdd, 0));
  if (covered.length === 0) return { value: null, reason: 'the archive returned no rows for the reference years' };

  const mean = Math.round((covered.reduce((s, x) => s + x, 0) / covered.length) * 10) / 10;
  const result: ReferencePeriod = {
    referencePeriodWeightedHDD: mean,
    window: `${mdFrom.slice(1)} to ${mdTo.slice(1)}`,
    fromYear: firstYear,
    toYear: lastEnd,
    yearsUsed: covered.length,
    source: 'Open-Meteo historical archive, same coordinates, same weighting as totalWeightedHDD',
  };
  cache.set(key, result);
  return result;
}
