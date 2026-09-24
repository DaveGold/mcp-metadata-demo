/**
 * MCP tool: get_building_profile — `best` arm (reference implementation).
 *
 * Same registers and data path as get-building-profile.ts (BAG → VBO/Pand → EP-Online),
 * built with the rich-domain-mcp-server skill's audit flow. What changes is what the
 * model receives:
 * - field names that say quantity, scope, provenance and unit (best-field-names.ts);
 * - a description ≤ 2,048 chars carrying only what must be known BEFORE a call (Q7);
 * - `interpretation` first in the response: record-conditional lines from a rule
 *   registry with provenance in source (best-building-rules.ts);
 * - computed `derived` values with unit, basis and provenance, or null + reason;
 * - `candidates` when an address matches several units;
 * - no numeric Paris Proof threshold anywhere (the calculated-vs-measured defect).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { selectBestLabel } from '../domain/select-best-label.js';
import { buildProfile, emptyProfile } from '../domain/build-profile.js';
import type { ProfileCore } from '../domain/generate-alerts.js';
import { BUILDING_FIELD_NAMES, renameBuildingProfile } from '../domain/best-field-names.js';
import { selectRules, type Interpretation } from '../domain/best-rules.js';
import { BUILDING_CONSTANTS, BUILDING_RULES, buildingCtx, type BuildingDerived } from '../domain/best-building-rules.js';
import {
  inputSchema as richInputSchema,
  outputSchema as richOutputSchema,
  logToolCall,
  type BagClientLike,
  type EpOnlineClientLike,
} from './get-building-profile.js';

export const bestBuildingDescription = `\
WHEN TO USE: what building is at a Dutch address — label, bouwjaar, area, and label-based estimates (CO₂, space-heating gas, heat-pump readiness, overheating).

WHEN NOT TO USE: this server has NO metered energy consumption — no meter readings, no actual gas or electricity use. Not for addresses outside the Netherlands.

RELATED TOOLS: get_weather_context(latitude/longitude = coordinaten.lat/lon) for degree days and weather correction.

QUERY STRATEGY: postcode = 4 digits + 2 capitals, no space ("3543AR"). huisnummer = integer only; a letter goes in huisletter (28A → 28 + "A"), an addition in toevoeging. Several units match? Retry with one from candidates.

RETURNS: interpretation, derived, candidates, then BAG facts (bouwjaar, oppervlakte_bag_verblijfsobject_m2 = ONE unit, coordinaten) and the EP-Online label (energielabel, berekeningstype, *_berekend_* figures per m² of gebruiksoppervlakte_thermische_zone_m2).

INTERPRETATION — read \`interpretation\` FIRST: this record's computed values and reading rules. Quote them; do not recompute. For every record:
- CALCULATED vs MEASURED: every EP-Online energy figure is calculated by the label method, never measured. Paris Proof and other metered benchmarks are defined on measured final energy, so where a question asks for that comparison, say it cannot be made from this data and why, rather than producing a ratio.
- Totals use gebruiksoppervlakte_thermische_zone_m2, never the BAG area.
- A null field was not produced by that label method. Never substitute an estimate or a different field; say the data does not contain it.
- No registered label means no label is known. Do not infer one from bouwjaar or building type.

ALERTS: interpretation.alerts — computed verdicts and this record's branch (not found, several units, no label).`;

// ── Output schema: shape-only (Q11: not delivered to the model; validation + UI only) ──

const profileShape: Record<string, z.ZodTypeAny> = {};
for (const [key, type] of Object.entries(richOutputSchema.shape)) {
  if (key === 'alerts') continue;
  const rows = BUILDING_FIELD_NAMES.filter((r) => r.upstream === key);
  const identity = `Upstream field ${key}`;
  if (rows.length === 0) profileShape[key] = (type as z.ZodTypeAny).describe(identity);
  // A field with a per-method variant appears under exactly one of its names per record.
  for (const r of rows) profileShape[r.name] = rows.length > 1 ? (type as z.ZodTypeAny).optional().describe(identity) : (type as z.ZodTypeAny).describe(identity);
}

export const bestBuildingOutputSchema = z.object({
  interpretation: z.object({
    alerts: z.array(z.string()),
    notes: z.array(z.string()),
    constants: z.record(z.string(), z.unknown()),
  }),
  derived: z.record(z.string(), z.unknown()),
  candidates: z
    .array(z.object({ adres: z.string(), huisletter: z.string().nullable(), toevoeging: z.string().nullable() }))
    .optional(),
  ...profileShape,
});

const MAX_CANDIDATES = 20;

export async function resolveBestBuilding(
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike,
  args: { postcode: string; huisnummer: number; huisletter?: string; toevoeging?: string }
): Promise<{ profile: ProfileCore; candidates?: { adres: string; huisletter: string | null; toevoeging: string | null }[] }> {
  const addresses = await bagClient.findAddress(args.postcode, args.huisnummer, args.huisletter, args.toevoeging);
  if (addresses.length === 0) {
    const adres = `${args.postcode} ${args.huisnummer}${args.huisletter ?? ''}${args.toevoeging ? ' ' + args.toevoeging : ''}`;
    return { profile: emptyProfile(adres) };
  }
  const first = addresses[0];
  const vboPromise = bagClient.getVerblijfsobject(first.vboId);
  const epPromise = epOnlineClient.getByBagVboId(first.vboId);
  const pandPromise = vboPromise.then((vbo) => (vbo && vbo.pandLinks.length > 0 ? bagClient.getPand(vbo.pandLinks[0]) : null));
  const [vbo, labels, pand] = await Promise.all([vboPromise, epPromise, pandPromise]);
  const profile = buildProfile({
    matchStatus: addresses.length === 1 ? 'exact' : 'multiple_vbos',
    candidateCount: addresses.length,
    address: first,
    vbo,
    pand,
    label: selectBestLabel(labels),
    labelCount: labels.length,
  });
  const candidates =
    addresses.length > 1
      ? addresses.slice(0, MAX_CANDIDATES).map((a) => ({ adres: a.weergavenaam, huisletter: a.houseLetter, toevoeging: a.houseNumberAddition }))
      : undefined;
  return { profile, candidates };
}

/** The full response for one record: interpretation first, then derived, candidates, renamed fields. */
export function buildBestBuildingResponse(
  profile: ProfileCore,
  candidates?: { adres: string; huisletter: string | null; toevoeging: string | null }[]
) {
  const ctx = buildingCtx(profile);
  const { alerts, notes } = selectRules(BUILDING_RULES, ctx);
  const interpretation: Interpretation = { alerts, notes, constants: BUILDING_CONSTANTS };
  const derived: BuildingDerived | Record<string, never> = profile.matchStatus === 'not_found' ? {} : ctx.d;
  return {
    interpretation,
    derived,
    ...(candidates ? { candidates } : {}),
    ...renameBuildingProfile(profile),
  };
}

export function registerGetBuildingProfileBestTool(
  server: McpServer,
  bagClient: BagClientLike,
  epOnlineClient: EpOnlineClientLike
): void {
  server.registerTool(
    'get_building_profile',
    {
      title: 'Building Profile (BAG + Energy Label)',
      description: bestBuildingDescription,
      inputSchema: z.object({
        ...richInputSchema,
        postcode: richInputSchema.postcode.describe('Dutch postcode: 4 digits + 2 capital letters, no space. Example: "3543AR".'),
        huisnummer: richInputSchema.huisnummer.describe('House number, integer only. For "28A" pass 28 here and "A" as huisletter.'),
        huisletter: richInputSchema.huisletter.describe('House letter, e.g. "A" for 28A.'),
        toevoeging: richInputSchema.toevoeging.describe('House-number addition, e.g. "bis", "I", "II".'),
        queryIntent: richInputSchema.queryIntent.describe('The business question this call answers. Used for observability.'),
      }),
      outputSchema: bestBuildingOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args: { postcode: string; huisnummer: number; huisletter?: string; toevoeging?: string; queryIntent?: string }) => {
      const start = Date.now();
      try {
        const { profile, candidates } = await resolveBestBuilding(bagClient, epOnlineClient, args);
        const output = buildBestBuildingResponse(profile, candidates);
        await logToolCall({ args, start, status: 'success', rowCount: profile.candidateCount });
        return { structuredContent: output, content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_building_profile', variant: 'best', error: message });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return { content: [{ type: 'text' as const, text: `Error in get_building_profile: ${message}` }], isError: true };
      }
    }
  );
}
