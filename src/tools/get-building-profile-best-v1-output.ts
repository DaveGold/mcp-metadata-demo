/**
 * EVAL ARM — get_building_profile's output schema as `best` shipped it until 2026-09-28, with an
 * "Upstream field …" describe on each renamed field. Frozen: the `best-v1` and
 * `best-no-type-rules` arms were measured with these bytes. The reference implementation's output
 * schema (shape only) is in get-building-profile-best.ts.
 */
import { z } from 'zod';

const str = z.string().nullable();
const num = z.number().nullable();
const numPerMethod = z.number().nullable().optional();

export const bestBuildingOutputSchemaV1 = z.object({
  interpretation: z.object({
    alerts: z.array(z.string()),
    notes: z.array(z.string()),
    constants: z.record(z.string(), z.unknown()),
  }),
  derived: z.record(z.string(), z.unknown()),
  candidates: z
    .array(z.object({ adres: z.string(), huisletter: z.string().nullable(), toevoeging: z.string().nullable() }))
    .optional(),
  matchStatus: z.enum(['exact', 'multiple_vbos', 'not_found']).describe('Upstream field matchStatus'),
  candidateCount: z.number().describe('Upstream field candidateCount'),
  labelCount: z.number().describe('Upstream field labelCount'),
  adres: z.string().describe('Upstream field adres'),
  gemeente: str.describe('Upstream field gemeente'),
  provincie: str.describe('Upstream field provincie'),
  oppervlakte_bag_verblijfsobject_m2: num.describe('Upstream field oppervlakte_m2'),
  gebruiksdoel: str.describe('Upstream field gebruiksdoel'),
  coordinaten: z
    .object({ lat: z.number().describe('Latitude (WGS84)'), lon: z.number().describe('Longitude (WGS84)') })
    .nullable()
    .describe('Upstream field coordinaten'),
  bag_vbo_id: str.describe('Upstream field bag_vbo_id'),
  vbo_status: str.describe('Upstream field vbo_status'),
  bouwjaar: num.describe('Upstream field bouwjaar'),
  pand_status: str.describe('Upstream field pand_status'),
  aantal_verblijfsobjecten_in_pand: num.describe('Upstream field aantal_verblijfsobjecten'),
  bag_pand_id: str.describe('Upstream field bag_pand_id'),
  energielabel: str.describe('Upstream field energielabel'),
  ep1_energiebehoefte_berekend_kwh_m2: num.describe('Upstream field ep1_energiebehoefte_kwh_m2'),
  ep2_primair_fossiel_berekend_kwh_m2: num.describe('Upstream field ep2_fossiel_kwh_m2'),
  aandeel_hernieuwbare_energie_berekend_pct: num.describe('Upstream field aandeel_hernieuwbaar_pct'),
  co2_emissie_berekend_kg_m2: numPerMethod.describe('Upstream field co2_emissie_kg_m2'),
  co2_emissie_berekend_totaal_kg_jaar: numPerMethod.describe('Upstream field co2_emissie_kg_m2'),
  energieverbruik_berekend_niet_gemeten_kwh_m2: numPerMethod.describe('Upstream field berekend_energieverbruik_kwh_m2'),
  energieverbruik_berekend_niet_gemeten_totaal_mj: numPerMethod.describe(
    'Upstream field berekend_energieverbruik_kwh_m2',
  ),
  warmtebehoefte_berekend_kwh_m2: num.describe('Upstream field warmtebehoefte_kwh_m2'),
  temperatuuroverschrijding_indicator_eenheidloos: num.describe('Upstream field temperatuuroverschrijding'),
  compactheid_als_ag_eenheidloos: num.describe('Upstream field compactheid'),
  gebruiksoppervlakte_thermische_zone_m2: num.describe('Upstream field gebruiksoppervlakte_thermische_zone_m2'),
  gebouwklasse: str.describe('Upstream field gebouwklasse'),
  soort_opname: str.describe('Upstream field soort_opname'),
  berekeningstype: str.describe('Upstream field berekeningstype'),
  label_status: str.describe('Upstream field label_status'),
  op_basis_van_referentiegebouw: z.boolean().nullable().describe('Upstream field op_basis_van_referentiegebouw'),
  label_geldig_tot: str.describe('Upstream field label_geldig_tot'),
  label_opnamedatum: str.describe('Upstream field label_opnamedatum'),
  label_registratiedatum: str.describe('Upstream field label_registratiedatum'),
  gebouwtype: str.describe('Upstream field gebouwtype'),
  gebouwsubtype: str.describe('Upstream field gebouwsubtype'),
  sbi_sector_omschrijving: str.describe('Upstream field sbi_code'),
  energie_index_berekend_eenheidloos: num.describe('Upstream field energie_index'),
  ep2_primair_fossiel_emg_forfaitair_berekend_kwh_m2: num.describe('Upstream field ep2_fossiel_emg_forfaitair_kwh_m2'),
  aandeel_hernieuwbare_energie_emg_forfaitair_berekend_pct: num.describe(
    'Upstream field aandeel_hernieuwbaar_emg_forfaitair_pct',
  ),
  eis_energiebehoefte_kwh_m2: num.describe('Upstream field eis_energiebehoefte_kwh_m2'),
  eis_primaire_fossiele_energie_kwh_m2: num.describe('Upstream field eis_primaire_fossiele_energie_kwh_m2'),
  eis_aandeel_hernieuwbare_energie_pct: num.describe('Upstream field eis_aandeel_hernieuwbare_energie_pct'),
  certificaathouder: str.describe('Upstream field certificaathouder'),
  ep_online_bouwjaar: num.describe('Upstream field ep_online_bouwjaar'),
});
