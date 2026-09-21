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

  it('heat-pump-triage: the three addresses fall in three different bands', () => {
    const verdicts = (['ijburglaan', 'vanbeuningen', 'troelstralaan'] as const).map((a) =>
      band(kv(a).warmtebehoefte_kwh_m2 as number)
    );
    expect(verdicts).toEqual(['suitable', 'with upgrades', 'insulate first']);
    expect(new Set(verdicts).size).toBe(3); // a three-way ordering, not a coin flip
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

  it('benchmark-trap: a NEN 7120 label, so the per-m2 figure is not comparable', () => {
    const k = kv('middenwetering');
    expect(k.berekeningstype as string).toContain('NEN 7120');
    expect(k.energie_index as number).toBeLessThan(1.2); // EI < 1.2 = label A or better
    expect(k.energielabel as string).toMatch(/^A/);
    // the trap: a figure that reads as kWh/m2 and dwarfs any real benchmark
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
