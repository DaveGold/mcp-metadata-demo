/**
 * Pins the CALCULATED vs MEASURED sentence added on 2026-09-21 and the gate that
 * decides whether the inline-conditional arm ships it.
 *
 * WHY THIS TEST EXISTS. The Q2 run (results/2026-09-21-q2-conditional-interpretation.json)
 * found benchmark-trap scoring 0 of 10 in all six cells, on both arms and all three
 * models, because `interpretationBlock` contained no statement that the NTA 8800
 * figures are CALCULATED while Paris Proof is defined on MEASURED FINAL energy — while
 * the `ep1 ... Paris Proof kantoor 70 kWh/m²` line, which invites exactly the forbidden
 * comparison, shipped in every response. The sentence below is that missing statement.
 * If it is ever removed or silently reworded, benchmark-trap returns to measuring the
 * absence, and these assertions fail loudly instead.
 */
import { describe, it, expect } from 'vitest';
import { interpretationBlock } from './get-building-profile.js';
import { conditionalInterpretation } from './get-building-profile-inline-conditional.js';

const PREFIX = '- CALCULATED vs MEASURED';

/** NTA 8800 utiliteitsbouw — the benchmark-trap record (Gustav Mahlerlaan 10). */
const nta8800 = {
  matchStatus: 'exact',
  berekeningstype: 'NTA 8800:2022 (basisopname utiliteitsbouw)',
  ep1_energiebehoefte_kwh_m2: 81.68,
  ep2_fossiel_kwh_m2: 179.06,
  berekend_energieverbruik_kwh_m2: 229.17,
  energie_index: null,
};

/** A record carrying none of the three fields the sentence concerns. */
const noneOfTheThree = {
  matchStatus: 'exact',
  berekeningstype: 'NEN 7120 / ISSO 75.3 (utiliteitsbouw)',
  ep1_energiebehoefte_kwh_m2: null,
  ep2_fossiel_kwh_m2: null,
  berekend_energieverbruik_kwh_m2: null,
  energie_index: 1.55,
};

describe('the calculated-vs-measured sentence', () => {
  it('is present in interpretationBlock exactly once', () => {
    const hits = interpretationBlock.split('\n').filter((l) => l.startsWith(PREFIX));
    expect(hits).toHaveLength(1);
  });

  it('states the distinction the Q2 run found missing', () => {
    const line = interpretationBlock.split('\n').find((l) => l.startsWith(PREFIX)) ?? '';
    // The three terms whose absence made benchmark-trap unanswerable.
    expect(line).toContain('MEASURED FINAL');
    expect(line).toContain('NO metered data');
    expect(line).toMatch(/CALCULATED/);
    // It must name all three fields a run could rank against the target.
    expect(line).toContain('ep1_energiebehoefte');
    expect(line).toContain('ep2_fossiel');
    expect(line).toContain('berekend_energieverbruik');
  });

  it('leaves the ep1 Paris Proof line in place — the 2026-09-21 change ADDS, it does not remove', () => {
    expect(interpretationBlock).toContain('Paris Proof 2040 targets');
    expect(interpretationBlock).toContain('kantoor: 70 kWh/m²');
  });

  it('SURVIVES pruning on an NTA 8800 record, so both arms ship it there', () => {
    expect(conditionalInterpretation(nta8800)).toContain(PREFIX);
  });

  it('IS pruned when none of ep1/ep2/berekend is populated', () => {
    expect(conditionalInterpretation(noneOfTheThree)).not.toContain(PREFIX);
  });

  it('is sliced from the source block, never retyped', () => {
    const fromBlock = interpretationBlock.split('\n').find((l) => l.startsWith(PREFIX));
    const fromArm = conditionalInterpretation(nta8800)
      .split('\n')
      .find((l) => l.startsWith(PREFIX));
    expect(fromArm).toBe(fromBlock);
  });
});
