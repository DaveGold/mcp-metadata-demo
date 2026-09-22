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
