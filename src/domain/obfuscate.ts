/**
 * EVAL ARM — not example code. It exists to measure one variable against the others (evals/).
 * The reference implementation is src/tools/get-building-profile-best.ts.
 *
 * Field-name obfuscation for the `opaque` arms of the ablation.
 *
 * WHY THIS EXISTS
 * The thin arm was never metadata-free. It strips descriptions, schemas and
 * alerts, but it still returns the SAME field names as the rich arm —
 * `gebruiksoppervlakte_thermische_zone_m2`, `berekeningstype`,
 * `aantal_verblijfsobjecten`. Those names are themselves the most valuable
 * metadata intervention there is, and a capable model reads straight through
 * them: in testing it inferred from `berekeningstype: "NEN 7120"` that the
 * method does not populate warmtebehoefte, with no prose at all.
 *
 * That makes the thin arm a strawman that is accidentally too strong, and it
 * means A→B cannot measure what interpretation guidance buys — the naming has
 * already done the job the prose would have done.
 *
 * A real legacy API does not look like this. It returns `EP1`, `VBO_OPP`,
 * `BER_TYPE`, a numeric status code and no units anywhere. These arms restore
 * that, so that `opaque` versus `opaque + prose` isolates the guidance itself.
 *
 * Keep the codes terse, unitless and unhelpful on purpose. Any readable name
 * added here weakens the control.
 */

import type { BuildingProfile } from '../tools/get-building-profile.js';

type ProfileCore = Omit<BuildingProfile, 'alerts'>;

/** Readable field -> the terse code a legacy register would actually emit. */
export const FIELD_MAP: Record<string, string> = {
  matchStatus: 'st',
  candidateCount: 'n_c',
  labelCount: 'n_l',
  adres: 'adr',
  gemeente: 'gem',
  provincie: 'prv',
  oppervlakte_m2: 'opp',
  gebruiksdoel: 'gbd',
  coordinaten: 'crd',
  bag_vbo_id: 'vbo',
  vbo_status: 'vbo_st',
  bouwjaar: 'bj',
  pand_status: 'pnd_st',
  aantal_verblijfsobjecten: 'n_vbo',
  bag_pand_id: 'pnd',
  energielabel: 'lbl',
  ep1_energiebehoefte_kwh_m2: 'ep1',
  ep2_fossiel_kwh_m2: 'ep2',
  aandeel_hernieuwbaar_pct: 'ahe',
  co2_emissie_kg_m2: 'co2',
  berekend_energieverbruik_kwh_m2: 'bev',
  warmtebehoefte_kwh_m2: 'wb',
  temperatuuroverschrijding: 'to',
  compactheid: 'cmp',
  gebruiksoppervlakte_thermische_zone_m2: 'f_ga',
  gebouwklasse: 'gk',
  soort_opname: 'so',
  berekeningstype: 'calc_t',
  label_status: 'lbl_st',
  op_basis_van_referentiegebouw: 'ref',
  label_geldig_tot: 'dt_g',
  label_opnamedatum: 'dt_o',
  label_registratiedatum: 'dt_r',
  gebouwtype: 'gt',
  gebouwsubtype: 'gst',
  sbi_code: 'sbi',
  energie_index: 'ei',
  ep2_fossiel_emg_forfaitair_kwh_m2: 'ep2f',
  aandeel_hernieuwbaar_emg_forfaitair_pct: 'ahef',
  eis_energiebehoefte_kwh_m2: 'e1',
  eis_primaire_fossiele_energie_kwh_m2: 'e2',
  eis_aandeel_hernieuwbare_energie_pct: 'e3',
  certificaathouder: 'cert',
  ep_online_bouwjaar: 'bj_ep',
};

/** matchStatus is an enum whose VALUES are self-describing too — so those go as well. */
export const STATUS_MAP: Record<string, number> = {
  not_found: 0,
  exact: 1,
  multiple_vbos: 2,
};

/**
 * Project a profile onto the opaque shape: renamed keys, numeric status, and
 * coordinates reduced to bare x/y. The VALUES are otherwise untouched — this
 * arm must return the same data as every other, or it stops being an ablation.
 */
export function obfuscateProfile(profile: ProfileCore): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [readable, code] of Object.entries(FIELD_MAP)) {
    const value = (profile as unknown as Record<string, unknown>)[readable];

    if (readable === 'matchStatus') {
      out[code] = STATUS_MAP[value as string] ?? null;
      continue;
    }
    if (readable === 'coordinaten') {
      const c = value as { lat: number; lon: number } | null;
      out[code] = c === null ? null : { y: c.lat, x: c.lon };
      continue;
    }
    out[code] = value ?? null;
  }

  return out;
}
