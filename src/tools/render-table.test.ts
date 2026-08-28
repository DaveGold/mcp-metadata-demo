import { describe, expect, it } from 'vitest';
import { findRowShapeError } from './render-table.js';

const COLUMNS = [
  { key: 'id', header: 'Id' },
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
];

describe('findRowShapeError', () => {
  it('accepts keyed object rows', () => {
    const data = [
      { id: '3451', name: 'André', email: 'andre@example.com' },
      { id: '3452', name: 'Jane', email: 'jane@example.com' },
    ];
    expect(findRowShapeError(COLUMNS, data)).toBeNull();
  });

  it('accepts positional rows matching columns length', () => {
    const data = [
      ['3451', 'André', 'andre@example.com'],
      ['3452', 'Jane', 'jane@example.com'],
    ];
    expect(findRowShapeError(COLUMNS, data)).toBeNull();
  });

  it('accepts an empty data array', () => {
    expect(findRowShapeError(COLUMNS, [])).toBeNull();
  });

  it('rejects a positional row that is shorter than columns', () => {
    const data = [
      ['3451', 'André', 'andre@example.com'],
      ['3452', 'Jane'],
    ];
    expect(findRowShapeError(COLUMNS, data)).toMatch(/row 1 has 2 values but there are 3 columns/i);
  });

  it('rejects a positional row that is longer than columns', () => {
    const data = [['3451', 'André', 'andre@example.com', 'extra']];
    expect(findRowShapeError(COLUMNS, data)).toMatch(/row 0 has 4 values but there are 3 columns/i);
  });

  it('rejects mixed keyed and positional rows', () => {
    const data = [{ id: '3451', name: 'André', email: 'andre@example.com' }, ['3452', 'Jane', 'jane@example.com']];
    expect(findRowShapeError(COLUMNS, data as Array<Record<string, unknown>>)).toMatch(/same shape/i);
  });

  it('allows object cells inside positional rows (e.g. trend values)', () => {
    const trendColumns = [...COLUMNS, { key: 'trend', header: 'Trend' }];
    const data = [['3451', 'André', 'andre@example.com', { value: 120000, delta: 0.08 }]];
    expect(findRowShapeError(trendColumns, data)).toBeNull();
  });
});
