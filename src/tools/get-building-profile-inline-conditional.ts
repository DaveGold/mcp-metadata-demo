/**
 * MCP tool: get_building_profile — INLINE-CONDITIONAL variant.
 *
 * open-questions.md Q2. `inline` ships the whole INTERPRETATION block in every
 * response; this arm ships only the part that applies to the record in hand.
 *
 * Why it is not merely a cost optimisation: a tool DESCRIPTION is written before
 * the data is known, so it must carry every branch. A RESPONSE is the only
 * channel that can be conditional on the record. That makes this something the
 * description channel structurally cannot do, independent of Q1's finding that
 * the response channel is read more strongly.
 *
 * WHAT IS PRUNED, exactly as specified in open-questions.md:
 *   - the berekeningstype branches: keep ONLY the one matching this record
 *   - every field-level note: keep it only when the field it concerns is
 *     actually non-null in this response
 *
 * THE PRUNING IS MECHANICAL AND DELIBERATELY NOT HAND-TUNED. Q2's registered
 * prediction is that this arm WINS on single-record questions and LOSES on
 * cross-record comparison, because conditional guidance means the model never
 * learns what it is not being told — `benchmark-trap` is precisely the question
 * whose preventing sentence may get pruned away. Special-casing a bullet back in
 * because it looks important would delete the experiment. If a sentence turns out
 * to be load-bearing, that is the RESULT, not a bug to patch.
 *
 * The prose is SLICED FROM `interpretationBlock`, never retyped, so this arm
 * cannot drift from `words` and `inline`. Every line it emits is a line of theirs.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  interpretationBlock,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithInterpretation } from './get-building-profile-inline.js';

/** Byte-identical to the schema, minimal and inline tiers. Only the response changes. */
const description = 'Look up a Dutch building by postcode and house number.';

type Profile = Record<string, unknown>;

const has = (p: Profile, k: string): boolean => p[k] !== null && p[k] !== undefined;
const str = (p: Profile, k: string): string => (typeof p[k] === 'string' ? (p[k] as string) : '');

/**
 * Line-prefix → predicate. A line is kept when its predicate returns true; a line
 * matching no prefix is kept unconditionally (the header and the "Which fields are
 * populated" lead-in). Prefixes are matched against the SOURCE lines of
 * `interpretationBlock`, so adding a bullet there without adding a gate here keeps
 * it in every response — which fails loudly in the "prunes something" test rather
 * than silently shipping an unpruned arm.
 */
const GATES: Array<[string, (p: Profile) => boolean]> = [
  // ── the three mutually exclusive berekeningstype branches ──
  ['- NTA 8800 (', (p) => str(p, 'berekeningstype').includes('NTA 8800')],
  [
    '- NEN 7120 / ISSO 75.3',
    (p) => /NEN 7120|ISSO 75\.3/.test(str(p, 'berekeningstype')),
  ],
  ['- Nader Voorschrift', (p) => str(p, 'berekeningstype').includes('Nader Voorschrift')],

  // ── field-level notes, gated on the field being populated ──
  [
    '- BENG eisen',
    (p) =>
      has(p, 'eis_energiebehoefte_kwh_m2') ||
      has(p, 'eis_primaire_fossiele_energie_kwh_m2') ||
      has(p, 'eis_aandeel_hernieuwbare_energie_pct'),
  ],
  ['- gebouwtype/gebouwsubtype: only populated', (p) => has(p, 'gebouwtype') || has(p, 'gebouwsubtype')],
  ["- matchStatus 'exact'", (p) => str(p, 'matchStatus') === 'exact'],
  ["- matchStatus 'multiple_vbos'", (p) => str(p, 'matchStatus') === 'multiple_vbos'],
  ["- matchStatus 'not_found'", (p) => str(p, 'matchStatus') === 'not_found'],
  ['- energielabel null:', (p) => !has(p, 'energielabel')],
  ['- ep1_energiebehoefte_kwh_m2', (p) => has(p, 'ep1_energiebehoefte_kwh_m2')],
  // The calculated-vs-measured note concerns ep1, ep2 and berekend_energieverbruik,
  // so it is gated on its own fields like every other field note: kept when any of
  // the three is populated, pruned when none is. On an NTA 8800 record all three are
  // populated, so BOTH arms ship it; on a record with none of them it goes. This gate
  // was NOT hand-tuned to keep the sentence on the benchmark-trap record — it follows
  // the same mechanical rule as the rest of the table.
  [
    '- CALCULATED vs MEASURED',
    (p) =>
      has(p, 'ep1_energiebehoefte_kwh_m2') ||
      has(p, 'ep2_fossiel_kwh_m2') ||
      has(p, 'berekend_energieverbruik_kwh_m2'),
  ],
  ['- energie_index (pre-NTA 8800)', (p) => has(p, 'energie_index')],
  ['- gebruiksoppervlakte_thermische_zone_m2', (p) => has(p, 'gebruiksoppervlakte_thermische_zone_m2')],
  [
    '- label_geldig_tot in the past',
    (p) => has(p, 'label_geldig_tot') && new Date(str(p, 'label_geldig_tot')).getTime() < Date.now(),
  ],
  ['- op_basis_van_referentiegebouw = true', (p) => p['op_basis_van_referentiegebouw'] === true],
  ['- vbo_status not', (p) => has(p, 'vbo_status') && str(p, 'vbo_status') !== 'Verblijfsobject in gebruik'],
  ['- sbi_code:', (p) => has(p, 'sbi_code')],
  ['- ep2_fossiel_emg_forfaitair_kwh_m2 vs', (p) => has(p, 'ep2_fossiel_emg_forfaitair_kwh_m2')],
  ['- aandeel_hernieuwbaar_emg_forfaitair_pct', (p) => has(p, 'aandeel_hernieuwbaar_emg_forfaitair_pct')],
  [
    '- ep_online_bouwjaar vs bouwjaar',
    (p) => has(p, 'ep_online_bouwjaar') && has(p, 'bouwjaar') && p['ep_online_bouwjaar'] !== p['bouwjaar'],
  ],
  ['- co2_emissie_kg_m2 unit depends', (p) => has(p, 'co2_emissie_kg_m2')],
  ['- warmtebehoefte_kwh_m2 (net heat demand)', (p) => has(p, 'warmtebehoefte_kwh_m2')],
  ['- temperatuuroverschrijding', (p) => has(p, 'temperatuuroverschrijding')],
  ['- compactheid', (p) => has(p, 'compactheid')],
  ['- soort_opname:', (p) => has(p, 'soort_opname')],
  ['- gebouwtype/gebouwsubtype refinements', (p) => has(p, 'gebouwtype') || has(p, 'gebouwsubtype')],
];

/**
 * The whole arm, in one pure function so it is testable without a transport.
 * Returns the subset of `interpretationBlock` that applies to `profile`.
 */
export function conditionalInterpretation(profile: Profile): string {
  return interpretationBlock
    .split('\n')
    .filter((line) => {
      const gate = GATES.find(([prefix]) => line.startsWith(prefix));
      return gate ? gate[1](profile) : true;
    })
    .join('\n');
}

export function registerGetBuildingProfileInlineConditionalTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): void {
  server.registerTool(
    'get_building_profile',
    {
      title: 'Building Profile (BAG + Energy Label)',
      description,
      inputSchema: z.object(inputSchema),
      outputSchema: outputSchemaWithInterpretation,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: {
      postcode: string;
      huisnummer: number;
      huisletter?: string;
      toevoeging?: string;
      queryIntent?: string;
    }) => {
      const start = Date.now();

      try {
        const { profile, notFound } = await resolveBuildingProfile(bagClient, epOnlineClient, args);

        const withInterpretation = {
          ...profile,
          interpretation: conditionalInterpretation(profile as unknown as Profile),
        };

        await logToolCall({
          args,
          start,
          status: 'success',
          rowCount: notFound ? 0 : profile.candidateCount,
        });

        return {
          structuredContent: withInterpretation,
          content: [{ type: 'text' as const, text: JSON.stringify(withInterpretation, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', {
          tool: 'get_building_profile',
          variant: 'inline-conditional',
          error: errorMessage,
        });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
