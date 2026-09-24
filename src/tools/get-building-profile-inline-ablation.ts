/**
 * EVAL ARM — not example code. It exists to measure one variable against the others (evals/).
 * The reference implementation is src/tools/get-building-profile-best.ts.
 *
 * MCP tool: get_building_profile — the two Q4 ABLATION variants.
 *
 * open-questions.md Q4. The CALCULATED vs MEASURED line took `benchmark-trap`
 * from 0 of 60 to 59 of 60. It bundles a FACT (what the quantities are, and that
 * they are therefore not rankable against a metered target) with an INSTRUCTION
 * (say the comparison cannot be made, rather than producing a ratio). Q4 asks
 * which half did the work — because before the line existed, `opus`/`inline`
 * NAMED the mismatch 7 times in 10 and returned the forbidden verdict 10 times
 * in 10. It had the fact. It lacked the instruction.
 *
 * If the instruction alone is what moves the number, the finding stops being
 * "write better field descriptions" and becomes "tool metadata must specify
 * BEHAVIOUR, not only SEMANTICS" — which is most of the ladder in this repo, and
 * most metadata in the wild.
 *
 *   inline           = both halves   (already deployed; the Q4 control)
 *   inline-fact      = fact only
 *   inline-instruction = instruction only
 *
 * EVERYTHING ELSE IS HELD CONSTANT: the same one-sentence description as
 * `schema` and `inline`, the same schemas, the same response channel, the same
 * render tools, the same unconditional whole-block delivery. One line differs,
 * and within that line only which half survives.
 *
 * The prose is SLICED from `interpretationBlock`, never retyped — the arms take
 * the block and swap the one line, so they cannot drift from `inline`.
 * `get-building-profile-inline-ablation.test.ts` asserts that, and asserts the
 * arms differ from each other and from `inline` in EXACTLY one line.
 *
 * A KNOWN WRINKLE, deliberately left in: the instruction says "say that the
 * comparison cannot be made from this data AND WHY" while the fact-only arm is
 * the one that supplies the why. That asymmetry is the real shape of an
 * instruction written without its reason, and smoothing it would make the arm a
 * different experiment. It is recorded in the results file, not patched here.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  logToolCall,
  inputSchema,
  interpretationBlock,
  calcVsMeasuredLabel,
  calcVsMeasuredFactOnly,
  calcVsMeasuredInstructionOnly,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';
import { outputSchemaWithInterpretation } from './get-building-profile-inline.js';

/** Byte-identical to `schema`, `minimal` and `inline`. Only the response changes. */
const description = 'Look up a Dutch building by postcode and house number.';

export type AblationMode = 'fact' | 'instruction';

/**
 * Returns `interpretationBlock` with the CALCULATED vs MEASURED line replaced by
 * the requested half. Every other line is passed through untouched, so the two
 * arms and `inline` differ in exactly one line of prose.
 */
export function ablatedInterpretation(mode: AblationMode): string {
  const replacement =
    mode === 'fact' ? calcVsMeasuredFactOnly : calcVsMeasuredInstructionOnly;
  return interpretationBlock
    .split('\n')
    .map((line) => (line.startsWith(calcVsMeasuredLabel.trimEnd()) ? replacement : line))
    .join('\n');
}

export function registerGetBuildingProfileInlineAblationTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  opts: { mode: AblationMode }
): void {
  const interpretationPayload = ablatedInterpretation(opts.mode);
  const variant = opts.mode === 'fact' ? 'inline-fact' : 'inline-instruction';

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
        const withInterpretation = { ...profile, interpretation: interpretationPayload };

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
