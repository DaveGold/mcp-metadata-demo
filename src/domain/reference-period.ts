/**
 * Reference-period weighted degree days: the data a partial-period weather correction needs.
 *
 * `fullYearGasNormalizationFactor` divides an ANNUAL reference (2800 weighted HDD) by a
 * period's degree days, so it is only valid for a full 12-month window. Weather-correcting
 * a quarter needs a reference for THAT quarter — the mean of the same calendar window over
 * previous years — which no model can produce without many extra calls.
 *
 * Why the server computes it (skill references/evidence.md):
 * - Q16 (2026-09-23): rule only, haiku 2/20; rule + this server-computed figure 15/20; a
 *   finished period factor on top of it added nothing (11/20). Ship the DATA.
 * - Q16b: sonnet/opus 10/10 either way, but with it one call instead of 4–16, −23% tokens,
 *   and every answer converged on one value.
 *
 * Differences from the throwaway Q16 arm (commit 61c73a8):
 * - ONE archive call spanning all reference years, not one call per year.
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
 * Mean weighted HDD of the calendar window [windowFrom, windowTo] over the `years` years
 * before it. `windowTo` may fall in the next calendar year (a window crossing 31 Dec).
 * Returns `{ value: null, reason }` when it cannot be computed.
 */
export async function referencePeriodWeightedHDD(
  windowFrom: string,
  windowTo: string,
  fetchArchive: ArchiveFetcher,
  years = 10
): Promise<ReferencePeriod | { value: null; reason: string }> {
  const yFrom = Number(windowFrom.slice(0, 4));
  const yTo = Number(windowTo.slice(0, 4));
  const span = yTo - yFrom;
  if (span < 0 || span > 1) return { value: null, reason: 'window longer than one year boundary crossing' };
  const mdFrom = windowFrom.slice(4);
  const mdTo = windowTo.slice(4);
  if (span === 1 && mdTo >= mdFrom) return { value: null, reason: 'window is a year or longer; use the annual reference' };

  const firstYear = Math.max(ARCHIVE_START_YEAR, yFrom - years);
  const lastYear = yFrom - 1;
  if (lastYear < firstYear) return { value: null, reason: 'no reference years before this window in the archive' };

  const windows: Array<{ from: string; to: string }> = [];
  for (let y = firstYear; y <= lastYear; y++) windows.push({ from: dateIn(y, mdFrom), to: dateIn(y + span, mdTo) });

  let rows: DayWeightedHdd[];
  try {
    rows = await fetchArchive(windows[0].from, windows[windows.length - 1].to);
  } catch (error) {
    return { value: null, reason: `reference archive fetch failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  const totals = windows.map(({ from, to }) =>
    rows.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.weightedHdd, 0)
  );
  // A year with no rows at all means the archive did not cover it; do not average in a zero.
  const covered = totals.filter((_, i) => rows.some((r) => r.date >= windows[i].from && r.date <= windows[i].to));
  if (covered.length === 0) return { value: null, reason: 'the archive returned no rows for the reference years' };

  const mean = Math.round((covered.reduce((s, x) => s + x, 0) / covered.length) * 10) / 10;
  return {
    referencePeriodWeightedHDD: mean,
    window: `${mdFrom.slice(1)} to ${mdTo.slice(1)}`,
    fromYear: firstYear,
    toYear: lastYear + span,
    yearsUsed: covered.length,
    source: 'Open-Meteo historical archive, same coordinates, same weighting as totalWeightedHDD',
  };
}
