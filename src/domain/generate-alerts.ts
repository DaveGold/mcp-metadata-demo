/**
 * Domain post-processing: turn a BuildingProfile into human-readable alerts.
 *
 * This is where generic upstream data becomes actionable advice:
 *   - "Pre-Bouwbesluit 1992 — likely limited insulation"
 *   - "EP-1 above Paris Proof 2040 target (70 kWh/m² for offices)"
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

  if (profile.ep1_energiebehoefte_kwh_m2 !== null) {
    if (profile.ep1_energiebehoefte_kwh_m2 > 150) {
      alerts.push('EP-1 well above benchmark (>150 kWh/m²) — large savings potential.');
    } else {
      const isResidential = profile.gebouwklasse === 'Woningbouw';
      const isOffice = profile.gebruiksdoel?.toLowerCase().includes('kantoorfunctie') ?? false;

      if (isResidential && profile.ep1_energiebehoefte_kwh_m2 > 100) {
        alerts.push('EP-1 above Paris Proof 2040 target (100 kWh/m² for residential).');
      } else if (isOffice && profile.ep1_energiebehoefte_kwh_m2 > 70) {
        alerts.push('EP-1 above Paris Proof 2040 target (70 kWh/m² for offices).');
      }
    }
  }

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

  // Residential-specific consumer insights (only for woning use)
  const isWoning = profile.gebruiksdoel?.toLowerCase().includes('woonfunctie');
  if (isWoning) {
    if (profile.warmtebehoefte_kwh_m2 !== null && profile.oppervlakte_m2 !== null) {
      const gasM3 = Math.round((profile.warmtebehoefte_kwh_m2 * profile.oppervlakte_m2) / 31.65 / 0.95);
      alerts.push(
        `Estimated gas use: ~${gasM3} m³/year (based on warmtebehoefte ${profile.warmtebehoefte_kwh_m2} kWh/m², area ${profile.oppervlakte_m2} m², HR boiler 95%).`
      );
    }

    if (profile.co2_emissie_kg_m2 !== null && profile.oppervlakte_m2 !== null) {
      const isNaderVoorschrift =
        profile.berekeningstype?.toLowerCase().includes('nader voorschrift') ?? false;
      if (isNaderVoorschrift) {
        // Nader Voorschrift: co2_emissie is already a total (kg/year), not per m²
        const totalCo2 = Math.round(profile.co2_emissie_kg_m2);
        alerts.push(
          `Total CO₂ emissions: ~${totalCo2} kg/year (Nader Voorschrift — value is whole-building total).`
        );
      } else {
        const totalCo2 = Math.round(profile.co2_emissie_kg_m2 * profile.oppervlakte_m2);
        alerts.push(
          `Total CO₂ emissions: ~${totalCo2} kg/year (${profile.co2_emissie_kg_m2} kg/m² × ${profile.oppervlakte_m2} m²).`
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
