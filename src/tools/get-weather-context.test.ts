import { describe, expect, it } from 'vitest';
import { buildRows, computeWeightedHdd, summarizeWeather, wmoWeatherLabel } from './get-weather-context.js';

describe('computeWeightedHdd', () => {
  it('applies the winter weight (Nov-Feb, x1.1)', () => {
    expect(computeWeightedHdd(12, 10)).toBeCloseTo(11);
    expect(computeWeightedHdd(1, 10)).toBeCloseTo(11);
  });

  it('applies the shoulder weight (Mar/Oct, x1.0)', () => {
    expect(computeWeightedHdd(3, 10)).toBeCloseTo(10);
    expect(computeWeightedHdd(10, 10)).toBeCloseTo(10);
  });

  it('applies the summer weight (Apr-Sep, x0.8)', () => {
    expect(computeWeightedHdd(6, 10)).toBeCloseTo(8);
  });
});

describe('wmoWeatherLabel', () => {
  it('maps a known WMO code to its Dutch label', () => {
    expect(wmoWeatherLabel(3)).toBe('Bewolkt');
  });

  it('falls back to "Onbekend" for an unknown code', () => {
    expect(wmoWeatherLabel(999)).toBe('Onbekend');
  });

  it('falls back to "Onbekend" for null', () => {
    expect(wmoWeatherLabel(null)).toBe('Onbekend');
  });
});

describe('buildRows', () => {
  const daily = {
    time: ['2024-06-01', '2024-06-02'],
    temperature_2m_mean: [20, null],
    temperature_2m_max: [24, 22],
    temperature_2m_min: [16, 14],
    shortwave_radiation_sum: [18, 10],
    sunshine_duration: [36000, 3600],
    weather_code: [1, 61],
  };

  it('skips rows with missing core temperature data (archive lag)', () => {
    const rows = buildRows(daily, false);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2024-06-01');
  });

  it('converts GHI from MJ/m² to kWh/m² and sunshine from seconds to hours', () => {
    const rows = buildRows(daily, false);
    expect(rows[0].ghiKwhM2).toBeCloseTo(18 / 3.6, 2);
    expect(rows[0].sunshineDurationHours).toBeCloseTo(10, 1);
  });

  it('stamps isForecast as given', () => {
    expect(buildRows(daily, true)[0].isForecast).toBe(true);
    expect(buildRows(daily, false)[0].isForecast).toBe(false);
  });

  it('returns an empty array when daily is undefined or has no rows', () => {
    expect(buildRows(undefined, false)).toEqual([]);
    expect(buildRows({ ...daily, time: [] }, false)).toEqual([]);
  });
});

describe('summarizeWeather', () => {
  it('returns zero aggregates (never Math.min/reduce over an empty array) when there are no measured days', () => {
    const forecastOnly = buildRows(
      {
        time: ['2024-06-01'],
        temperature_2m_mean: [20],
        temperature_2m_max: [24],
        temperature_2m_min: [16],
        shortwave_radiation_sum: [18],
        sunshine_duration: [36000],
        weather_code: [1],
      },
      true
    );
    const result = summarizeWeather(forecastOnly, { dateFrom: '2024-06-01', dateTo: '2024-06-01' });
    expect(result.summary.period.measuredDays).toBe(0);
    expect(result.summary.degreeDays.gasNormalizationFactor).toBe(0);
    expect(result.summary.temperature.coldestDay).toBe('');
  });

  it('flags fighting-system risk days (tempMin < 14 and tempMax > 20)', () => {
    const rows = buildRows(
      {
        time: ['2024-05-01'],
        temperature_2m_mean: [17],
        temperature_2m_max: [22],
        temperature_2m_min: [10],
        shortwave_radiation_sum: [15],
        sunshine_duration: [20000],
        weather_code: [2],
      },
      false
    );
    const result = summarizeWeather(rows, { dateFrom: '2024-05-01', dateTo: '2024-05-01' });
    expect(result.interpretation.alerts.some((a) => /fighting-system risk/.test(a))).toBe(true);
  });
});
