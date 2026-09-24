/**
 * Computed values and record-conditional rules for get_building_profile (reference implementation).
 *
 * Rendered lines use the RENAMED field names (best-field-names.ts), because those are the names
 * the model sees. The rule shape, and why provenance is never serialized: best-rules.ts.
 *
 * Deliberately NOT carried over from the rich tier (generate-alerts.ts), each for a recorded
 * reason (docs/building-profile-findings.md §11):
 * - EP-1 vs Paris Proof 70/100 kWh/m² and "EP-1 > 150 = above benchmark": a CALCULATED figure
 *   against a target defined on MEASURED energy. No numeric Paris Proof threshold appears here.
 * - Bouwjaar-era warnings: judgment, not a determinate computation; era years unconfirmed.
 * - BAG-area fallback for totals: mixes scopes (up to 1.8×). Totals are null instead.
 */

import type { ProfileCore } from './generate-alerts.js';
import { buildingName, isNaderVoorschrift } from './best-field-names.js';
import type { Derived, Rule } from './best-rules.js';

/** 31.65 MJ/m³ (Dutch gas, lower heating value) ÷ 3.6 MJ/kWh. */
export const KWH_PER_M3_GAS = Math.round((31.65 / 3.6) * 100) / 100;
/** Seasonal efficiency of an HR boiler. */
export const HR_BOILER_EFFICIENCY = 0.95;
/** Heat-pump bands on warmtebehoefte (kWh/m²/yr): <50 very suitable, <70 suitable, <100 with upgrades, ≥100 insulate first. */
export const HEAT_PUMP_BOUNDARIES = [50, 70, 100] as const;
/** TOjuli/GTO: 0 none, ≤1.5 minor, >1.5 significant. */
export const OVERHEATING_SIGNIFICANT_ABOVE = 1.5;

export const BUILDING_CONSTANTS = {
  kwhPerM3Gas: KWH_PER_M3_GAS,
  gasMjPerM3: 31.65,
  hrBoilerEfficiency: HR_BOILER_EFFICIENCY,
  heatPumpBandBoundariesKwhM2: [...HEAT_PUMP_BOUNDARIES],
  overheatingSignificantAbove: OVERHEATING_SIGNIFICANT_ABOVE,
};

export type LabelMethod = 'NTA 8800' | 'NEN 7120' | 'Nader Voorschrift' | 'other';

export function labelMethod(berekeningstype: string | null): LabelMethod | null {
  if (!berekeningstype) return null;
  const t = berekeningstype.toLowerCase();
  if (t.includes('nta 8800')) return 'NTA 8800';
  if (t.includes('nen 7120') || t.includes('isso 75')) return 'NEN 7120';
  if (isNaderVoorschrift(berekeningstype)) return 'Nader Voorschrift';
  return 'other';
}

export interface HeatPumpBand {
  band: 'very suitable' | 'suitable' | 'suitable with insulation upgrades' | 'insulate first';
  warmtebehoefteKwhM2: number;
  nearestBoundaryKwhM2: number;
  distanceToBoundaryKwhM2: number;
  side: 'above' | 'below';
}

export interface OverheatingVerdict {
  level: 'none' | 'minor' | 'significant';
  indicator: number;
  significantAbove: number;
}

export interface BuildingDerived {
  totalCo2KgPerYear: Derived;
  spaceHeatingGasM3PerYear: Derived;
  heatPump: HeatPumpBand | { value: null; reason: string };
  overheatingRisk: OverheatingVerdict | { value: null; reason: string };
  thermalZoneToBagAreaRatio: Derived;
  buildingLevelAreaM2: Derived;
}

export interface BuildingCtx {
  p: ProfileCore;
  d: BuildingDerived;
  method: LabelMethod | null;
  hasLabel: boolean;
  isResidential: boolean;
}

const round = (x: number, dp = 0) => Math.round(x * 10 ** dp) / 10 ** dp;

export function isResidential(p: ProfileCore): boolean {
  if (p.gebouwklasse) return p.gebouwklasse === 'Woningbouw';
  return p.gebruiksdoel?.toLowerCase().includes('woonfunctie') ?? false;
}

export function heatPumpBand(wb: number): HeatPumpBand {
  const band: HeatPumpBand['band'] =
    wb < 50 ? 'very suitable' : wb < 70 ? 'suitable' : wb < 100 ? 'suitable with insulation upgrades' : 'insulate first';
  const nearest = [...HEAT_PUMP_BOUNDARIES].sort((a, b) => Math.abs(wb - a) - Math.abs(wb - b))[0];
  return {
    band,
    warmtebehoefteKwhM2: wb,
    nearestBoundaryKwhM2: nearest,
    distanceToBoundaryKwhM2: round(Math.abs(wb - nearest), 2),
    side: wb >= nearest ? 'above' : 'below',
  };
}

export function computeBuildingDerived(p: ProfileCore): BuildingDerived {
  const tz = p.gebruiksoppervlakte_thermische_zone_m2;
  const bag = p.oppervlakte_m2;
  const wb = p.warmtebehoefte_kwh_m2;
  const residential = isResidential(p);
  const hasLabel = p.energielabel !== null;
  const nv = isNaderVoorschrift(p.berekeningstype);

  const noLabel = { value: null, reason: 'no registered EP-Online label for this address' } as const;
  const noZone = {
    value: null,
    reason: 'no thermal-zone area registered; the BAG area is a different scope and is not used as a substitute',
  } as const;

  let totalCo2KgPerYear: Derived;
  if (!hasLabel) totalCo2KgPerYear = noLabel;
  else if (p.co2_emissie_kg_m2 === null) totalCo2KgPerYear = { value: null, reason: 'this label records no CO₂ figure' };
  else if (nv)
    totalCo2KgPerYear = {
      value: round(p.co2_emissie_kg_m2),
      unit: 'kg CO₂/year',
      basis: 'Nader Voorschrift reports the whole-building total directly',
      provenance: 'calculated',
    };
  else if (tz === null) totalCo2KgPerYear = noZone;
  else
    totalCo2KgPerYear = {
      value: round(p.co2_emissie_kg_m2 * tz),
      unit: 'kg CO₂/year',
      basis: `co2_emissie_berekend_kg_m2 ${p.co2_emissie_kg_m2} × gebruiksoppervlakte_thermische_zone_m2 ${tz}`,
      provenance: 'calculated',
    };

  let spaceHeatingGasM3PerYear: Derived;
  if (!hasLabel) spaceHeatingGasM3PerYear = noLabel;
  else if (!residential)
    spaceHeatingGasM3PerYear = {
      value: null,
      reason: 'computed for residential (Woningbouw) only; utility heating systems vary too much for a gas-boiler assumption',
    };
  else if (wb === null) spaceHeatingGasM3PerYear = { value: null, reason: 'warmtebehoefte is not produced by this label method' };
  else if (tz === null) spaceHeatingGasM3PerYear = noZone;
  else
    spaceHeatingGasM3PerYear = {
      value: round((wb * tz) / HR_BOILER_EFFICIENCY / KWH_PER_M3_GAS),
      unit: 'm³ gas/year, SPACE HEATING ONLY (excludes hot water and cooking)',
      basis: `warmtebehoefte ${wb} kWh/m² × thermal zone ${tz} m² ÷ ${HR_BOILER_EFFICIENCY} HR boiler ÷ ${KWH_PER_M3_GAS} kWh/m³`,
      provenance: 'calculated',
    };

  const heatPump: BuildingDerived['heatPump'] = !hasLabel
    ? noLabel
    : !residential
      ? { value: null, reason: 'band defined for residential (Woningbouw) only' }
      : wb === null
        ? { value: null, reason: 'warmtebehoefte is not produced by this label method' }
        : heatPumpBand(wb);

  const to = p.temperatuuroverschrijding;
  const overheatingRisk: BuildingDerived['overheatingRisk'] = !hasLabel
    ? noLabel
    : to === null
      ? { value: null, reason: 'this label method does not produce an overheating indicator' }
      : {
          level: to > OVERHEATING_SIGNIFICANT_ABOVE ? 'significant' : to > 0 ? 'minor' : 'none',
          indicator: to,
          significantAbove: OVERHEATING_SIGNIFICANT_ABOVE,
        };

  const thermalZoneToBagAreaRatio: Derived =
    tz !== null && bag !== null && bag > 0
      ? { value: round(tz / bag, 2), unit: 'ratio', basis: `${tz} m² thermal zone ÷ ${bag} m² BAG verblijfsobject`, provenance: 'calculated' }
      : { value: null, reason: 'needs both a thermal-zone area and a BAG area' };

  const n = p.aantal_verblijfsobjecten;
  const buildingLevelAreaM2: Derived =
    n !== null && n > 1
      ? { value: null, reason: `the BAG area is one verblijfsobject of ${n} in this pand; no building-level area is in this data` }
      : bag !== null
        ? { value: bag, unit: 'm²', basis: 'single-unit pand: the BAG verblijfsobject area is the building', provenance: 'register' }
        : { value: null, reason: 'no BAG area' };

  return { totalCo2KgPerYear, spaceHeatingGasM3PerYear, heatPump, overheatingRisk, thermalZoneToBagAreaRatio, buildingLevelAreaM2 };
}

export function buildingCtx(p: ProfileCore): BuildingCtx {
  return {
    p,
    d: computeBuildingDerived(p),
    method: labelMethod(p.berekeningstype),
    hasLabel: p.energielabel !== null,
    isResidential: isResidential(p),
  };
}

const N = (upstream: string, c: BuildingCtx) => buildingName(upstream, c.p);
const isValue = <T extends object>(x: T | { value: null; reason: string }): x is T =>
  !('value' in x && (x as { value: unknown }).value === null);

const ENERGY_FIELDS = [
  'ep1_energiebehoefte_kwh_m2',
  'ep2_fossiel_kwh_m2',
  'berekend_energieverbruik_kwh_m2',
  'warmtebehoefte_kwh_m2',
  'co2_emissie_kg_m2',
  'energie_index',
] as const;

export const BUILDING_RULES: readonly Rule<BuildingCtx>[] = [
  // ── branches ──────────────────────────────────────────────────────────────
  {
    id: 'bp.match.not_found',
    kind: 'branch',
    relates_to_fields: ['matchStatus'],
    applies: (c) => c.p.matchStatus === 'not_found',
    render: (c) =>
      `No BAG address found for ${c.p.adres}. EP-Online was NOT queried, so nothing is known about a label. Check the postcode (4 digits + 2 capitals, no space) and pass a letter as huisletter, not in huisnummer.`,
    provenance: '2026-04-13 · a missing address and a missing label are different branches; say which register was not queried · initial commit',
  },
  {
    id: 'bp.match.multiple',
    kind: 'branch',
    relates_to_fields: ['matchStatus', 'candidateCount', 'candidates'],
    applies: (c) => c.p.matchStatus === 'multiple_vbos',
    render: (c) =>
      `${c.p.candidateCount} verblijfsobjecten match this address; this profile is the FIRST of them. State that caveat, or retry with huisletter/toevoeging from \`candidates\`.`,
    provenance: '2026-04-13 · one address can hold several units; the profile shows the first · initial commit',
  },
  {
    id: 'bp.label.none',
    kind: 'branch',
    relates_to_fields: ['energielabel', 'labelCount'],
    applies: (c) => c.p.matchStatus !== 'not_found' && !c.hasLabel,
    render: () =>
      'EP-Online was queried and holds NO registered label for this address, so every energy field is null. No label is known: do not infer one from bouwjaar, age or building type.',
    provenance: '2026-04-13 · no registered label means unknown, not a label to infer from bouwjaar or type · evals/results/2026-09-22-q4-fact-vs-instruction.json',
  },
  {
    id: 'bp.area.one_unit',
    kind: 'branch',
    relates_to_fields: ['oppervlakte_bag_verblijfsobject_m2', 'aantal_verblijfsobjecten_in_pand'],
    applies: (c) => (c.p.aantal_verblijfsobjecten ?? 0) > 1,
    render: (c) =>
      `${N('oppervlakte_m2', c)} (${c.p.oppervlakte_m2} m²) is ONE verblijfsobject of ${c.p.aantal_verblijfsobjecten} in this pand, not the building. No building-level area is available from this tool.`,
    provenance: '2026-09-23 · every multi-unit pand has the one-unit scope problem, not only those above 10 units · docs/building-profile-findings.md §7',
  },
  {
    id: 'bp.vbo_status',
    kind: 'branch',
    relates_to_fields: ['vbo_status'],
    applies: (c) => !!c.p.vbo_status && !c.p.vbo_status.toLowerCase().includes('in gebruik'),
    render: (c) => `BAG status is "${c.p.vbo_status}": the unit may not be in use; check whether the analysis is relevant.`,
    provenance: '2026-04-13 · reason not recorded · initial commit',
  },
  // ── verdicts ──────────────────────────────────────────────────────────────
  {
    id: 'bp.overheating',
    kind: 'verdict',
    relates_to_fields: ['temperatuuroverschrijding_indicator_eenheidloos', 'derived.overheatingRisk'],
    applies: (c) => isValue(c.d.overheatingRisk),
    render: (c) => {
      const o = c.d.overheatingRisk as OverheatingVerdict;
      return `Overheating risk: ${o.level.toUpperCase()} — indicator ${o.indicator} (TOjuli/GTO, unitless; not °C, not hours). Thresholds: 0 none, up to ${o.significantAbove} minor, above ${o.significantAbove} significant.`;
    },
    provenance: '2026-09-22 · the bare index was read as hours or °C; the verdict in words removes that reading · evals/results/2026-09-22-overheating-alert-verification.json',
  },
  {
    id: 'bp.heat_pump',
    kind: 'verdict',
    relates_to_fields: ['warmtebehoefte_berekend_kwh_m2', 'gebouwklasse', 'gebruiksdoel', 'derived.heatPump'],
    applies: (c) => isValue(c.d.heatPump),
    render: (c) => {
      const h = c.d.heatPump as HeatPumpBand;
      return `Heat pump: ${h.band.toUpperCase()} — warmtebehoefte ${h.warmtebehoefteKwhM2} kWh/m² is ${h.distanceToBoundaryKwhM2} ${h.side} the ${h.nearestBoundaryKwhM2} band boundary (bands <50 very suitable, 50–70 suitable, 70–100 with insulation upgrades, ≥100 insulate first). State the margin when it is small.`;
    },
    provenance: '2026-04-13 · bands on warmtebehoefte; the margin to the nearest boundary says how firm the band is · evals/results/2026-09-24-q19-best-arm.json',
  },
  {
    id: 'bp.gas',
    kind: 'verdict',
    relates_to_fields: ['warmtebehoefte_berekend_kwh_m2', 'gebruiksoppervlakte_thermische_zone_m2', 'gebouwklasse', 'gebruiksdoel', 'derived.spaceHeatingGasM3PerYear'],
    applies: (c) => c.d.spaceHeatingGasM3PerYear.value !== null,
    render: (c) => {
      const g = c.d.spaceHeatingGasM3PerYear as Extract<Derived, { unit: string }>;
      return `Space-heating gas: ~${g.value} m³/year (${g.basis}). SPACE HEATING ONLY — hot water and cooking come on top, so a real gas bill is higher. Quote this figure; do not recompute it with another area or constant.`;
    },
    provenance: '2026-09-21 · the gas constant (8.79 kWh/m³) is not in the record, so the server computes the figure · evals/results/2026-09-21-readable-ladder-gas.json',
  },
  {
    id: 'bp.co2_total',
    kind: 'verdict',
    relates_to_fields: ['co2_emissie_berekend_kg_m2', 'co2_emissie_berekend_totaal_kg_jaar', 'derived.totalCo2KgPerYear'],
    applies: (c) => c.d.totalCo2KgPerYear.value !== null,
    render: (c) => {
      const t = c.d.totalCo2KgPerYear as Extract<Derived, { unit: string }>;
      return `Total calculated CO₂: ~${t.value} kg/year (${t.basis}). Calculated by the label method, not measured.`;
    },
    provenance: '2026-09-21 · a total needs the thermal-zone area; computed once, here · evals/results/2026-09-21-readable-ladder-co2.json',
  },
  {
    id: 'bp.label.expired',
    kind: 'verdict',
    relates_to_fields: ['label_geldig_tot'],
    applies: (c) => {
      if (!c.p.label_geldig_tot) return false;
      const t = new Date(c.p.label_geldig_tot).getTime();
      return Number.isFinite(t) && t < Date.now();
    },
    render: (c) => `The energy label expired on ${c.p.label_geldig_tot?.slice(0, 10)}; a new label (heropname) may be required.`,
    provenance: '2026-04-13 · compares dates, not strings (a date-only value sorts wrong as text) · initial commit',
  },
  {
    id: 'bp.beng',
    kind: 'verdict',
    relates_to_fields: ['eis_energiebehoefte_kwh_m2', 'eis_primaire_fossiele_energie_kwh_m2', 'eis_aandeel_hernieuwbare_energie_pct'],
    applies: (c) =>
      (c.p.eis_energiebehoefte_kwh_m2 !== null && c.p.ep1_energiebehoefte_kwh_m2 !== null) ||
      (c.p.eis_primaire_fossiele_energie_kwh_m2 !== null && c.p.ep2_fossiel_kwh_m2 !== null) ||
      (c.p.eis_aandeel_hernieuwbare_energie_pct !== null && c.p.aandeel_hernieuwbaar_pct !== null),
    render: (c) => {
      const parts: string[] = [];
      const p = c.p;
      if (p.eis_energiebehoefte_kwh_m2 !== null && p.ep1_energiebehoefte_kwh_m2 !== null)
        parts.push(`BENG-1 ${p.ep1_energiebehoefte_kwh_m2} vs max ${p.eis_energiebehoefte_kwh_m2} ${p.ep1_energiebehoefte_kwh_m2 <= p.eis_energiebehoefte_kwh_m2 ? 'PASS' : 'FAIL'}`);
      if (p.eis_primaire_fossiele_energie_kwh_m2 !== null && p.ep2_fossiel_kwh_m2 !== null)
        parts.push(`BENG-2 ${p.ep2_fossiel_kwh_m2} vs max ${p.eis_primaire_fossiele_energie_kwh_m2} ${p.ep2_fossiel_kwh_m2 <= p.eis_primaire_fossiele_energie_kwh_m2 ? 'PASS' : 'FAIL'}`);
      if (p.eis_aandeel_hernieuwbare_energie_pct !== null && p.aandeel_hernieuwbaar_pct !== null)
        parts.push(`BENG-3 ${p.aandeel_hernieuwbaar_pct}% vs min ${p.eis_aandeel_hernieuwbare_energie_pct}% ${p.aandeel_hernieuwbaar_pct >= p.eis_aandeel_hernieuwbare_energie_pct ? 'PASS' : 'FAIL'}`);
      return `BENG (legal limits of this new-build permit; calculated vs calculated, so the comparison is valid): ${parts.join('; ')}.`;
    },
    provenance: '2026-04-13 · both sides are calculated, so this comparison is valid, unlike Paris Proof · initial commit',
  },
  // ── null-notes: a DECISION field is null — never pruned ──
  {
    id: 'bp.null.warmtebehoefte',
    kind: 'null-note',
    relates_to_fields: ['warmtebehoefte_berekend_kwh_m2'],
    applies: (c) => c.hasLabel && c.p.warmtebehoefte_kwh_m2 === null,
    render: (c) =>
      `warmtebehoefte_berekend_kwh_m2 is null: the ${c.method ?? 'label'} method does not produce it. It is THE heat-pump sizing input. Do not substitute ${N('berekend_energieverbruik_kwh_m2', c)}, the label letter, energie_index or an assumed W/m²; say this data cannot size a heat pump (a heat-loss calculation or an NTA 8800 label can).`,
    provenance: '2026-09-22 · without this note, sizing questions got invented figures instead of "not in the data" · evals/results/2026-09-22-absent-sizing-input-haiku-n20.json',
  },
  {
    id: 'bp.null.temperatuuroverschrijding',
    kind: 'null-note',
    relates_to_fields: ['temperatuuroverschrijding_indicator_eenheidloos'],
    applies: (c) => c.hasLabel && c.p.temperatuuroverschrijding === null,
    render: (c) =>
      `temperatuuroverschrijding_indicator_eenheidloos is null: the ${c.method ?? 'label'} method does not produce it, so overheating risk cannot be assessed from this data.`,
    provenance: '2026-09-22 · null means the label method did not produce it, as for warmtebehoefte · evals/results/2026-09-22-absent-sizing-input-haiku-n20.json',
  },
  {
    id: 'bp.null.compactheid',
    kind: 'null-note',
    relates_to_fields: ['compactheid_als_ag_eenheidloos'],
    applies: (c) => c.hasLabel && c.p.compactheid === null,
    render: (c) => `compactheid_als_ag_eenheidloos is null: the ${c.method ?? 'label'} method does not produce it.`,
    provenance: '2026-09-22 · null means the label method did not produce it, as for warmtebehoefte · evals/results/2026-09-22-absent-sizing-input-haiku-n20.json',
  },
  {
    id: 'bp.null.thermal_zone',
    kind: 'null-note',
    relates_to_fields: ['gebruiksoppervlakte_thermische_zone_m2'],
    applies: (c) => c.hasLabel && c.p.gebruiksoppervlakte_thermische_zone_m2 === null && !isNaderVoorschrift(c.p.berekeningstype),
    render: (c) =>
      `No thermal-zone area is registered, so no totals are computed. Do not multiply per-m² label figures by ${N('oppervlakte_m2', c)}: it is a different scope.`,
    provenance: '2026-09-23 · a BAG-area fallback mixes scopes (up to 1.8×), so totals are null with a reason · docs/building-profile-findings.md §7',
  },
  // ── facts ─────────────────────────────────────────────────────────────────
  {
    id: 'bp.calc_vs_measured',
    kind: 'fact',
    relates_to_fields: [...ENERGY_FIELDS, 'aandeel_hernieuwbaar_pct', 'aandeel_hernieuwbaar_emg_forfaitair_pct'],
    applies: (c) => ENERGY_FIELDS.some((f) => c.p[f] !== null),
    render: (c) =>
      `CALCULATED vs MEASURED: every EP-Online energy figure here is CALCULATED by the ${c.method ?? 'label'} method, not a meter reading; nothing in this response is MEASURED. Paris Proof and other metered benchmarks are defined on MEASURED final energy, so none of these figures can be ranked against such a target — same unit, different quantity. Where a question asks for that comparison, say it cannot be made from this data and why, rather than producing a ratio.`,
    provenance: '2026-09-21 · label figures are calculated; Paris Proof and other benchmarks are defined on metered energy · evals/results/2026-09-21-benchmark-trap-calculated-vs-measured.json',
  },
  {
    id: 'bp.method.nta8800',
    kind: 'fact',
    relates_to_fields: ['berekeningstype', 'ep1_energiebehoefte_berekend_kwh_m2', 'ep2_primair_fossiel_berekend_kwh_m2', 'energie_index_berekend_eenheidloos'],
    applies: (c) => c.method === 'NTA 8800',
    render: () =>
      'NTA 8800 label: ep1 (net energy demand), ep2 (primary fossil energy), warmtebehoefte and co2 are per m² of gebruiksoppervlakte_thermische_zone_m2 per year; multiply by that area for totals. energie_index is not produced by this method.',
    provenance: '2026-04-13 · which fields are populated depends on the label method · docs/building-profile-findings.md §5',
  },
  {
    id: 'bp.method.nen7120',
    kind: 'fact',
    relates_to_fields: ['berekeningstype', 'energie_index_berekend_eenheidloos', 'energieverbruik_berekend_niet_gemeten_kwh_m2', 'sbi_sector_omschrijving'],
    applies: (c) => c.method === 'NEN 7120',
    render: () =>
      'NEN 7120 / ISSO 75.3 label: energie_index is the performance metric (below 1.2 ≈ A or better, 1.4–1.8 ≈ C, above 2.7 ≈ G). ep1, ep2, warmtebehoefte, temperatuuroverschrijding and compactheid are not produced. energieverbruik_berekend_niet_gemeten_kwh_m2 is inflated under this method (typically 200–1200+) and is not a benchmark.',
    provenance: '2026-04-13 · which fields are populated depends on the label method · docs/building-profile-findings.md §5',
  },
  {
    id: 'bp.method.nader',
    kind: 'fact',
    relates_to_fields: ['berekeningstype', 'co2_emissie_berekend_totaal_kg_jaar', 'energieverbruik_berekend_niet_gemeten_totaal_mj'],
    applies: (c) => c.method === 'Nader Voorschrift',
    render: () =>
      'Nader Voorschrift label: CO₂ and calculated energy use are WHOLE-BUILDING TOTALS (kg/year and MJ/year, hence the _totaal_ field names). Never divide or compare them per m². energie_index is the performance metric.',
    provenance: '2026-04-13 · under Nader Voorschrift co2 and berekend_energieverbruik are whole-building totals · docs/building-profile-findings.md §5',
  },
  {
    id: 'bp.area.scopes',
    kind: 'fact',
    relates_to_fields: ['oppervlakte_bag_verblijfsobject_m2', 'gebruiksoppervlakte_thermische_zone_m2', 'derived.thermalZoneToBagAreaRatio'],
    applies: (c) => c.d.thermalZoneToBagAreaRatio.value !== null,
    render: (c) =>
      `Two area scopes, not two measurements: ${N('oppervlakte_m2', c)} ${c.p.oppervlakte_m2} m² (BAG, one unit) vs gebruiksoppervlakte_thermische_zone_m2 ${c.p.gebruiksoppervlakte_thermische_zone_m2} m² (the zone the label covers; ${c.d.thermalZoneToBagAreaRatio.value}×). Per-m² label figures are per thermal-zone m².`,
    provenance: '2026-09-20 · thermal zone and BAG area are different scopes, not a fixed ratio (Mahlerlaan: 118,174 vs 66,581 m²) · docs/building-profile-findings.md §5',
  },
  {
    id: 'bp.referentiegebouw',
    kind: 'fact',
    relates_to_fields: ['op_basis_van_referentiegebouw'],
    applies: (c) => c.p.op_basis_van_referentiegebouw === true,
    render: () => 'This label is based on a reference-building calculation, not on this building itself: treat its figures as indicative.',
    provenance: '2026-04-13 · reason not recorded · initial commit',
  },
  {
    id: 'bp.bouwjaar.discrepancy',
    kind: 'fact',
    relates_to_fields: ['bouwjaar', 'ep_online_bouwjaar'],
    applies: (c) => c.p.bouwjaar !== null && c.p.ep_online_bouwjaar !== null && c.p.bouwjaar !== c.p.ep_online_bouwjaar,
    render: (c) => `Bouwjaar differs: BAG ${c.p.bouwjaar} vs EP-Online ${c.p.ep_online_bouwjaar} — possibly a renovation or a registration error.`,
    provenance: '2026-04-13 · reason not recorded · initial commit',
  },
  {
    id: 'bp.emg',
    kind: 'fact',
    relates_to_fields: ['ep2_primair_fossiel_emg_forfaitair_berekend_kwh_m2', 'ep2_primair_fossiel_berekend_kwh_m2'],
    applies: (c) => c.p.ep2_fossiel_emg_forfaitair_kwh_m2 !== null && c.p.ep2_fossiel_kwh_m2 !== null,
    render: () =>
      'The _emg_forfaitair_ variants recompute ep2 and the renewable share with standardised area-bound measures (district heating, collective WKO/PV); the difference can go either way.',
    provenance: '2026-04-13 · the EMG delta can go either way · initial commit',
  },
];

/**
 * Response fields no rule explains, on purpose: self-describing register facts (identity, address,
 * dates, the adviser's name). Checked 2026-09-24 with the field-reading probe
 * (evals/results/2026-09-24-field-probe-best.json). The coverage test fails when a new field is
 * neither explained by a rule nor listed here, so every field gets a decision.
 */
export const UNCOVERED_BY_DESIGN: Readonly<Record<string, string>> = {
  adres: 'formatted BAG address', gemeente: 'register fact', provincie: 'register fact',
  coordinaten: 'feeds get_weather_context; the join is in the description head',
  bag_vbo_id: 'identifier', bag_pand_id: 'identifier', pand_status: 'register status; vbo_status carries the in-use rule',
  soort_opname: 'label assessment type; no misreading observed', label_status: 'Bestaand/Nieuw; no misreading observed',
  label_opnamedatum: 'date', label_registratiedatum: 'date', gebouwtype: 'residential type; no misreading observed',
  gebouwsubtype: 'refinement of gebouwtype', certificaathouder: 'adviser name',
};
