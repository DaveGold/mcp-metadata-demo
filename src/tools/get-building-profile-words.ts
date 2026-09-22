/**
 * MCP tool: get_building_profile — WORDS variant (arm B of the ablation).
 *
 * The middle tier between `get-building-profile-minimal.ts` (arm A) and
 * `get-building-profile.ts` (arm C). It carries the ENTIRE metadata layer that
 * can be expressed as *words*:
 *   - the full RETURNS / WHEN TO USE / WHEN NOT TO USE / QUERY STRATEGY /
 *     INTERPRETATION description, byte-identical to the rich tier
 *   - the full input schema, with .describe(), format validation, and the
 *     huisletter/toevoeging params the minimal tier lacks
 *   - the full output schema, with .describe() on every field
 *
 * and nothing that requires the server to COMPUTE something:
 *   - NO `alerts` array. No gas estimate, no heat-pump band, no Paris Proof
 *     verdict, no BENG pass/fail, no derived totals.
 *
 * The description is `descriptionCore` rather than the rich `description`: the
 * rich one ends with an ALERTS paragraph promising a field this variant does not
 * return, and describing an absent field would be its own metadata defect.
 *
 * Why it exists: comparing arm A with arm C measures two changes at once (better
 * words AND new capability). A → B isolates what the words alone buy; B → C
 * isolates what server-side computation adds on top. Keep this file's prose
 * identical to the rich tier — any divergence makes the comparison meaningless.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  descriptionCore,
  derivedFiguresBlock,
  inputSchema,
  outputSchema,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { q15FrontDescription } from './q15-front.js';

/** The rich output schema minus the one field this tier does not produce. */
export const outputSchemaWithoutAlerts = outputSchema.omit({ alerts: true });

/**
 * `withRecipe` appends the DERIVED FIGURES procedure to the description — the
 * `words-recipe` arm of open-questions.md Q1b. The block is imported, never
 * copied, so this arm and `inline-recipe` ship identical bytes by two channels.
 *
 * `withFront` is Q15's throwaway `words-front` arm: the same description with the
 * overheating line and a canary inserted inside the host's 2,048-char cut.
 */
export function registerGetBuildingProfileWordsTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  opts: { withRecipe?: boolean; withFront?: boolean } = {}
): void {
  const toolDescription = opts.withFront
    ? q15FrontDescription
    : opts.withRecipe
      ? descriptionCore + '\n\n' + derivedFiguresBlock
      : descriptionCore;
  const variant = opts.withFront ? 'words-front' : opts.withRecipe ? 'words-recipe' : 'words';

  server.registerTool(
    'get_building_profile',
    {
      title: 'Building Profile (BAG + Energy Label)',
      description: toolDescription,
      inputSchema: z.object(inputSchema),
      outputSchema: outputSchemaWithoutAlerts,
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

        // Same call accounting as the rich tier, so the only variable between
        // arms B and C is the alerts layer itself — not what the server records.
        await logToolCall({
          args,
          start,
          status: 'success',
          rowCount: notFound ? 0 : profile.candidateCount,
        });

        return {
          structuredContent: profile,
          content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }],
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
