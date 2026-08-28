import { describe, expect, it } from 'vitest';
import { inputSchema } from './render-map.js';

/**
 * Regression tests for the markers input schema.
 *
 * The positional shorthand must be modeled as an array OF rows, not one flat
 * row: the documented (and preferred) form [[lat, lng, label], ...] must pass
 * validation while a single flat row must be rejected. The schema stays
 * connector-safe (no tuple JSON Schema) but keeps strict per-slot runtime types.
 */
describe('render_map markers schema', () => {
  const markers = inputSchema.markers;

  it('accepts keyed marker objects', () => {
    const result = markers.safeParse([
      { lat: 52.09, lng: 5.11, label: 'Utrecht hub' },
      { lat: 52.37, lng: 4.9, label: 'Amsterdam', description: 'Head office', type: 'building' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts the documented positional form (array of rows)', () => {
    const result = markers.safeParse([
      [52.09, 5.11, 'Utrecht hub'],
      [52.37, 4.9, 'Amsterdam', 'Head office', 'building'],
      [51.92, 4.48, 'Rotterdam', 'Depot', 'pin', '#e82b21'],
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts a positional form with a single row', () => {
    const result = markers.safeParse([[52.09, 5.11, 'Utrecht hub']]);
    expect(result.success).toBe(true);
  });

  it('rejects one flat positional row not wrapped in an outer array', () => {
    const result = markers.safeParse([52.09, 5.11, 'Utrecht hub']);
    expect(result.success).toBe(false);
  });

  it('rejects a positional row with too few values', () => {
    const result = markers.safeParse([[52.09, 5.11]]);
    expect(result.success).toBe(false);
  });

  it('rejects a positional row with wrong slot types', () => {
    // label slot must be a string, not a number
    const result = markers.safeParse([[52.09, 5.11, 123]]);
    expect(result.success).toBe(false);
  });

  it('rejects a positional row with an invalid marker type', () => {
    const result = markers.safeParse([[52.09, 5.11, 'Utrecht', 'Depot', 'boat']]);
    expect(result.success).toBe(false);
  });
});
