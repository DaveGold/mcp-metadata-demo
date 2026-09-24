/**
 * EVAL ARM — not example code. It exists to measure one variable against the others (evals/).
 * The reference implementation is src/tools/get-building-profile-best.ts.
 *
 * MCP tool: get_building_profile — OPAQUE arms (A' and B') of the ablation.
 *
 * These two arms exist because the original thin arm was never metadata-free:
 * it returns the same self-describing field names as the rich arm, and a model
 * reads straight through them. See `src/domain/obfuscate.ts` for the argument.
 *
 * Both arms here return the SAME obfuscated payload, take the SAME input
 * schema, have NO output schema and NO alerts. Exactly one thing differs:
 *
 *   withProse: false  -> a one-sentence description          (arm A')
 *   withProse: true   -> the interpretation guidance, keyed  (arm B')
 *                        to the opaque field codes
 *
 * So A' → B' measures what interpretation guidance buys, with the naming
 * confound removed. That is the comparison the paper's claim actually makes.
 *
 * Do not add descriptions to the input schema here, and do not let the two
 * descriptions drift apart in anything but content — every other difference
 * is an uncontrolled variable.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { obfuscateProfile } from '../domain/obfuscate.js';
import {
  resolveBuildingProfile,
  logToolCall,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';

/** Arm A': what a legacy register ships with. */
const bareDescription = 'Look up a Dutch building by postcode and house number.';

/**
 * Arm B': the same domain knowledge as the rich tier's INTERPRETATION block,
 * rewritten against the opaque codes. This IS the artifact under test — if the
 * claim "interpretation guidance is necessary" holds anywhere, it holds here,
 * because nothing else in this arm explains what the fields mean.
 */
const proseDescription = `\
RETURNS:
Building record combining BAG (Dutch address/building register) and EP-Online (energy label register) data for one postcode + house number.

FIELD GUIDE (the response uses short codes and carries no units):
- st: match status. 0 = no match, 1 = exact single match, 2 = MULTIPLE units at this address — the record returned is only the FIRST of them.
- n_c: number of candidate units matched. n_l: number of energy labels found.
- adr, gem, prv: address, municipality, province. crd: {y: latitude, x: longitude}.
- opp: floor area in m² of the individual unit (verblijfsobject) from BAG — GROSS area, and for one unit only.
- f_ga: usable floor area in m² of the THERMAL ZONE the energy label covers (EP-Online). This — not opp — is the denominator every per-m² figure below is expressed against. The two cover different scopes and their ratio is not fixed.
- n_vbo: number of units in the whole building (pand). When this is above ~10, opp describes one unit of a much larger building and must NOT be used as a whole-building area.
- gbd: building function(s). gk: 'Woningbouw' = residential, 'Utiliteitsbouw' = non-residential. Letter grades on the utiliteitsbouw scale are more lenient than on the residential one.
- bj: construction year (BAG). bj_ep: construction year as registered in EP-Online — a discrepancy suggests renovation or a registration error.
- vbo_st / pnd_st: unit and building status. Anything other than "in gebruik" means the building may be vacant or demolished.
- lbl: energy label letter, or null when no label is registered. Null means NOT REGISTERED, not "has no label".
- calc_t: the calculation standard. THIS DETERMINES WHICH FIELDS ARE POPULATED AND WHAT THEIR UNITS ARE — read it before reading any number:
  * NTA 8800 (labels after Dec 2021): ep1, ep2, ahe, wb, cmp, f_ga populated. ei is null. co2 is kg CO₂ per m² per year and IS comparable between buildings.
  * NEN 7120 / ISSO 75.3 (before Dec 2021, commercial): ei populated; ep1, ep2 and wb are null. bev is INFLATED by this method (typically 200–1200+) and is NOT a benchmarkable per-m² consumption figure — do not compare it against a real-world kWh/m² target. sbi holds a full-text sector description, not a numeric code.
  * Nader Voorschrift (before 2021, residential): ei populated. CRITICAL — bev and co2 use DIFFERENT UNITS here: values of 80,000–100,000 are MJ for the WHOLE building, and co2 is kg per year TOTAL, not per m². Do not benchmark either per m².
- ei: energy index, the performance metric on pre-NTA 8800 labels. LOWER IS BETTER: below 1.2 corresponds to label A or better, 1.4–1.8 to C, above 2.7 to G. There is no kWh/m² equivalent for it.
- ep1: energy demand in kWh/m²/year. Paris Proof 2040 targets are 70 for offices and 100 for residential. No standardised target exists for education, healthcare or industry.
- ep2: primary fossil energy, kWh/m²/year. ahe: renewable share, %.
- wb: net heat demand in kWh/m²/year — the key input for heat-pump sizing. Bands: below 50 very suitable, 50–70 suitable, 70–100 suitable provided insulation upgrades, 100 and above insulate first.
- to: overheating-risk indicator (TOjuli/GTO), unitless. 0 = no risk, 0–1.5 = minor, ABOVE 1.5 = significant overheating risk.
- cmp: compactness (loss surface / floor area). Lower = more compact = less heat loss per m².
- so: assessment type. "Basisopname" = standard site visit, "Detailopname" = detailed measurement and more accurate.
- ref: true means the label was derived from a reference-building calculation and is less accurate.
- dt_g: label expiry date. A date in the past means the label has expired.
- ep2f / ahef: the same figures recomputed with standardised area-bound measures (district heating, collective WKO or PV). NTA 8800 utiliteitsbouw only. The delta against ep2 can go in EITHER direction.
- e1, e2, e3: BENG legal limits. Populated only for new-build BENG permits, so almost always null on existing buildings.
- gt / gst: residential building type and subtype. Populated for Woningbouw only.

DERIVED FIGURES YOU MUST COMPUTE YOURSELF (nothing below is returned):
- Whole-building or whole-unit totals: multiply a per-m² figure by f_ga, not by opp.
- Annual gas for space heating: (wb × f_ga) ÷ 0.95 boiler efficiency ÷ 8.79 kWh per m³ of Dutch gas (31.65 MJ ÷ 3.6). This covers SPACE HEATING ONLY and excludes hot water and cooking.

QUERY STRATEGY:
1. Postcode is 4 digits + 2 uppercase letters with no space, e.g. "3543AR". House number is the integer only.
2. If st = 2, re-query with huisletter or toevoeging to reach the specific unit.
3. If st = 0, check the postcode format and the house number.

WHEN NOT TO USE:
- Metered or actual consumption. Every figure here is a theoretical calculation from a registered label; this server has no meter data.`;

const inputSchema = {
  postcode: z.string(),
  huisnummer: z.number(),
  huisletter: z.string().optional(),
  toevoeging: z.string().optional(),
};

export function registerGetBuildingProfileOpaqueTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  options: { withProse: boolean }
): void {
  const variant = options.withProse ? 'opaque-words' : 'opaque';

  server.registerTool(
    'get_building_profile',
    {
      description: options.withProse ? proseDescription : bareDescription,
      inputSchema: z.object(inputSchema),
    },
    async (args: { postcode: string; huisnummer: number; huisletter?: string; toevoeging?: string }) => {
      const start = Date.now();
      try {
        const { profile } = await resolveBuildingProfile(bagClient, epOnlineClient, args);
        await logToolCall({ args, start, status: 'success', rowCount: profile.candidateCount });
        // Text only, opaque keys, no alerts — the data is identical to every other arm.
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(obfuscateProfile(profile), null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_building_profile', variant, error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
