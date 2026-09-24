/**
 * Field renames for the `best` arm: upstream (BAG / EP-Online / Open-Meteo derived) name
 * → a name that cannot be misread.
 *
 * Field names are the only semantics that reach the model in every response on every
 * host — no 2,048-char description cut, no output-schema loss, no pointer to follow.
 * The eval set shows both directions (skill references/evidence.md, N1–N8):
 * readable names do the work prose would do, and a readable name that implies a
 * different quantity overrides the prose beside it.
 *
 * Policy (user decision 2026-09-23): TARGETED, Dutch stays. Register terms users and
 * experts search for (bouwjaar, gebruiksdoel, energielabel, berekeningstype) are kept;
 * only names that mislead, lack a unit or scope, or hide calculated-vs-measured are
 * renamed. Every row says why. Do not add a rename without a reason and a provenance
 * line — a rename is a change every consumer has to absorb (N8: `hdd` was NOT renamed,
 * because Q11 measured no confusion with `weightedHdd`).
 *
 * `when: 'nader-voorschrift'` rows apply instead of the default row on records whose
 * berekeningstype is Nader Voorschrift, because that method reports WHOLE-BUILDING
 * TOTALS where the others report per-m² values: the same upstream field needs a
 * different name per record for the name to tell the truth about its unit.
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
    provenance: '2026-09-23 best audit; total-vs-per-m2 and building-size questions (evals/questions.json) turn on this scope; RB3 schema 1/10 vs uncut words 10/10 on the scope sentence.',
  },
  {
    upstream: 'aantal_verblijfsobjecten',
    name: 'aantal_verblijfsobjecten_in_pand',
    reason: 'Scope. Counts units in the whole pand, which is what makes the BAG area one unit of many.',
    provenance: '2026-09-23 best audit; building-size question (IJburglaan 433: 41 m² is 1 of 106).',
  },
  {
    upstream: 'ep1_energiebehoefte_kwh_m2',
    name: 'ep1_energiebehoefte_berekend_kwh_m2',
    reason: 'Provenance. A calculated net demand; its unit matches metered benchmarks and its quantity does not.',
    provenance: '2026-09-21 benchmark-trap 0/60 → 59/60 once CALCULATED vs MEASURED was stated; the rich arm still alerts EP-1 vs Paris Proof (generate-alerts.ts:102-115).',
  },
  {
    upstream: 'ep2_fossiel_kwh_m2',
    name: 'ep2_primair_fossiel_berekend_kwh_m2',
    reason: 'Quantity + provenance. PRIMARY fossil energy, calculated — not final energy, not metered.',
    provenance: '2026-09-21 benchmark-trap (hardened on ep2 179.06 vs the 70 kWh/m² office target).',
  },
  {
    upstream: 'aandeel_hernieuwbaar_pct',
    name: 'aandeel_hernieuwbare_energie_berekend_pct',
    reason: 'Magnet. The terse form (ahe) was read as heat demand; say what it is a share OF.',
    provenance: '2026-09-21 opaque-live: ahe anchored as heat demand in 6/6 haiku runs (N4).',
  },
  {
    upstream: 'co2_emissie_kg_m2',
    name: 'co2_emissie_berekend_kg_m2',
    reason: 'Provenance. Calculated emission per m² thermal zone per year (NTA 8800; NEN 7120 assumed the same, LOW confidence).',
    provenance: '2026-09-23 best audit; total-vs-per-m2 question multiplies this by the thermal-zone area.',
  },
  {
    upstream: 'co2_emissie_kg_m2',
    name: 'co2_emissie_berekend_totaal_kg_jaar',
    when: 'nader-voorschrift',
    reason: 'Unit. Under Nader Voorschrift the value is a WHOLE-BUILDING total in kg/year (3,000–5,000 for a 79 m² house); the upstream name says per m².',
    provenance: '2026-04-13 interpretation block already warned; 2026-09-23 audit: a name that states the wrong unit overrides that warning (N2).',
  },
  {
    upstream: 'berekend_energieverbruik_kwh_m2',
    name: 'energieverbruik_berekend_niet_gemeten_kwh_m2',
    reason: 'Reads as metered consumption. Models benchmarked it against real-world targets despite the prose; renamed to a code, they read the guide and declined.',
    provenance: 'evals/README.md §2 (payload-in-prompt, small n); metered-vs-model and absent-sizing-input questions both lean on it.',
  },
  {
    upstream: 'berekend_energieverbruik_kwh_m2',
    name: 'energieverbruik_berekend_niet_gemeten_totaal_mj',
    when: 'nader-voorschrift',
    reason: 'Unit. Under Nader Voorschrift the value is MJ for the whole building (80,000–100,000), not kWh/m².',
    provenance: '2026-04-13 interpretation block warned ("CRITICAL … DIFFERENT UNITS"); 2026-09-23 audit moved the unit into the name.',
  },
  {
    upstream: 'warmtebehoefte_kwh_m2',
    name: 'warmtebehoefte_berekend_kwh_m2',
    reason: 'Provenance. Calculated net heat demand per m² thermal zone — the heat-pump sizing input.',
    provenance: '2026-09-23 best audit; gas-estimate and heat-pump-triage derive from it.',
  },
  {
    upstream: 'temperatuuroverschrijding',
    name: 'temperatuuroverschrijding_indicator_eenheidloos',
    reason: 'Unit. Unitless readable name got a unit invented for it (3.59 read as hours/year, K, °C, %), which made it sound negligible.',
    provenance: '2026-09-22 Q6 and Q14 (words invented a unit 20/20); RB2: delivering the "unitless" glossary fixed it 20/20 — the name now carries it everywhere.',
  },
  {
    upstream: 'compactheid',
    name: 'compactheid_als_ag_eenheidloos',
    reason: 'Unit + definition. A ratio of loss surface to usable area (Als/Ag), no unit.',
    provenance: '2026-09-23 best audit (same unitless-name risk as N5); not separately measured.',
  },
  {
    upstream: 'energie_index',
    name: 'energie_index_berekend_eenheidloos',
    reason: 'Provenance + unit. A calculated, unitless index from pre-NTA 8800 methods.',
    provenance: '2026-09-23 best audit; not separately measured.',
  },
  {
    upstream: 'ep2_fossiel_emg_forfaitair_kwh_m2',
    name: 'ep2_primair_fossiel_emg_forfaitair_berekend_kwh_m2',
    reason: 'Same quantity as ep2 under standardised area-bound measures; keep the pair consistent.',
    provenance: '2026-09-23 best audit; consistency with ep2 rename.',
  },
  {
    upstream: 'aandeel_hernieuwbaar_emg_forfaitair_pct',
    name: 'aandeel_hernieuwbare_energie_emg_forfaitair_berekend_pct',
    reason: 'Consistency with the renewable-share rename.',
    provenance: '2026-09-23 best audit; consistency.',
  },
  {
    upstream: 'sbi_code',
    name: 'sbi_sector_omschrijving',
    reason: 'Misleading. It is a full-text sector description, NOT a numeric SBI code.',
    provenance: '2026-04-13 interpretation block already warned "NOT a numeric SBI code"; 2026-09-23 audit moved it into the name.',
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
    reason: 'Validity in the name. 2800 is an ANNUAL reference; dividing it by a quarter\'s degree days gives 2.53, the single-quarter trap. The best arm also returns it as null for any window that is not 12 whole months.',
    provenance: '2026-09-23 Q12b: with no rule, 16/20 runs took the factor road on one quarter; Q16: rule + shipped reference data 15/20. The rename itself is not separately measured.',
  },
];
