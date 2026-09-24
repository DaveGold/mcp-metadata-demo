/**
 * EVAL ARM — not example code. It exists to measure one variable against the others (evals/).
 * The reference implementation is src/tools/get-building-profile-best.ts.
 *
 * MCP tool: get_building_profile — INLINE variant.
 *
 * The CHANNEL arm. It exists to answer one question: is guidance read more
 * strongly from a tool RESPONSE than from a tool DESCRIPTION?
 *
 * The repo's strongest negative result is that a derivation recipe sitting
 * verbatim in a tool description went unapplied by 0 of 13 runs across two
 * models, while the same text pasted into a prompt produced the right answer
 * 3 of 3. That comparison is confounded — it crosses the payload-in-prompt and
 * live-tool-call protocols. This variant removes the confound: same live tool
 * call, same words, only the position changes.
 *
 *   schema → words    puts the INTERPRETATION prose in the DESCRIPTION.
 *   schema → inline   puts the SAME BYTES in the RESPONSE.
 *
 * So the description here is deliberately `schema`'s one-liner, byte-identical
 * to it and to `minimal`'s. If you are tempted to improve it, don't: the arm is
 * worthless unless its only difference from `schema` is where the prose sits.
 *
 * The prose is imported, never copied — `interpretationBlock` is the same
 * constant `descriptionCore` is composed from, so the two arms cannot drift.
 * `get-building-profile-inline.test.ts` asserts both invariants.
 *
 * NO ALERTS. Nothing here is computed; the server does no arithmetic the words
 * variant does not also decline to do. That keeps `inline` a test of delivery,
 * not of capability, and leaves `words → rich` as the only computation step.
 *
 * See evals/open-questions.md, Q1.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  interpretationBlock,
  derivedFiguresBlock,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithoutAlerts } from './get-building-profile-words.js';

/**
 * Byte-identical to the schema and minimal tiers. The whole point of this
 * variant is that the DESCRIPTION does not change; only the response does.
 */
const description = 'Look up a Dutch building by postcode and house number.';

/**
 * The words tier's output schema plus the one field this tier adds. The field is
 * described, not silent: a response carrying prose the schema does not mention
 * would be its own metadata defect, the mirror of the reason `words` omits the
 * ALERTS paragraph.
 */
export const outputSchemaWithInterpretation = outputSchemaWithoutAlerts.extend({
  interpretation: z
    .string()
    .describe(
      'How to read the fields above: which are populated for this berekeningstype, which units apply, and which comparisons are invalid.'
    ),
});

/**
 * `withRecipe` appends the DERIVED FIGURES procedure to the RESPONSE prose — the
 * `inline-recipe` arm of open-questions.md Q1b. `words-recipe` appends the SAME
 * imported block to its DESCRIPTION, so the pair differs only in channel.
 */
export function registerGetBuildingProfileInlineTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  opts: { withRecipe?: boolean } = {}
): void {
  const interpretationPayload = opts.withRecipe
    ? interpretationBlock + '\n\n' + derivedFiguresBlock
    : interpretationBlock;

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

        // Unconditional: every response carries the whole block, exactly as the
        // words tier's description does. Sizing it to the record is a SEPARATE
        // experiment (open-questions.md Q2) and must not be smuggled in here —
        // it would change two variables at once.
        const withInterpretation = { ...profile, interpretation: interpretationPayload };

        // Same call accounting as every other arm, so the only variable is the
        // delivery channel and not what the server records about itself.
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
        logger.error('tool.error', { tool: 'get_building_profile', variant: opts.withRecipe ? 'inline-recipe' : 'inline', error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
