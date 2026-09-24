/**
 * Field renames (reference implementation): upstream BAG / EP-Online / Open-Meteo name → a name
 * that cannot be misread.
 *
 * A field name is the one piece of meaning that reaches the model in every response on every host:
 * no description cut, no undelivered output schema, no pointer to follow. A readable name does the
 * work prose would do, and a name that implies a different quantity overrides the prose beside it.
 *
 * Policy (decided 2026-09-23): TARGETED, Dutch stays. Register terms users and experts search for
 * (bouwjaar, gebruiksdoel, energielabel, berekeningstype) are kept; only names that mislead, lack a
 * unit or scope, or hide calculated-vs-measured are renamed. Every row says why. A rename is a
 * change every consumer absorbs, so none without a reason and a provenance line (`hdd` is kept:
 * nothing showed it read as `weightedHdd`).
 *
 * `when: 'nader-voorschrift'` rows apply instead of the default row on records whose
 * berekeningstype is Nader Voorschrift, because that method reports WHOLE-BUILDING TOTALS where the
 * others report per-m² values: the same upstream field needs a different name per record for the
 * name to tell the truth about its unit.
 */

import type { ProfileCore } from './generate-alerts.js';

export interface FieldRename {
  upstream: string;
  name: string;
  when?: 'nader-voorschrift';
  reason: string;
  provenance: string;
}

export const BUILDING_FIELD_NAMES: readonly FieldRename[] = [
  {
    upstream: 'oppervlakte_m2',
    name: 'oppervlakte_bag_verblijfsobject_m2',
    reason: 'Scope. It is the BAG area of ONE verblijfsobject, not the building and not the zone the label covers (Mahlerlaan: 66,581 BAG vs 118,174 thermal zone).',
    provenance: '2026-09-23 · totals and building-size answers turn on this scope · evals/results/2026-09-23-rb3-ladder-words-uncut.json',
  },
  {
    upstream: 'aantal_verblijfsobjecten',
    name: 'aantal_verblijfsobjecten_in_pand',
    reason: 'Scope. Counts units in the whole pand, which is what makes the BAG area one unit of many.',
    provenance: '2026-09-23 · a small BAG area can be one unit of a large pand (IJburglaan 433: 1 of 106) · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'ep1_energiebehoefte_kwh_m2',
    name: 'ep1_energiebehoefte_berekend_kwh_m2',
    reason: 'Provenance. A calculated net demand; its unit matches metered benchmarks and its quantity does not.',
    provenance: '2026-09-21 · calculated demand gets ranked against metered targets unless it says so · evals/results/2026-09-21-benchmark-trap-calculated-vs-measured.json',
  },
  {
    upstream: 'ep2_fossiel_kwh_m2',
    name: 'ep2_primair_fossiel_berekend_kwh_m2',
    reason: 'Quantity + provenance. PRIMARY fossil energy, calculated — not final energy, not metered.',
    provenance: '2026-09-21 · same calculated-vs-metered risk as ep1 · evals/results/2026-09-21-benchmark-trap-calculated-vs-measured.json',
  },
  {
    upstream: 'aandeel_hernieuwbaar_pct',
    name: 'aandeel_hernieuwbare_energie_berekend_pct',
    reason: 'Magnet. The terse form (ahe) was read as heat demand; say what it is a share OF.',
    provenance: '2026-09-21 · the terse form was read as heat demand · evals/results/2026-09-21-opaque-live.json',
  },
  {
    upstream: 'co2_emissie_kg_m2',
    name: 'co2_emissie_berekend_kg_m2',
    reason: 'Provenance. Calculated emission per m² thermal zone per year (NTA 8800; NEN 7120 assumed the same, LOW confidence).',
    provenance: '2026-09-23 · totals multiply this by the thermal-zone area, so the name carries basis and provenance · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'co2_emissie_kg_m2',
    name: 'co2_emissie_berekend_totaal_kg_jaar',
    when: 'nader-voorschrift',
    reason: 'Unit. Under Nader Voorschrift the value is a WHOLE-BUILDING total in kg/year (3,000–5,000 for a 79 m² house); the upstream name says per m².',
    provenance: '2026-04-13 · the method reports a whole-building total, and the upstream name states the wrong unit · docs/building-profile-findings.md §5',
  },
  {
    upstream: 'berekend_energieverbruik_kwh_m2',
    name: 'energieverbruik_berekend_niet_gemeten_kwh_m2',
    reason: 'Reads as metered consumption, so it gets benchmarked against metered targets. The name says it is calculated.',
    provenance: '2026-09-21 · the upstream name reads as metered consumption · evals/README.md §2',
  },
  {
    upstream: 'berekend_energieverbruik_kwh_m2',
    name: 'energieverbruik_berekend_niet_gemeten_totaal_mj',
    when: 'nader-voorschrift',
    reason: 'Unit. Under Nader Voorschrift the value is MJ for the whole building (80,000–100,000), not kWh/m².',
    provenance: '2026-04-13 · the method reports MJ for the whole building, not kWh/m² · docs/building-profile-findings.md §5',
  },
  {
    upstream: 'warmtebehoefte_kwh_m2',
    name: 'warmtebehoefte_berekend_kwh_m2',
    reason: 'Provenance. Calculated net heat demand per m² thermal zone — the heat-pump sizing input.',
    provenance: '2026-09-23 · the gas estimate and heat-pump band derive from it, so the name carries provenance · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'temperatuuroverschrijding',
    name: 'temperatuuroverschrijding_indicator_eenheidloos',
    reason: 'Unit. Without one, 3.59 is read as hours/year, K, °C or %, which makes it sound negligible. It is a unitless index.',
    provenance: '2026-09-22 · a unit gets invented for the bare value, which makes it sound negligible · evals/results/2026-09-22-q6-overheating-naming.json',
  },
  {
    upstream: 'compactheid',
    name: 'compactheid_als_ag_eenheidloos',
    reason: 'Unit + definition. A ratio of loss surface to usable area (Als/Ag), no unit.',
    provenance: '2026-09-23 · same unitless-name risk as temperatuuroverschrijding · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'energie_index',
    name: 'energie_index_berekend_eenheidloos',
    reason: 'Provenance + unit. A calculated, unitless index from pre-NTA 8800 methods.',
    provenance: '2026-09-23 · a calculated index with no unit; the name says both · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'ep2_fossiel_emg_forfaitair_kwh_m2',
    name: 'ep2_primair_fossiel_emg_forfaitair_berekend_kwh_m2',
    reason: 'Same quantity as ep2 under standardised area-bound measures; keep the pair consistent.',
    provenance: '2026-09-23 · consistency with the ep2 rename · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'aandeel_hernieuwbaar_emg_forfaitair_pct',
    name: 'aandeel_hernieuwbare_energie_emg_forfaitair_berekend_pct',
    reason: 'Consistency with the renewable-share rename.',
    provenance: '2026-09-23 · consistency with the renewable-share rename · docs/building-profile-findings.md §11',
  },
  {
    upstream: 'sbi_code',
    name: 'sbi_sector_omschrijving',
    reason: 'Misleading. It is a full-text sector description, NOT a numeric SBI code.',
    provenance: '2026-04-13 · the value is a sector text, not a numeric SBI code · docs/building-profile-findings.md §5',
  },
];

export function isNaderVoorschrift(berekeningstype: string | null): boolean {
  return berekeningstype?.toLowerCase().includes('nader voorschrift') ?? false;
}

/** The response name of an upstream building field for THIS record. */
export function buildingName(upstream: string, profile: Pick<ProfileCore, 'berekeningstype'>): string {
  const nv = isNaderVoorschrift(profile.berekeningstype);
  const rows = BUILDING_FIELD_NAMES.filter((r) => r.upstream === upstream);
  const pick = (nv && rows.find((r) => r.when === 'nader-voorschrift')) || rows.find((r) => r.when === undefined);
  return pick ? pick.name : upstream;
}

/** Rename every profile field for this record, preserving key order. */
export function renameBuildingProfile(profile: ProfileCore): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) out[buildingName(key, profile)] = value;
  return out;
}

/** Every name a building response can carry (both unit variants), for schema + tests. */
export function allBuildingResponseNames(profileKeys: readonly string[]): string[] {
  const names = new Set<string>();
  for (const key of profileKeys) {
    const rows = BUILDING_FIELD_NAMES.filter((r) => r.upstream === key);
    if (rows.length === 0) names.add(key);
    for (const r of rows) names.add(r.name);
  }
  return [...names];
}

export const WEATHER_FIELD_NAMES: readonly FieldRename[] = [
  {
    upstream: 'gasNormalizationFactor',
    name: 'fullYearGasNormalizationFactor',
    reason: 'Validity in the name. 2800 is an ANNUAL reference; dividing it by a quarter\'s degree days gives 2.53, the single-quarter trap. It is also null for any window that is not 12 whole months.',
    provenance: '2026-09-23 · the factor is only valid for a full year; applied to a quarter it gives 2.53 · evals/results/2026-09-23-q12b-weather-single-quarter.json',
  },
];
