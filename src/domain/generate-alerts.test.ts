import { describe, it, expect } from 'vitest';
import { generateAlerts } from './generate-alerts.js';
import type { ProfileCore } from './generate-alerts.js';

// Minimal baseline — every alert rule reads from this shape, so tests set the
// relevant fields and rely on null for everything else.
function baseProfile(overrides: Partial<ProfileCore> = {}): ProfileCore {
  return {
    matchStatus: 'exact',
    candidateCount: 1,
    labelCount: 0,
    adres: 'Teststraat 1, 1234AB Teststad',
    gemeente: null,
    provincie: null,
    oppervlakte_m2: null,
    gebruiksdoel: null,
    coordinaten: null,
    bag_vbo_id: null,
    vbo_status: null,
    bouwjaar: null,
    pand_status: null,
    aantal_verblijfsobjecten: null,
    bag_pand_id: null,
    energielabel: null,
    ep1_energiebehoefte_kwh_m2: null,
    ep2_fossiel_kwh_m2: null,
    aandeel_hernieuwbaar_pct: null,
    co2_emissie_kg_m2: null,
    berekend_energieverbruik_kwh_m2: null,
    warmtebehoefte_kwh_m2: null,
    temperatuuroverschrijding: null,
    compactheid: null,
    gebruiksoppervlakte_thermische_zone_m2: null,
    gebouwklasse: null,
    soort_opname: null,
    berekeningstype: null,
    label_status: null,
    op_basis_van_referentiegebouw: null,
    label_geldig_tot: null,
    label_opnamedatum: null,
    label_registratiedatum: null,
    gebouwtype: null,
    gebouwsubtype: null,
    sbi_code: null,
    energie_index: null,
    ep2_fossiel_emg_forfaitair_kwh_m2: null,
    aandeel_hernieuwbaar_emg_forfaitair_pct: null,
    eis_energiebehoefte_kwh_m2: null,
    eis_primaire_fossiele_energie_kwh_m2: null,
    eis_aandeel_hernieuwbare_energie_pct: null,
    certificaathouder: null,
    ep_online_bouwjaar: null,
    ...overrides,
  };
}

describe('generateAlerts', () => {
  it('suppresses bouwjaar-era alert when the label is A+ or better', () => {
    const alerts = generateAlerts(baseProfile({ bouwjaar: 1975, energielabel: 'A++' }));
    expect(alerts.some((a) => a.includes('Pre-Bouwbesluit'))).toBe(false);
  });

  it('emits pre-1992 era alert when label is mediocre', () => {
    const alerts = generateAlerts(baseProfile({ bouwjaar: 1975, energielabel: 'D' }));
    expect(alerts.some((a) => a.includes('Pre-Bouwbesluit 1992'))).toBe(true);
  });

  it('treats Nader Voorschrift co2_emissie as a total (not per m²)', () => {
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        berekeningstype: 'Nader Voorschrift',
        co2_emissie_kg_m2: 4200,
        oppervlakte_m2: 79,
      })
    );
    // Per-m² interpretation would multiply by 79 → ~331k. Total interpretation keeps ~4200.
    const co2Alert = alerts.find((a) => a.includes('CO₂ emissions'));
    expect(co2Alert).toBeDefined();
    expect(co2Alert).toMatch(/~4200 kg\/year/);
  });

  it('never ranks a CALCULATED EP-1 against Paris Proof or an unsourced benchmark', () => {
    for (const [ep1, gebruiksdoel, gebouwklasse] of [
      [85, 'kantoorfunctie', 'Utiliteitsbouw'],
      [132, 'woonfunctie', 'Woningbouw'],
      [199, 'winkelfunctie', 'Utiliteitsbouw'],
    ] as const) {
      const alerts = generateAlerts(baseProfile({ ep1_energiebehoefte_kwh_m2: ep1, gebruiksdoel, gebouwklasse }));
      expect(alerts.join(' ')).not.toMatch(/Paris Proof|above benchmark/i);
    }
  });

  it('produces a BENG-toetsing summary with ✓ / ✗ markers', () => {
    const alerts = generateAlerts(
      baseProfile({
        eis_energiebehoefte_kwh_m2: 50,
        ep1_energiebehoefte_kwh_m2: 70, // overschrijding
        eis_aandeel_hernieuwbare_energie_pct: 40,
        aandeel_hernieuwbaar_pct: 50, // passes
      })
    );
    const beng = alerts.find((a) => a.startsWith('BENG compliance:'));
    expect(beng).toBeDefined();
    expect(beng).toMatch(/BENG-1[\s\S]*EXCEEDED/);
    expect(beng).toMatch(/BENG-3[\s\S]*✓/);
  });

  it('flags expired labels and multiple-VBO matches', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const alerts = generateAlerts(
      baseProfile({
        matchStatus: 'multiple_vbos',
        candidateCount: 4,
        energielabel: 'C',
        label_geldig_tot: yesterday,
      })
    );
    expect(alerts.some((a) => a.includes('Multiple verblijfsobjecten (4)'))).toBe(true);
    expect(alerts.some((a) => a.includes('Energy label has expired'))).toBe(true);
  });

  it('does not emit the "no EP label" alert on not_found (EP was never queried)', () => {
    const alerts = generateAlerts(
      baseProfile({
        matchStatus: 'not_found',
        candidateCount: 0,
        energielabel: null,
      })
    );
    expect(alerts.some((a) => a.includes('No registered energy label'))).toBe(false);
  });

  it('emits the "no EP label" alert when BAG matched but EP-Online returned nothing', () => {
    const alerts = generateAlerts(
      baseProfile({
        matchStatus: 'exact',
        candidateCount: 1,
        labelCount: 0,
        energielabel: null,
        bouwjaar: 2010,
      })
    );
    expect(alerts.some((a) => a.includes('No registered energy label'))).toBe(true);
  });

  it('converts kWh heat demand with kWh/m3, not MJ/m3', () => {
    // Regression: the original formula divided a kWh numerator by 31.65 (MJ per m3)
    // instead of 8.79 (kWh per m3), understating gas use by exactly 3.6x.
    // 52.73 kWh/m2 over 41 m2 = 2162 kWh / 0.95 boiler / 8.79 kWh per m3 = ~259 m3.
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        warmtebehoefte_kwh_m2: 52.73,
        oppervlakte_m2: 41,
      })
    );
    const gasAlert = alerts.find((a) => a.includes('space-heating gas equivalent'));
    expect(gasAlert).toContain('~259 m³/year');
    // The old, wrong figure must never come back.
    expect(gasAlert).not.toContain('~72 m³/year');
  });

  it('measures per-m2 NTA values against the EP-Online thermal zone, not the BAG area', () => {
    // IJburglaan 433A: BAG 41 m2, EP-Online thermal zone 40.02 m2. warmtebehoefte
    // and co2_emissie are both per m2 of the thermal zone, so that is the
    // denominator; using the BAG area mixes two different scopes.
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        warmtebehoefte_kwh_m2: 52.73,
        oppervlakte_m2: 41,
        gebruiksoppervlakte_thermische_zone_m2: 40.02,
        co2_emissie_kg_m2: 13.79,
      })
    );
    const gasAlert = alerts.find((a) => a.includes('space-heating gas equivalent'));
    expect(gasAlert).toContain('~253 m³/year');
    expect(gasAlert).toContain('EP-Online thermische zone');
    expect(gasAlert).not.toContain('~259 m³/year');

    const co2Alert = alerts.find((a) => a.includes('Total CO₂ emissions'));
    expect(co2Alert).toContain('40.02 m² EP-Online thermische zone');
  });

  it('falls back to the BAG area, and says so, when EP-Online has no thermal zone', () => {
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        warmtebehoefte_kwh_m2: 52.73,
        oppervlakte_m2: 41,
        gebruiksoppervlakte_thermische_zone_m2: null,
      })
    );
    const gasAlert = alerts.find((a) => a.includes('space-heating gas equivalent'));
    expect(gasAlert).toContain('41 m² BAG');
  });

  it('says the gas figure is space heating only', () => {
    // warmtebehoefte excludes hot water and cooking. Calling the result
    // "estimated gas use" invited a homeowner to compare it with their bill.
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        warmtebehoefte_kwh_m2: 100,
        gebruiksoppervlakte_thermische_zone_m2: 120,
      })
    );
    const gasAlert = alerts.find((a) => a.includes('space-heating gas equivalent'));
    expect(gasAlert).toMatch(/SPACE HEATING ONLY/);
    expect(gasAlert).toMatch(/excludes hot water and cooking/);
  });

  it('keeps the gas estimate in a physically plausible band for a typical dwelling', () => {
    // A 120 m2 home at 100 kWh/m2 should land near 1400 m3/year — the range a
    // Dutch household would recognise on its own energy bill.
    const alerts = generateAlerts(
      baseProfile({
        gebruiksdoel: 'woonfunctie',
        warmtebehoefte_kwh_m2: 100,
        gebruiksoppervlakte_thermische_zone_m2: 120,
      })
    );
    const gasAlert = alerts.find((a) => a.includes('space-heating gas equivalent'));
    const m3 = Number(gasAlert?.match(/~(\d+) m³\/year/)?.[1]);
    expect(m3).toBeGreaterThan(1200);
    expect(m3).toBeLessThan(1600);
  });

  it('does not flag a date-only Geldig_tot as expired on its own valid-through day', () => {
    // A date-only value compared lex against new Date().toISOString() would be
    // shorter than "today-T..." and therefore marked expired. The Date-parsed
    // comparison treats it as midnight UTC of that day, so a far-future
    // date-only value is unambiguously valid.
    const farFutureDateOnly = '2099-12-31';
    const alerts = generateAlerts(
      baseProfile({ energielabel: 'C', label_geldig_tot: farFutureDateOnly })
    );
    expect(alerts.some((a) => a.includes('Energy label has expired'))).toBe(false);
  });
});

describe('overheating alert (computed: the bare value is misread)', () => {
  const base = { ...baseProfile, gebruiksdoel: 'woonfunctie' };

  it('states SIGNIFICANT above the 1.5 threshold, with the value', () => {
    const alerts = generateAlerts({ ...base, temperatuuroverschrijding: 3.59 });
    const a = alerts.find((x) => x.startsWith('Overheating risk:'));
    expect(a).toBeDefined();
    expect(a).toContain('SIGNIFICANT');
    expect(a).toContain('3.59');
    expect(a).toContain('above the 1.5 threshold');
  });

  it('names the two misreadings the eval actually observed', () => {
    const a = generateAlerts({ ...base, temperatuuroverschrijding: 3.59 }).find((x) =>
      x.startsWith('Overheating risk:')
    );
    expect(a).toContain('unitless');
    expect(a).toContain('not °C');
    expect(a).toContain('not hours');
  });

  it('says minor between 0 and 1.5, and none at 0', () => {
    expect(
      generateAlerts({ ...base, temperatuuroverschrijding: 1.2 }).find((x) =>
        x.startsWith('Overheating risk:')
      )
    ).toContain('minor');
    expect(
      generateAlerts({ ...base, temperatuuroverschrijding: 0 }).find((x) =>
        x.startsWith('Overheating risk:')
      )
    ).toContain('none');
  });

  it('is emitted for non-residential records too — the thresholds are not tenure-specific', () => {
    const alerts = generateAlerts({
      ...baseProfile,
      gebruiksdoel: 'kantoorfunctie',
      temperatuuroverschrijding: 2.4,
    });
    expect(alerts.find((x) => x.startsWith('Overheating risk:'))).toContain('SIGNIFICANT');
  });

  it('is absent when the field is null', () => {
    const alerts = generateAlerts({ ...base, temperatuuroverschrijding: null });
    expect(alerts.find((x) => x.startsWith('Overheating risk:'))).toBeUndefined();
  });
});
