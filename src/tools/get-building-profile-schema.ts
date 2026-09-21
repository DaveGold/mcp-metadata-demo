/**
 * MCP tool: get_building_profile — SCHEMA variant.
 *
 * The rung that was missing from the ladder. Until this existed, the only way
 * from `minimal` to `words` changed THREE things at once — the prose
 * description, the input schema and the output schema — so no result could be
 * attributed to any one of them. This variant moves exactly one:
 *
 *   minimal → schema   adds the typed, `.describe()`d input and output schemas
 *                      (and the huisletter/toevoeging params minimal lacks),
 *                      while keeping minimal's one-sentence description.
 *   schema  → words    then adds the prose description, and nothing else.
 *   words   → rich     then adds the computed `alerts`, and nothing else.
 *
 * So the description here is deliberately the MINIMAL one-liner, byte-identical
 * to `get-building-profile-minimal.ts`. If you are tempted to improve it, don't:
 * the whole value of this file is that it differs from its neighbours in one
 * dimension each way.
 *
 * Field NAMES are the readable ones, as in minimal/words/rich. The opaque
 * naming axis is orthogonal and lives in `get-building-profile-opaque.ts`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithoutAlerts } from './get-building-profile-words.js';

/**
 * Byte-identical to the minimal tier's description. The point of this variant is
 * that the WORDS do not change; only the schemas do.
 */
const description = 'Look up a Dutch building by postcode and house number.';

export function registerGetBuildingProfileSchemaTool(
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
        logger.error('tool.error', { tool: 'get_building_profile', variant: 'schema', error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
