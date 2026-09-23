/**
 * MCP tool: get_building_profile — Q17 arms (open-questions.md Q17).
 *
 * The two target rules (overheating, scopes — sliced from `interpretationBlock`) in the
 * RESPONSE, alone (`one`), among 98 real distractor rules as prose (`many`), or the same
 * 100 each with `relates_to_fields` (`many-addressed`). Description is `schema`'s one-liner.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  overheatingLine,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithoutAlerts } from './get-building-profile-words.js';
import { scopesLine, scopesFields } from './get-building-profile-q10.js';
import rules from './q17-rules.json' with { type: 'json' };

export type Q17Form = 'one' | 'ten' | 'many' | 'many-addressed';

type Rule = { relates_to_fields: string[]; meaning: string };
const targets: Array<[number, Rule]> = [
  [41, { relates_to_fields: ['temperatuuroverschrijding'], meaning: overheatingLine }],
  [63, { relates_to_fields: scopesFields, meaning: scopesLine }],
];

/** The 100 rules in their fixed order: distractors with the targets inserted at 41 and 63. */
export const q17Rules: Rule[] = (() => {
  const out: Rule[] = (rules.distractors as Array<{ text: string; relates_to_fields: string[] }>).map((d) => ({
    relates_to_fields: d.relates_to_fields,
    meaning: d.text,
  }));
  for (const [pos, r] of targets) out.splice(pos, 0, r);
  return out;
})();

/** The 10-rule dose point: the first 8 distractors with the targets at 3 and 6. */
export const q17Ten: string[] = (() => {
  const d = (rules.distractors as Array<{ text: string }>).slice(0, 8).map((x) => x.text);
  d.splice(3, 0, overheatingLine);
  d.splice(6, 0, scopesLine);
  return d;
})();

export function q17Interpretation(form: Q17Form): unknown {
  if (form === 'one') return [overheatingLine, scopesLine].join('\n');
  if (form === 'ten') return q17Ten.join('\n');
  if (form === 'many') return q17Rules.map((r) => r.meaning).join('\n');
  return q17Rules;
}

const description = 'Look up a Dutch building by postcode and house number.';

export function registerGetBuildingProfileQ17Tool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  form: Q17Form
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
        const out = { ...profile, interpretation: q17Interpretation(form) };
        await logToolCall({ args, start, status: 'success', rowCount: notFound ? 0 : profile.candidateCount });
        return { structuredContent: out, content: [{ type: 'text' as const, text: JSON.stringify(out, null, 2) }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_building_profile', variant: `q17-${form}`, error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return { content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }], isError: true };
      }
    }
  );
}
