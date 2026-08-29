import { describe, expect, it } from 'vitest';
import { applySelect } from './project-fields.js';

const RECORDS = [
  { date: '2024-01-01', tempMean: 3.2, weatherLabel: 'Bewolkt' },
  { date: '2024-01-02', tempMean: 1.8, weatherLabel: 'Mist' },
];

describe('applySelect', () => {
  it('is inert when select is undefined', () => {
    const result = applySelect(RECORDS, undefined);
    expect(result.records).toEqual(RECORDS);
    expect(result.alerts).toEqual([]);
  });

  it('is inert when select is an empty array', () => {
    const result = applySelect(RECORDS, []);
    expect(result.records).toEqual(RECORDS);
    expect(result.alerts).toEqual([]);
  });

  it('projects records to only the requested fields', () => {
    const result = applySelect(RECORDS, ['date', 'weatherLabel']);
    expect(result.records).toEqual([
      { date: '2024-01-01', weatherLabel: 'Bewolkt' },
      { date: '2024-01-02', weatherLabel: 'Mist' },
    ]);
  });

  it('alerts that omitted fields are excluded, not null', () => {
    const result = applySelect(RECORDS, ['date']);
    expect(result.alerts.some((a) => /NOT null, just excluded/.test(a))).toBe(true);
  });

  it('ignores unknown fields and alerts about them, without erroring', () => {
    const result = applySelect(RECORDS, ['date', 'bogusField']);
    expect(result.records).toEqual([{ date: '2024-01-01' }, { date: '2024-01-02' }]);
    expect(result.alerts.some((a) => /ignored unknown field\(s\) \[bogusField\]/.test(a))).toBe(true);
  });

  it('returns zero records (never falls back to full records) when no requested field is valid', () => {
    const result = applySelect(RECORDS, ['bogusField']);
    expect(result.records).toEqual([]);
    expect(result.alerts.some((a) => /none of the requested field\(s\)/.test(a))).toBe(true);
    expect(result.alerts.some((a) => /Valid fields: date, tempMean, weatherLabel/.test(a))).toBe(true);
  });
});
