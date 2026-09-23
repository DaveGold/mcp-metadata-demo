import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearReferenceCache, referencePeriodWeightedHDD, type DayWeightedHdd } from './reference-period.js';

/** Every day in [s, e] carries weightedHdd 1, so a window's total is its length in days. */
function unitArchive() {
  return vi.fn(async (s: string, e: string): Promise<DayWeightedHdd[]> => {
    const out: DayWeightedHdd[] = [];
    for (let t = Date.parse(`${s}T00:00:00Z`); t <= Date.parse(`${e}T00:00:00Z`); t += 86_400_000)
      out.push({ date: new Date(t).toISOString().slice(0, 10), weightedHdd: 1 });
    return out;
  });
}

describe('referencePeriodWeightedHDD', () => {
  beforeEach(() => clearReferenceCache());

  it('fetches ONLY the reference windows, never the span between them, and averages them', async () => {
    const archive = unitArchive();
    const r = await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', archive);
    // Open-Meteo weighs by data volume: ten 90-day windows, not one 10-year span (Q19, 2026-09-24).
    expect(archive).toHaveBeenCalledTimes(10);
    expect(archive).toHaveBeenCalledWith('2014-01-01', '2014-03-31');
    expect(archive).toHaveBeenCalledWith('2023-01-01', '2023-03-31');
    for (const [s, e] of archive.mock.calls) expect(Date.parse(e) - Date.parse(s)).toBeLessThan(100 * 86_400_000);
    // 2014–2023: Q1 is 90 days, 91 in 2016 and 2020.
    expect(r).toMatchObject({ referencePeriodWeightedHDD: 90.2, fromYear: 2014, toYear: 2023, yearsUsed: 10 });
  });

  it('supports a window crossing the year boundary (a heating season)', async () => {
    const r = await referencePeriodWeightedHDD('2023-10-01', '2024-03-31', unitArchive());
    expect(r).toMatchObject({ fromYear: 2013, toYear: 2023, yearsUsed: 10 });
    expect((r as { referencePeriodWeightedHDD: number }).referencePeriodWeightedHDD).toBeCloseTo(182.2, 1);
  });

  it('maps a 29 February end to 28 February in non-leap years', async () => {
    const archive = unitArchive();
    const r = await referencePeriodWeightedHDD('2024-02-01', '2024-02-29', archive);
    expect(archive).toHaveBeenCalledWith('2015-02-01', '2015-02-28');
    expect(archive).toHaveBeenCalledWith('2016-02-01', '2016-02-29');
    // 2014–2023: 28 days, 29 in 2016 and 2020.
    expect(r).toMatchObject({ referencePeriodWeightedHDD: 28.2 });
  });

  it('never reaches before the 1940 archive start', async () => {
    const r = await referencePeriodWeightedHDD('1945-01-01', '1945-03-31', unitArchive());
    expect(r).toMatchObject({ fromYear: 1940, yearsUsed: 5 });
    expect(await referencePeriodWeightedHDD('1940-01-01', '1940-03-31', unitArchive())).toMatchObject({ value: null });
  });

  it('a fetch failure degrades to null with a reason, it does not throw', async () => {
    const r = await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', async () => {
      throw new Error('503');
    });
    expect(r).toEqual({ value: null, reason: expect.stringContaining('503') });
  });

  it('caches per scope: a repeat request for the same location and window fetches nothing', async () => {
    const archive = unitArchive();
    await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', archive, 10, '52.09,5.11');
    await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', archive, 10, '52.09,5.11');
    expect(archive).toHaveBeenCalledTimes(10);
    await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', archive, 10, '53.22,6.57');
    expect(archive).toHaveBeenCalledTimes(20);
  });

  it('a window of a year or longer is not a reference period', async () => {
    expect(await referencePeriodWeightedHDD('2023-06-01', '2024-06-30', unitArchive())).toMatchObject({ value: null });
  });
});
