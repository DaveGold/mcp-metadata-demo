import { describe, it, expect } from 'vitest';
import { overheatingLine } from './get-building-profile.js';
import { scopesLine } from './get-building-profile-q10.js';
import { q17Rules, q17Interpretation } from './get-building-profile-q17.js';

describe('Q17 rules', () => {
  it('are 100, with the targets at 41 and 63', () => {
    expect(q17Rules).toHaveLength(100);
    expect(q17Rules[41].meaning).toBe(overheatingLine);
    expect(q17Rules[63].meaning).toBe(scopesLine);
  });
  it('no distractor touches either answer', () => {
    const bad = /temperatuuroverschrijding|thermische_zone|co2_emissie|per-m²|per m²|whole-building|gebruiksoppervlakte/i;
    q17Rules.forEach((r, i) => { if (i !== 41 && i !== 63) expect(r.meaning).not.toMatch(bad); });
  });
  it('carry the same 100 texts as prose and addressed', () => {
    const prose = (q17Interpretation('many') as string).split('\n');
    const addr = q17Interpretation('many-addressed') as Array<{ meaning: string }>;
    expect(prose).toEqual(addr.map((r) => r.meaning));
    expect(q17Interpretation('one')).toBe(overheatingLine + '\n' + scopesLine);
  });
});
