/**
 * The weather questions check themselves.
 *
 * Same contract as ground-truth.test.ts: every number in a ground_truth must be
 * re-derivable from a frozen capture — here weather-fixtures.json — rather than
 * from someone's recollection. If a re-capture ever moves a value, this fails
 * instead of the candidate set quietly going stale.
 *
 * These questions are NOT part of the ten-question set. See questions-weather.json.
 */

import { describe, it, expect } from 'vitest';
import weatherQuestions from './questions-weather.json' with { type: 'json' };
import fixtures from './weather-fixtures.json' with { type: 'json' };

/** The tool's own reference: a Dutch long-term average year, in weighted HDD. */
const NL_REFERENCE_HDD = 2800;

/** The investigate threshold the description states for solar yield. */
const SOLAR_INVESTIGATE_BELOW = 0.7;

/** The healthy performance-ratio band the description states. */
const PR_MIN = 0.75;
const PR_MAX = 0.85;

const q = (id: string) =>
  (weatherQuestions as unknown as { questions: Array<Record<string, unknown>> }).questions.find(
    (x) => x.id === id
  )!;

describe('weather eval candidates — ground truth follows from the frozen captures', () => {
  it('every capture used for a number is MEASURED, with no forecast days in it', () => {
    for (const key of ['year_2024', 'q1_2024', 'q1_2023'] as const) {
      const f = fixtures[key];
      expect(f.forecastDays).toBe(0);
      expect(f.measuredDays).toBe(f.days);
    }
  });

  it('weather-partial-normalization: the HDD ratio, and NOT the normalization factor', () => {
    const thisYear = fixtures.q1_2024;
    const reference = fixtures.q1_2023;
    const used2024 = 4200;

    const normalized = Math.round(
      used2024 * (reference.totalWeightedHDD / thisYear.totalWeightedHDD)
    );
    expect(normalized).toBe(q('weather-partial-normalization').expected_value);

    // The plain-HDD road is the other defensible one, and the tolerance must admit it.
    const plainHdd = Math.round(used2024 * (reference.totalHDD / thisYear.totalHDD));
    const tolerance = q('weather-partial-normalization').tolerance as number;
    expect(Math.abs(plainHdd - normalized)).toBeLessThanOrEqual(tolerance);

    // The must_not_say road must sit far outside it — the roads discriminate, not the tolerance.
    const viaFactor = Math.round(used2024 * thisYear.gasNormalizationFactor);
    expect(Math.abs(viaFactor - normalized)).toBeGreaterThan(tolerance * 10);
  });

  it('weather-single-quarter: the must_not_say figure is the factor applied to the quarter', () => {
    const f = fixtures.q1_2024;
    expect(Math.round(f.gasNormalizationFactor * 100) / 100).toBe(2.53);
    expect(Math.round(NL_REFERENCE_HDD / f.totalWeightedHDD * 100) / 100).toBe(2.53);
    const viaFactor = Math.round(4200 * f.gasNormalizationFactor);
    expect(Math.abs(viaFactor - 10626)).toBeLessThan(10);
    expect(q('weather-single-quarter').must_not_say as string).toContain('10,626');
  });

  it('weather-partial-normalization: the trap is real — the factor IS returned on a quarter', () => {
    // 2800 / a quarter's degree-days. The tool computes and returns it anyway.
    expect(fixtures.q1_2024.gasNormalizationFactor).toBeCloseTo(
      NL_REFERENCE_HDD / fixtures.q1_2024.totalWeightedHDD,
      1
    );
    expect(fixtures.q1_2024.days).toBeLessThan(365);
  });

  it('weather-partial-normalization: 2024 really was the milder quarter, and the raw drop overstates the saving', () => {
    expect(fixtures.q1_2024.totalWeightedHDD).toBeLessThan(fixtures.q1_2023.totalWeightedHDD);
    const rawDrop = (4600 - 4200) / 4600;
    const realDrop = (4600 - (q('weather-partial-normalization').expected_value as number)) / 4600;
    expect(realDrop).toBeLessThan(rawDrop / 2);
  });

  it('solar-yield-check: healthy across the whole PR band, and a false alarm without one', () => {
    const ghi = fixtures.year_2024.totalGHI_kWhM2;
    const kwp = 12;
    const produced = 8600;

    // Inside the stated band the verdict must be stable, or the question is measuring noise.
    for (const pr of [PR_MIN, 0.8, PR_MAX]) {
      expect(produced / (ghi * kwp * pr)).toBeGreaterThan(SOLAR_INVESTIGATE_BELOW);
    }

    // Drop the performance ratio and the same installation trips the threshold. That is the trap.
    expect(produced / (ghi * kwp)).toBeLessThan(SOLAR_INVESTIGATE_BELOW);
  });

  it('select-blind: the guessed names really are dropped, and the call still succeeds', () => {
    const probe = fixtures.select_probe;
    expect(probe.records_returned).toHaveLength(3);
    // Every record came back carrying `date` and nothing else — the values are gone, silently.
    for (const record of probe.records_returned) {
      expect(Object.keys(record)).toEqual(['date']);
    }
    expect(probe.alert).toContain('ignored unknown field');
    // And the names the question requires are NOT the ones a caller would guess.
    expect(q('select-blind').required_params).toMatchObject({
      select: ['date', 'weatherLabel', 'tempMax'],
    });
  });

  it('select-hides-the-evidence: the rule needs BOTH fields, and gives exactly 11 days', () => {
    const records = fixtures.apr_may_2024.records;
    const risky = records.filter((r) => r.tempMin < 14 && r.tempMax > 20);

    expect(records).toHaveLength(61);
    expect(risky).toHaveLength(fixtures.apr_may_2024.risk_days_expected);
    expect(risky.map((r) => r.date)).toEqual([
      '2024-04-06',
      '2024-04-13',
      '2024-04-30',
      '2024-05-01',
      '2024-05-02',
      '2024-05-11',
      '2024-05-12',
      '2024-05-15',
      '2024-05-18',
      '2024-05-19',
      '2024-05-21',
    ]);

    // Neither field alone finds them: drop either half of the rule and the set changes.
    expect(records.filter((r) => r.tempMax > 20)).not.toHaveLength(risky.length);
    expect(records.filter((r) => r.tempMin < 14)).not.toHaveLength(risky.length);
  });

  it('select-hides-the-evidence: tempMean does not just lose the signal, it inverts the ranking', () => {
    const records = fixtures.apr_may_2024.records;
    const risky = records.filter((r) => r.tempMin < 14 && r.tempMax > 20);
    const warmestMean = Math.max(...risky.map((r) => r.tempMean));

    // The risky days are unremarkable by mean...
    expect(warmestMean).toBeLessThan(19);

    // ...and the days a tempMean projection would put FIRST are not risky at all.
    const warmerThanAnyRiskDay = records.filter((r) => r.tempMean > warmestMean);
    expect(warmerThanAnyRiskDay.length).toBeGreaterThan(0);
    for (const day of warmerThanAnyRiskDay) {
      expect(day.tempMin < 14 && day.tempMax > 20).toBe(false);
    }
  });

  it('select-wrong-degree-day: the two degree-day fields differ by enough to matter', () => {
    const q1 = fixtures.q1_2024;
    expect(q1.totalWeightedHDD).toBe(q('select-wrong-degree-day').expected_value);

    const tolerance = q('select-wrong-degree-day').tolerance as number;
    expect(Math.abs(q1.totalHDD - q1.totalWeightedHDD)).toBeGreaterThan(tolerance * 50);

    // Winter weighting is UP (x1.1 for Nov-Feb), so the Dutch series must exceed the raw one.
    expect(q1.totalWeightedHDD).toBeGreaterThan(q1.totalHDD);
  });

  it('heating-season-held-out: normal-winter figure from the same-window reference, not the annual 2800', () => {
    const f = (fixtures as unknown as Record<string, Record<string, number | number[]>>).heating_season_2023_24;
    const seasons = f.reference_season_weightedHDD as number[];
    const mean = seasons.reduce((s, x) => s + x, 0) / seasons.length;
    // The per-season list is rounded to whole HDD; the recorded mean is from unrounded days.
    expect(Math.abs(mean - (f.referencePeriodWeightedHDD as number))).toBeLessThan(1);
    const normalized = ((f.gas_m3 as number) * (f.referencePeriodWeightedHDD as number)) / (f.totalWeightedHDD as number);
    expect(Math.round(normalized)).toBe(q('heating-season-held-out').expected_value);
    const trap = ((f.gas_m3 as number) * 2800) / (f.totalWeightedHDD as number);
    expect(Math.round(trap)).toBe(f.annual_factor_trap_m3);
    expect(trap - normalized).toBeGreaterThan(2 * (q('heating-season-held-out').tolerance as number));
  });

  it('forecast-normalization carries no frozen number, on purpose', () => {
    const question = q('forecast-normalization');
    expect(question.expected_value).toBeUndefined();
    expect(question.scoring).toBe('judge');
    expect(question._no_frozen_fixture).toBeTruthy();
  });

  it('every candidate carries what a runner needs, and nothing it must not see', () => {
    for (const question of (weatherQuestions as unknown as { questions: Array<Record<string, unknown>> })
      .questions) {
      expect(question.id).toBeTruthy();
      expect(question.shape).toBeTruthy();
      expect(question.question).toBeTruthy();
      expect(question.ground_truth).toBeTruthy();
      expect(question.must_not_say).toBeTruthy();
      expect(question.scoring).toBeTruthy();
      // The question string is all the runner passes — it must not leak the answer.
      expect(question.question as string).not.toContain('gasNormalizationFactor');
      expect(question.question as string).not.toContain('weightedHDD');
    }
  });
});
