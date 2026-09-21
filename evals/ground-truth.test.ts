/**
 * The eval set checks itself.
 *
 * Every ground_truth in questions.json must be re-derivable from the frozen
 * profiles in addresses.json. Anyone picking this set up can run `npm test` and
 * see that the expected answers follow from real captured data rather than from
 * someone's recollection — and if a re-capture ever moves a value, this fails
 * instead of the set quietly going stale.
 */

import { describe, it, expect } from 'vitest';
import questions from './questions.json' with { type: 'json' };
import addresses from './addresses.json' with { type: 'json' };

const KWH_PER_M3_GAS = 31.65 / 3.6;
const HR_BOILER = 0.95;

type Kv = Record<string, number | string | null>;
const kv = (key: string): Kv =>
  (addresses as unknown as { addresses: Record<string, { key_values: Kv }> }).addresses[key].key_values;

const q = (id: string) =>
  (questions as unknown as { questions: Array<Record<string, unknown>> }).questions.find((x) => x.id === id)!;

/** The heat-pump bands, as the server states them. */
function band(wb: number): string {
  if (wb < 50) return 'very suitable';
  if (wb < 70) return 'suitable';
  if (wb < 100) return 'with upgrades';
  return 'insulate first';
}

describe('eval set — ground truth follows from the frozen profiles', () => {
  it('has a question for every shape it claims to cover', () => {
    const shapes = new Set(
      (questions as unknown as { questions: Array<{ shape: string }> }).questions.map((x) => x.shape)
    );
    const declared = Object.keys((questions as unknown as { _shapes: object })._shapes);
    expect([...shapes].sort()).toEqual(declared.sort());
  });

  it('gas-estimate: warmtebehoefte x thermal zone, at boiler efficiency and the kWh/m3 value', () => {
    const k = kv('ijburglaan');
    const expected = Math.round(
      ((k.warmtebehoefte_kwh_m2 as number) * (k.gebruiksoppervlakte_thermische_zone_m2 as number)) /
        HR_BOILER /
        KWH_PER_M3_GAS
    );
    expect(expected).toBe(q('gas-estimate').expected_value);
    // and NOT the BAG-area answer, which is the mistake the question exists to catch
    const bagAnswer = Math.round(
      ((k.warmtebehoefte_kwh_m2 as number) * (k.oppervlakte_m2 as number)) / HR_BOILER / KWH_PER_M3_GAS
    );
    expect(bagAnswer).not.toBe(q('gas-estimate').expected_value);
  });

  it('total-vs-per-m2: co2 per m2 x thermal zone, not x BAG area', () => {
    const k = kv('vanbeuningen');
    const expected = Math.round(
      (k.co2_emissie_kg_m2 as number) * (k.gebruiksoppervlakte_thermische_zone_m2 as number)
    );
    expect(expected).toBe(q('total-vs-per-m2').expected_value);
    expect(Math.round((k.co2_emissie_kg_m2 as number) * (k.oppervlakte_m2 as number))).not.toBe(
      q('total-vs-per-m2').expected_value
    );
  });

  it('heat-pump-triage: three different bands, and the margins that make it hard', () => {
    const verdicts = (['ijburglaan', 'vanbeuningen', 'troelstralaan'] as const).map((a) =>
      band(kv(a).warmtebehoefte_kwh_m2 as number)
    );
    expect(verdicts).toEqual(['suitable', 'with upgrades', 'insulate first']);
    expect(new Set(verdicts).size).toBe(3); // a three-way ordering, not a coin flip

    // Why the ordering alone proves nothing: the energy-label ordering agrees with it, so a model
    // that never reads warmtebehoefte still gets the order right. This is what saturated the
    // question at 20/20 on sonnet. The margins are the part the label cannot give you.
    const labels = (['ijburglaan', 'vanbeuningen', 'troelstralaan'] as const).map(
      (a) => kv(a).energielabel as string
    );
    expect(labels).toEqual(['A+', 'A', 'B']); // best-to-worst, same order as the verdicts

    const wb = (a: string) => kv(a).warmtebehoefte_kwh_m2 as number;
    // IJburglaan is just over the very-suitable line
    expect(wb('ijburglaan') - 50).toBeCloseTo(2.73, 2);
    // Van Beuningenstraat is the sharp one: under a point from flipping to insulate-first
    expect(100 - wb('vanbeuningen')).toBeCloseTo(0.88, 2);
    expect(100 - wb('vanbeuningen')).toBeLessThan(1);
    // Troelstralaan is not near any boundary, so it is the one an arm should never get wrong
    expect(wb('troelstralaan')).toBeGreaterThan(130);
  });

  it('wrong-unit: the huisletter unit has a different area from the plain number', () => {
    expect(kv('rijnlaan28a').oppervlakte_m2).toBe(q('wrong-unit').expected_value);
    expect(kv('rijnlaan28').oppervlakte_m2).not.toBe(q('wrong-unit').expected_value);
  });

  it('building-size: the pand really does hold far more than one unit', () => {
    const k = kv('ijburglaan');
    expect(k.aantal_verblijfsobjecten as number).toBeGreaterThan(10);
    expect(k.oppervlakte_m2 as number).toBeLessThan(k.aantal_verblijfsobjecten as number);
  });

  it('benchmark-trap: everything is populated, and it still is not comparable', () => {
    const k = kv('mahlerlaan');
    // The point of the hardened version: no null to tip anyone off. NTA 8800, fully populated.
    expect(k.berekeningstype as string).toContain('NTA 8800');
    for (const f of ['ep1_energiebehoefte_kwh_m2', 'ep2_fossiel_kwh_m2', 'gebruiksoppervlakte_thermische_zone_m2']) {
      expect(k[f], `${f} must be populated for this trap to bite`).not.toBeNull();
    }
    // The trap: ep2 is primary fossil energy, the 70 kWh/m2 Paris Proof target is measured final
    // energy. Same unit, different quantity — and the naive ratio looks authoritative.
    const PARIS_PROOF_OFFICE = 70;
    const naiveRatio = (k.ep2_fossiel_kwh_m2 as number) / PARIS_PROOF_OFFICE;
    expect(naiveRatio).toBeCloseTo(2.56, 1); // the ~2.6x the question forbids asserting

    // Secondary trap: the two plausible denominators disagree by nearly 2x.
    const areaRatio =
      (k.gebruiksoppervlakte_thermische_zone_m2 as number) / (k.oppervlakte_m2 as number);
    expect(areaRatio).toBeGreaterThan(1.5);

    // And it is scored on the utiliteitsbouw letter scale, not the residential one.
    expect(k.gebouwklasse).toBe('Utiliteitsbouw');
  });

  it('metered-vs-model still has its NEN 7120 record', () => {
    const k = kv('middenwetering');
    expect(k.berekeningstype as string).toContain('NEN 7120');
    expect(k.berekend_energieverbruik_kwh_m2 as number).toBeGreaterThan(200);
  });

  it('overheating: the value is above the significant-risk threshold', () => {
    expect(kv('vanbeuningen').temperatuuroverschrijding as number).toBeGreaterThan(1.5);
  });

  it('the two refusal controls really have no registered label', () => {
    expect(kv('hoogeveen').energielabel).toBeNull();
    expect(kv('hoogeveen').labelCount).toBe(0);
    expect(kv('domplein').energielabel).toBeNull();
  });

  it('every question carries what a runner needs, and nothing it must not see', () => {
    for (const x of (questions as unknown as { questions: Array<Record<string, unknown>> }).questions) {
      for (const f of ['id', 'shape', 'asks', 'question', 'ground_truth', 'must_not_say', 'scoring']) {
        expect(x[f], `${x.id} is missing ${f}`).toBeDefined();
      }
      if (x.scoring === 'exact_value') expect(x.expected_value, `${x.id}`).toBeDefined();
      // research archaeology belongs in results/, not in the spec
      for (const f of ['regimes', 'outcome_class', 'sweep_2026_09_21', 'max_calls']) {
        expect(x[f], `${x.id} still carries ${f}`).toBeUndefined();
      }
    }
  });
});
