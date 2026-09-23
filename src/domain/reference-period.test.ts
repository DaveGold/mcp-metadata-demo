import { describe, it, expect, vi } from 'vitest';
import { referencePeriodWeightedHDD, type DayWeightedHdd } from './reference-period.js';

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
  it('averages the same window over the 10 previous years in ONE archive call', async () => {
    const archive = unitArchive();
    const r = await referencePeriodWeightedHDD('2024-01-01', '2024-03-31', archive);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(archive).toHaveBeenCalledWith('2014-01-01', '2023-03-31');
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
    expect(archive).toHaveBeenCalledWith('2014-02-01', '2023-02-28');
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

  it('a window of a year or longer is not a reference period', async () => {
    expect(await referencePeriodWeightedHDD('2023-06-01', '2024-06-30', unitArchive())).toMatchObject({ value: null });
  });
});
