/**
 * MCP tool: get_building_profile — Q10 (reopened) arms.
 *
 * ONE interpretation sentence in the RESPONSE, byte-identical in every arm, shipped as
 *   prose     — a plain string;
 *   addressed — { relates_to_fields, meaning };
 *   triggered — the same plus `triggered_by`, a server-computed line naming the values in
 *               THIS record that make the sentence apply (omitted when they do not).
 * The sentence is SLICED from `interpretationBlock`, never retyped. Description is
 * `schema`'s one-liner, so the only variable is the form of the response guidance.
 * See evals/open-questions.md, Q10.
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
import { outputSchemaWithoutAlerts } from './get-building-profile-words.js';
import type { Q10Form } from './get-weather-context.js';

const scopesLabel = 'gebruiksoppervlakte_thermische_zone_m2 (NTA 8800 only) vs oppervlakte_m2 (BAG)';
const scopesRaw = interpretationBlock.split('\n').find((l) => l.startsWith('- ' + scopesLabel));
if (!scopesRaw) throw new Error('scopes line not found in interpretationBlock');
/** The scopes sentence, as `interpretationBlock` carries it, minus its bullet. */
export const scopesLine = scopesRaw.slice(2);
export const scopesFields = [
  'gebruiksoppervlakte_thermische_zone_m2',
  'oppervlakte_m2',
  'ep1_energiebehoefte_kwh_m2',
  'ep2_fossiel_kwh_m2',
  'warmtebehoefte_kwh_m2',
  'co2_emissie_kg_m2',
];

export function q10Interpretation(form: Q10Form, profile: Record<string, unknown>): unknown {
  if (form === 'prose') return scopesLine;
  const a = profile.oppervlakte_m2 as number | null;
  const b = profile.gebruiksoppervlakte_thermische_zone_m2 as number | null;
  const trigger =
    form === 'triggered' && a != null && b != null && a !== b
      ? `oppervlakte_m2 = ${a} and gebruiksoppervlakte_thermische_zone_m2 = ${b} differ in this record`
      : null;
  return [trigger ? { relates_to_fields: scopesFields, triggered_by: trigger, meaning: scopesLine } : { relates_to_fields: scopesFields, meaning: scopesLine }];
}

const description = 'Look up a Dutch building by postcode and house number.';

export function registerGetBuildingProfileQ10Tool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  form: Q10Form
): void {
  server.registerTool(
    'get_building_profile',
    {
      title: 'Building Profile (BAG + Energy Label)',
      description,
      inputSchema: z.object(inputSchema),
      outputSchema: outputSchemaWithoutAlerts.extend({ interpretation: z.unknown() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args: { postcode: string; huisnummer: number; huisletter?: string; toevoeging?: string; queryIntent?: string }) => {
      const start = Date.now();
      try {
        const { profile, notFound } = await resolveBuildingProfile(bagClient, epOnlineClient, args);
        const out = { ...profile, interpretation: q10Interpretation(form, profile as unknown as Record<string, unknown>) };
        await logToolCall({ args, start, status: 'success', rowCount: notFound ? 0 : profile.candidateCount });
        return { structuredContent: out, content: [{ type: 'text' as const, text: JSON.stringify(out, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_building_profile', variant: `q10-${form}`, error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return { content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }], isError: true };
      }
    }
  );
}
