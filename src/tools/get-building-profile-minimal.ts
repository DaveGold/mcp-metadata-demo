/**
 * MCP tool: get_building_profile — MINIMAL variant.
 *
 * The deliberately metadata-starved twin of `get_building_profile`, for the
 * "The Missing Layer" ablation. Same tool name and same underlying data path
 * (via `resolveBuildingProfile`), but with the metadata layer removed:
 *   - a one-sentence description (no WHEN/QUERY/INTERPRETATION guidance)
 *   - a bare input schema (no field descriptions, no format validation)
 *   - NO output schema (result is text-only, no structuredContent)
 *   - NO curated `alerts` / interpretation
 *
 * The point of the demo is that the DATA is identical to the rich tier — only
 * the layer that tells the model how to read it is gone. Keep this file dumb on
 * purpose: any guidance added here defeats the comparison.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import {
  resolveBuildingProfile,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';

const description = 'Look up a Dutch building by postcode and house number.';

// Bare input schema: no .describe(), no regex, no int/positive constraints,
// no huisletter/toevoeging. This is the "no full input schema" half of the demo.
const inputSchema = {
  postcode: z.string(),
  huisnummer: z.number(),
};

export function registerGetBuildingProfileMinimalTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): void {
  server.registerTool(
    'get_building_profile',
    {
      description,
      inputSchema: z.object(inputSchema),
    },
    async (args: { postcode: string; huisnummer: number }) => {
      try {
        const { profile } = await resolveBuildingProfile(bagClient, epOnlineClient, args);
        // Text only — no structuredContent, no alerts. Raw fields, no layer.
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_building_profile', variant: 'minimal', error: errorMessage });
        return {
          content: [{ type: 'text' as const, text: `Error in get_building_profile: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
