import { describe, expect, it } from 'vitest';
import { conditionalInterpretation } from './get-building-profile-inline-conditional.js';
import { interpretationBlock } from './get-building-profile.js';

/**
 * Q2's arm is only worth running if it differs from `inline` in exactly one way:
 * how much of the SAME prose ships. These tests pin that. A failure here means the
 * comparison with `inline` has stopped being attributable, not that a detail broke.
 */

/** NEN 7120 utiliteitsbouw — Middenwetering 1, the smoke-test address. */
const nen7120 = {
  matchStatus: 'exact',
  berekeningstype: 'NEN 7120+C2:2012/C3:2013/C4,C5:2015, addendum 1 juli 2018',
  energielabel: 'A++',
  energie_index: 0.91,
  sbi_code: 'Gespecialiseerde werkzaamheden in de bouw',
  co2_emissie_kg_m2: 28.12,
  vbo_status: 'Verblijfsobject in gebruik',
  bouwjaar: 2008,
  ep_online_bouwjaar: 2008,
  label_geldig_tot: '2029-08-06T00:00:00',
  op_basis_van_referentiegebouw: false,
  ep1_energiebehoefte_kwh_m2: null,
  ep2_fossiel_kwh_m2: null,
  warmtebehoefte_kwh_m2: null,
  compactheid: null,
  temperatuuroverschrijding: null,
  gebruiksoppervlakte_thermische_zone_m2: null,
  gebouwtype: null,
  gebouwsubtype: null,
  soort_opname: null,
  ep2_fossiel_emg_forfaitair_kwh_m2: null,
  aandeel_hernieuwbaar_emg_forfaitair_pct: null,
  eis_energiebehoefte_kwh_m2: null,
  eis_primaire_fossiele_energie_kwh_m2: null,
  eis_aandeel_hernieuwbare_energie_pct: null,
};

/** NTA 8800 woningbouw — Van Beuningenstraat 1, the total-vs-per-m2 address. */
const nta8800 = {
  matchStatus: 'multiple_vbos',
  berekeningstype: 'NTA 8800:2020',
  energielabel: 'A',
  energie_index: null,
  sbi_code: null,
  co2_emissie_kg_m2: 28.59,
  gebruiksoppervlakte_thermische_zone_m2: 92,
  oppervlakte_m2: 100,
  gebouwtype: 'Appartement',
  gebouwsubtype: 'hoekmidden',
  soort_opname: 'Basisopname',
  vbo_status: 'Verblijfsobject in gebruik',
  bouwjaar: 1937,
  ep_online_bouwjaar: 1937,
  label_geldig_tot: '2032-01-31T00:00:00',
  op_basis_van_referentiegebouw: false,
  ep1_energiebehoefte_kwh_m2: null,
  warmtebehoefte_kwh_m2: null,
  compactheid: null,
  temperatuuroverschrijding: null,
  ep2_fossiel_emg_forfaitair_kwh_m2: null,
  aandeel_hernieuwbaar_emg_forfaitair_pct: null,
  eis_energiebehoefte_kwh_m2: null,
  eis_primaire_fossiele_energie_kwh_m2: null,
  eis_aandeel_hernieuwbare_energie_pct: null,
};

const lines = (s: string) => s.split('\n');

describe('conditionalInterpretation', () => {
  it('emits only lines that exist verbatim in interpretationBlock — the prose cannot drift', () => {
    const source = new Set(lines(interpretationBlock));
    for (const profile of [nen7120, nta8800]) {
      for (const line of lines(conditionalInterpretation(profile))) {
        expect(source.has(line)).toBe(true);
      }
    }
  });

  it('actually prunes — a pruned arm that ships everything measures nothing', () => {
    for (const profile of [nen7120, nta8800]) {
      expect(lines(conditionalInterpretation(profile)).length).toBeLessThan(lines(interpretationBlock).length);
    }
  });

  it('keeps the header and the lead-in, so the block is still readable prose', () => {
    const out = conditionalInterpretation(nta8800);
    expect(out.startsWith('INTERPRETATION:')).toBe(true);
    expect(out).toContain('Which fields are populated depends on the berekeningstype:');
  });

  it('keeps exactly ONE berekeningstype branch, the matching one', () => {
    const branchCount = (s: string) =>
      lines(s).filter(
        (l) =>
          l.startsWith('- NTA 8800 (') || l.startsWith('- NEN 7120 / ISSO 75.3') || l.startsWith('- Nader Voorschrift'),
      ).length;

    const nen = conditionalInterpretation(nen7120);
    expect(branchCount(nen)).toBe(1);
    expect(nen).toContain('- NEN 7120 / ISSO 75.3');
    expect(nen).not.toContain('- Nader Voorschrift');

    const nta = conditionalInterpretation(nta8800);
    expect(branchCount(nta)).toBe(1);
    expect(nta).toContain('- NTA 8800 (');
    expect(nta).not.toContain('- NEN 7120 / ISSO 75.3');
  });

  it('drops notes for fields that are null in this record, keeps them when populated', () => {
    const nen = conditionalInterpretation(nen7120);
    // energie_index is populated here, warmtebehoefte and the thermal zone are not.
    expect(nen).toContain('- energie_index (pre-NTA 8800)');
    expect(nen).not.toContain('- warmtebehoefte_kwh_m2 (net heat demand)');
    expect(nen).not.toContain('- gebruiksoppervlakte_thermische_zone_m2');

    const nta = conditionalInterpretation(nta8800);
    // Mirror image: the thermal zone is populated, energie_index is not.
    expect(nta).toContain('- gebruiksoppervlakte_thermische_zone_m2');
    expect(nta).not.toContain('- energie_index (pre-NTA 8800)');
  });

  it('keeps only the matchStatus note that applies', () => {
    expect(conditionalInterpretation(nen7120)).toContain("- matchStatus 'exact'");
    expect(conditionalInterpretation(nen7120)).not.toContain("- matchStatus 'multiple_vbos'");
    expect(conditionalInterpretation(nta8800)).toContain("- matchStatus 'multiple_vbos'");
    expect(conditionalInterpretation(nta8800)).not.toContain("- matchStatus 'exact'");
  });

  it('does not suppress a note whose field IS populated, even when that note is inconvenient', () => {
    // The co2 unit caveat is the sentence total-vs-per-m2 turns on. It is gated on
    // co2_emissie_kg_m2 being populated, which it is — so it must survive. This is
    // a gate check, NOT a special case: if the field were null the line would go,
    // and that is the behaviour Q2 is measuring.
    expect(conditionalInterpretation(nta8800)).toContain('- co2_emissie_kg_m2 unit depends');
  });

  it('cuts a substantial fraction of the block — the cost claim needs to be real', () => {
    const before = interpretationBlock.length;
    const after = conditionalInterpretation(nta8800).length;
    expect(after).toBeLessThan(before * 0.75);
  });
});
