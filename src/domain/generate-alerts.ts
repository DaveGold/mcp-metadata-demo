/**
 * Domain post-processing: turn a BuildingProfile into human-readable alerts.
 *
 * This is where generic upstream data becomes actionable advice:
 *   - "Pre-Bouwbesluit 1992 — likely limited insulation"
 *   - BENG compliance pass/fail summary
 *   - Heat-pump suitability indicator (residential only)
 *
 * Why this lives in the tool (not the agent): these rules depend on
 * non-obvious knowledge of Dutch building regulation eras, unit quirks in
 * different label calculation methods (NTA 8800 vs Nader Voorschrift), and
 * gas-to-kWh conversion factors. Putting them in the server means every agent
 * gets them for free — no prompt engineering required on the caller side.
 */

import type { BuildingProfile } from '../tools/get-building-profile.js';

/**
 * Energy content of one m³ of Dutch natural gas, in kWh.
 *
 * The figure usually quoted is 31.65 MJ/m³ (onderwaarde / lower heating value).
 * Heat demand arrives here in kWh, so the MJ figure must be converted before it
 * can be used as a divisor: 31.65 / 3.6 = 8.79 kWh/m³. Dividing kWh by 31.65
 * directly understates gas use by exactly 3.6x.
 */
const KWH_PER_M3_GAS = 31.65 / 3.6;

/** Seasonal efficiency of an HR (high-efficiency) boiler. */
const HR_BOILER_EFFICIENCY = 0.95;

/**
 * The floor area an NTA 8800 per-m² value is expressed against.
 *
 * warmtebehoefte, EP-1/EP-2 and co2_emissie are all per m² of the EP-Online
 * thermal-zone area (gebruiksoppervlakte), NOT the BAG gross area of the
 * verblijfsobject. The two differ — usually the EP-Online figure is lower, but
 * for one VBO of a large pand it can be far higher — so multiplying an NTA
 * per-m² value by the BAG area silently mixes two scopes.
 *
 * BAG area is the fallback only, for profiles EP-Online has no thermal zone for.
 * The source is reported in the alert so the reader can see which was used.
 */
function benchmarkArea(
  profile: ProfileCore
): { m2: number; source: 'EP-Online thermische zone' | 'BAG' } | null {
  if (profile.gebruiksoppervlakte_thermische_zone_m2 !== null) {
    return { m2: profile.gebruiksoppervlakte_thermische_zone_m2, source: 'EP-Online thermische zone' };
  }
  if (profile.oppervlakte_m2 !== null) {
    return { m2: profile.oppervlakte_m2, source: 'BAG' };
  }
  return null;
}

/** Profile shape without the alerts array it will be merged into. */
export type ProfileCore = Omit<BuildingProfile, 'alerts'>;

export function generateAlerts(profile: ProfileCore): string[] {
  const alerts: string[] = [];

  if (profile.matchStatus === 'multiple_vbos') {
    alerts.push(
      `Multiple verblijfsobjecten (${profile.candidateCount}) at this address — profile shown is the first match. Specify huisletter/toevoeging for an exact match.`
    );
  }

  // Large multi-unit building: oppervlakte_m2 is just one VBO, not the total building
  if (profile.aantal_verblijfsobjecten !== null && profile.aantal_verblijfsobjecten > 10) {
    alerts.push(
      `Large pand with ${profile.aantal_verblijfsobjecten} verblijfsobjecten — oppervlakte_m2 (${profile.oppervlakte_m2} m²) is only one VBO, not the total building. Use bouwjaar and energielabel for quality analysis; do NOT use oppervlakte_m2 as a benchmark denominator.`
    );
  }

  if (profile.bouwjaar !== null) {
    // Suppress era alerts when the label already proves good performance
    const goodLabel =
      profile.energielabel !== null &&
      ['A++++', 'A+++', 'A++', 'A+', 'A'].includes(profile.energielabel);

    if (!goodLabel) {
      if (profile.bouwjaar < 1992) {
        alerts.push('Pre-Bouwbesluit 1992 — likely limited insulation.');
      } else if (profile.bouwjaar < 2003) {
        alerts.push('Pre-EPC — insulation likely below current norm.');
      } else if (profile.bouwjaar < 2015) {
        alerts.push('Pre-BENG — moderate energy performance expected.');
      }
    }
  }

  if (profile.energielabel) {
    const letter = profile.energielabel.replace(/\+/g, '');
    if (
      ['D', 'E', 'F', 'G'].includes(letter) &&
      profile.gebruiksdoel?.toLowerCase().includes('kantoor')
    ) {
      alerts.push('Possibly Label-C relevant — verify whether office share >50% and area >100m².');
    }
  }

  // REMOVED 2026-09-24: an EP-1 vs Paris Proof alert ("EP-1 above Paris Proof 2040 target
  // (70 kWh/m² for offices / 100 residential)") and an "EP-1 > 150 = well above benchmark" alert.
  // EP-1 is the CALCULATED NTA 8800 net energy demand; Paris Proof is defined on MEASURED final
  // energy use at the meter — same unit, different quantity — and the 150 had no source. As a
  // computed verdict it was repeated by the models: benchmark-trap rich 0/20 (haiku), 0/10
  // (sonnet), 6/10 (opus) in evals/results/2026-09-24-q19-best-arm.json. Fix measured as Q20.
  // Do not reintroduce a numeric benchmark comparison for calculated label figures.

  if (profile.label_geldig_tot) {
    // Parse as Date — string compare would treat "2026-04-13" as earlier than
    // "2026-04-13T20:00:00.000Z" on its own valid-through day (different length
    // pads null), which would wrongly mark a still-valid label expired.
    const expiry = new Date(profile.label_geldig_tot).getTime();
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      alerts.push('Energy label has expired — re-inspection may be required.');
    }
  }

  // Only emit this alert when EP-Online was actually queried. In the not_found
  // branch we short-circuit after BAG, so a missing label is "never looked up",
  // not "looked up and not there" — conflating the two would mislead the agent.
  if (!profile.energielabel && profile.matchStatus !== 'not_found') {
    alerts.push('No registered energy label found in EP-Online.');
  }

  if (profile.vbo_status && !profile.vbo_status.toLowerCase().includes('in gebruik')) {
    alerts.push(
      `VBO status: "${profile.vbo_status}" — building may not be in use. Check whether the analysis is relevant.`
    );
  }

  // BENG compliance summary (only when eisen are available — new-build permits)
  const hasBengEisen =
    profile.eis_energiebehoefte_kwh_m2 !== null ||
    profile.eis_primaire_fossiele_energie_kwh_m2 !== null ||
    profile.eis_aandeel_hernieuwbare_energie_pct !== null;

  if (hasBengEisen) {
    const lines: string[] = ['BENG compliance:'];

    if (profile.eis_energiebehoefte_kwh_m2 !== null && profile.ep1_energiebehoefte_kwh_m2 !== null) {
      const pass = profile.ep1_energiebehoefte_kwh_m2 <= profile.eis_energiebehoefte_kwh_m2;
      lines.push(
        `  BENG-1 Energy demand: ${profile.ep1_energiebehoefte_kwh_m2} kWh/m² (max ${profile.eis_energiebehoefte_kwh_m2}) ${pass ? '✓' : '✗ EXCEEDED'}`
      );
    }

    if (
      profile.eis_primaire_fossiele_energie_kwh_m2 !== null &&
      profile.ep2_fossiel_kwh_m2 !== null
    ) {
      const pass = profile.ep2_fossiel_kwh_m2 <= profile.eis_primaire_fossiele_energie_kwh_m2;
      lines.push(
        `  BENG-2 Fossil energy use: ${profile.ep2_fossiel_kwh_m2} kWh/m² (max ${profile.eis_primaire_fossiele_energie_kwh_m2}) ${pass ? '✓' : '✗ EXCEEDED'}`
      );
    }

    if (
      profile.eis_aandeel_hernieuwbare_energie_pct !== null &&
      profile.aandeel_hernieuwbaar_pct !== null
    ) {
      const pass =
        profile.aandeel_hernieuwbaar_pct >= profile.eis_aandeel_hernieuwbare_energie_pct;
      lines.push(
        `  BENG-3 Renewable energy share: ${profile.aandeel_hernieuwbaar_pct}% (min ${profile.eis_aandeel_hernieuwbare_energie_pct}%) ${pass ? '✓' : '✗ NOT MET'}`
      );
    }

    alerts.push(lines.join('\n'));
  }

  // Bouwjaar cross-check between BAG and EP-Online
  if (
    profile.bouwjaar !== null &&
    profile.ep_online_bouwjaar !== null &&
    profile.bouwjaar !== profile.ep_online_bouwjaar
  ) {
    alerts.push(
      `Bouwjaar discrepancy: BAG ${profile.bouwjaar} vs EP-Online ${profile.ep_online_bouwjaar} — possible renovation or registration error.`
    );
  }

  // District heating / EMG forfaitair insight
  if (profile.ep2_fossiel_emg_forfaitair_kwh_m2 !== null && profile.ep2_fossiel_kwh_m2 !== null) {
    const delta = profile.ep2_fossiel_kwh_m2 - profile.ep2_fossiel_emg_forfaitair_kwh_m2;
    if (delta > 5) {
      alerts.push(
        `Area-bound measure (district heating / WKO / collective PV) lowers EP-2 by ${Math.round(delta)} kWh/m².`
      );
    }
  }

  // Overheating risk — computed, not left to the reader.
  //
  // WHY THIS IS COMPUTED RATHER THAN DESCRIBED. The interpretation block already
  // states the thresholds ("0 = no risk, 0-1.5 = minor risk, >1.5 = significant"),
  // and evals/results/2026-09-22-q6-overheating-naming.json shows that is not
  // enough: across three arms and 21 runs on a record with temperatuuroverschrijding
  // 3.59, only 2 answers were correct. Models read 3.59 as degrees ("below the
  // typical 5-6 C threshold") or as hours per year ("well below the 40-hour
  // standard") and conclude the risk is low. Renaming does not help — the arm with
  // a neutral field name AND an explicit "unitless" glossary scored 0 of 7.
  //
  // So the verdict is stated here, in words, the same way the gas figure and the
  // heat-pump indicatie are. The "not °C, not hours" clause is not padding: those
  // are the two misreadings actually observed.
  //
  // Applies to any record carrying the field, not residential only — the NTA 8800
  // thresholds are not tenure-specific.
  if (profile.temperatuuroverschrijding !== null) {
    const to = profile.temperatuuroverschrijding;
    const verdict =
      to > 1.5
        ? `SIGNIFICANT — ${to} is above the 1.5 threshold`
        : to > 0
          ? `minor — ${to} is between 0 and the 1.5 threshold`
          : `none — ${to}`;
    alerts.push(
      `Overheating risk: ${verdict} (TOjuli/GTO). This is a unitless index — not °C and not hours per year. Relevant for cooling load and heat pump sizing.`
    );
  }

  // Residential-specific consumer insights (only for woning use)
  const isWoning = profile.gebruiksdoel?.toLowerCase().includes('woonfunctie');
  if (isWoning) {
    const area = benchmarkArea(profile);

    if (profile.warmtebehoefte_kwh_m2 !== null && area !== null) {
      const heatDemandKwh = profile.warmtebehoefte_kwh_m2 * area.m2;
      const gasM3 = Math.round(heatDemandKwh / HR_BOILER_EFFICIENCY / KWH_PER_M3_GAS);
      alerts.push(
        `Estimated space-heating gas equivalent: ~${gasM3} m³/year (warmtebehoefte ${profile.warmtebehoefte_kwh_m2} kWh/m² × ${area.m2} m² ${area.source}, HR boiler 95%). SPACE HEATING ONLY — excludes hot water and cooking, so an actual gas bill will be higher.`
      );
    }

    if (profile.co2_emissie_kg_m2 !== null) {
      const isNaderVoorschrift =
        profile.berekeningstype?.toLowerCase().includes('nader voorschrift') ?? false;
      if (isNaderVoorschrift) {
        // Nader Voorschrift: co2_emissie is already a total (kg/year), not per m²
        const totalCo2 = Math.round(profile.co2_emissie_kg_m2);
        alerts.push(
          `Total CO₂ emissions: ~${totalCo2} kg/year (Nader Voorschrift — value is whole-building total).`
        );
      } else if (area !== null) {
        const totalCo2 = Math.round(profile.co2_emissie_kg_m2 * area.m2);
        alerts.push(
          `Total CO₂ emissions: ~${totalCo2} kg/year (${profile.co2_emissie_kg_m2} kg/m² × ${area.m2} m² ${area.source}).`
        );
      }
    }

    if (profile.warmtebehoefte_kwh_m2 !== null) {
      const wb = profile.warmtebehoefte_kwh_m2;
      const indicatie =
        wb < 50
          ? 'very suitable for a heat pump'
          : wb < 70
            ? 'suitable for a heat pump'
            : wb < 100
              ? 'suitable for a heat pump provided some insulation upgrades'
              : 'insulate first before considering a heat pump';
      alerts.push(`Heat-pump suitability: ${indicatie} (warmtebehoefte ${wb} kWh/m²).`);
    }
  }

  return alerts;
}
