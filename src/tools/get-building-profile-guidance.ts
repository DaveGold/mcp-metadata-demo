/**
 * MCP tool: get_building_profile — GUIDANCE-RECIPE variant (open-questions.md Q8).
 *
 * The third channel for the DERIVED FIGURES recipe. Q1b shipped the same bytes in
 * the DESCRIPTION (`words-recipe`) and in the data RESPONSE (`inline-recipe`). This
 * arm ships them in a GUIDANCE CALL: calling the tool with no arguments returns the
 * recipe, before any data exists. It is the shape of the production Duurzaam
 * server's `start_duurzaam`, folded into the one tool as Q8 registered it.
 *
 *   no arguments           → { guidance: derivedFiguresBlock }, nothing else
 *   postcode + huisnummer  → the profile, with NO interpretation prose
 *
 * The description is `schema`'s one-liner plus ONE pointer sentence. Without a
 * pointer the no-argument call cannot be discovered, and "does the model make it"
 * would be zero by construction. The pointer names the call, not the content: it
 * says nothing the recipe says. `start_duurzaam` carries the same kind of pointer
 * ("Call WITHOUT parameters first").
 *
 * postcode and huisnummer are therefore optional in this arm's input schema, the
 * one schema difference it has. A lookup with only one of them is an error.
 *
 * Q8b adds two arms that vary ONLY how the call is pointed to, the bytes returned
 * staying `derivedFiguresBlock`:
 *   `guidance-strong` — the same no-argument call, with an imperative pointer;
 *   `guidance-tool`   — a separate parameterless `get_derivation_guide` tool.
 *                       Deleted after Q8b (10/10, same as strong); see git history.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  derivedFiguresBlock,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithoutAlerts } from './get-building-profile-words.js';

/** `schema`'s one-liner, byte for byte, then the pointer. */
export const schemaTierDescription = 'Look up a Dutch building by postcode and house number.';
export const guidancePointer =
  'Call it once with no arguments first: that returns how to derive figures from the lookup result.';
export const guidanceDescription = schemaTierDescription + ' ' + guidancePointer;

/** Q8b `guidance-strong`: the same call, pointed to imperatively and with a consequence. */
export const strongPointer =
  'REQUIRED: before any lookup, call this tool once with no arguments. That returns how to derive figures from the lookup result; do not derive figures without it.';
export const strongDescription = schemaTierDescription + ' ' + strongPointer;


/** Every profile field optional, so the guidance-only result validates too. */
export const outputSchemaWithGuidance = outputSchemaWithoutAlerts.partial().extend({
  guidance: z
    .string()
    .optional()
    .describe('Returned only by the no-argument call: how to derive figures from a lookup result.'),
});

export function registerGetBuildingProfileGuidanceTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  opts: { pointer?: 'soft' | 'strong' } = {}
): void {
  server.registerTool(
    'get_building_profile',
    {
      title: 'Building Profile (BAG + Energy Label)',
      description: opts.pointer === 'strong' ? strongDescription : guidanceDescription,
      inputSchema: z.object({
        ...inputSchema,
        postcode: inputSchema.postcode.optional(),
        huisnummer: inputSchema.huisnummer.optional(),
      }),
      outputSchema: outputSchemaWithGuidance,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args: {
      postcode?: string;
      huisnummer?: number;
      huisletter?: string;
      toevoeging?: string;
      queryIntent?: string;
    }) => {
      const start = Date.now();

      if (args.postcode === undefined && args.huisnummer === undefined) {
        // The guidance call. Logged like any other call so the audit can count it;
        // rowCount 0 and the absent address in queryIntent mark it in the log.
        const guidance = { guidance: derivedFiguresBlock };
        await logToolCall({
          args: { postcode: '', huisnummer: 0, queryIntent: args.queryIntent ?? 'guidance (no arguments)' },
          start,
          status: 'success',
          rowCount: 0,
        });
        return {
          structuredContent: guidance,
          content: [{ type: 'text' as const, text: JSON.stringify(guidance, null, 2) }],
        };
      }

      try {
        if (args.postcode === undefined || args.huisnummer === undefined) {
          throw new Error('A lookup needs both postcode and huisnummer; call with no arguments for guidance.');
        }
        const lookupArgs = { ...args, postcode: args.postcode, huisnummer: args.huisnummer };
        const { profile, notFound } = await resolveBuildingProfile(bagClient, epOnlineClient, lookupArgs);

        await logToolCall({
          args: lookupArgs,
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
        logger.error('tool.error', { tool: 'get_building_profile', variant: opts.pointer === 'strong' ? 'guidance-strong' : 'guidance-recipe', error: errorMessage });
        await logToolCall({
          args: { ...args, postcode: args.postcode ?? '', huisnummer: args.huisnummer ?? 0 },
          start,
          status: 'error',
          rowCount: 0,
        });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
