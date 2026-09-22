/**
 * MCP tool: get_building_profile — INLINE-ONELINE variant.
 *
 * open-questions.md Q14. The MINIMUM VIABLE RESPONSE arm.
 *
 * Q13 measured the channel with the whole interpretation block: the same prose
 * scored 5/20 in the DESCRIPTION and 20/20 in the RESPONSE on `overheating`.
 * That is a real result and it is not the one a production server can act on,
 * because "move your entire interpretation block into every response" is an
 * expensive instruction and nobody has checked whether it is a necessary one.
 *
 * Q2 says it probably is not: pruning the response block to the record cost ZERO
 * accuracy twice (39/90 vs 39/90, then 30/30 vs 30/30 with two thirds cut). Q5
 * says the rest is not free either — metadata that does not answer the question
 * is charged at list price. Put together, the payoff should come from the lines
 * that bear on the question, not from the volume.
 *
 * This arm is the limit case of that: ONE line in the response.
 *
 *   words          = full prose in the DESCRIPTION, nothing in the response.   5/20
 *   inline-oneline = the SAME description, plus ONE line in the response.        ?
 *   inline         = minimal description, WHOLE block in the response.        20/20
 *
 * THE COMPARISON THAT MEANS ANYTHING IS `words` → `inline-oneline`. They differ
 * in exactly one thing: one line added to the response. The description is NOT
 * stripped — it still carries the line too, because that is what a real server
 * would do. It is an additive fix, not a move, and it is the cheapest change
 * that could possibly work.
 *
 * `inline` is the reference ceiling, not an adjacent rung: it differs from this
 * arm in BOTH the description and the amount of response prose.
 *
 * The line is SLICED from `interpretationBlock` via `overheatingLine`, never
 * retyped, so this arm cannot drift from the description it sits beside.
 * `get-building-profile-inline-oneline.test.ts` asserts that, asserts the
 * description is byte-identical to `words`, and asserts the response carries that
 * line and nothing else.
 *
 * NO ALERTS — same reason as `inline`. Nothing here is computed, so the arm stays
 * a test of delivery rather than of capability.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  descriptionCore,
  inputSchema,
  overheatingLine,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithInterpretation } from './get-building-profile-inline.js';

/**
 * Byte-identical to the `words` tier. The whole point of this arm is that the
 * DESCRIPTION does not change — if you are tempted to trim it because the line
 * now also ships in the response, don't: that would make this a MOVE instead of
 * an ADDITION, and the production fix it stands in for is an addition.
 */
const description = descriptionCore;

export function registerGetBuildingProfileInlineOnelineTool(
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

        // Unconditional, exactly like `inline` — the ONE line ships on every
        // record, including records where temperatuuroverschrijding is null.
        // Gating it on the field being populated would be Q2's conditional
        // pruning smuggled in, and would change two variables at once.
        const withInterpretation = { ...profile, interpretation: overheatingLine };

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
          variant: 'inline-oneline',
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
