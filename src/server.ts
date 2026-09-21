/**
 * MCP server factory — registers tools and returns an McpServer instance.
 *
 * The same factory is used by every transport entrypoint (stdio, HTTP),
 * so tool registration lives in exactly one place.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageJson from '../package.json' with { type: 'json' };
import { BagClient } from './clients/bag-client.js';
import { EpOnlineClient } from './clients/ep-online-client.js';
import {
  registerGetBuildingProfileTool,
  type BagClientLike,
  type EpOnlineClientLike,
} from './tools/get-building-profile.js';
import { registerGetBuildingProfileMinimalTool } from './tools/get-building-profile-minimal.js';
import { registerGetBuildingProfileWordsTool } from './tools/get-building-profile-words.js';
import { registerGetBuildingProfileInlineTool } from './tools/get-building-profile-inline.js';
import { registerGetBuildingProfileInlineConditionalTool } from './tools/get-building-profile-inline-conditional.js';
import { registerGetBuildingProfileSchemaTool } from './tools/get-building-profile-schema.js';
import { registerGetBuildingProfileOpaqueTool } from './tools/get-building-profile-opaque.js';
import { registerRenderChartTool } from './tools/render-chart.js';
import { registerRenderTableTool } from './tools/render-table.js';
import { registerRenderMapTool } from './tools/render-map.js';
import { registerFetchImageTool } from './tools/fetch-image.js';
import { registerGetWeatherContextTool } from './tools/get-weather-context.js';
import { registerGetToolCallLogTool } from './tools/get-tool-call-log.js';

const VERSION = packageJson.version;

/**
 * Which metadata tier to expose. See the paper "The Missing Layer":
 * - 'rich'    — the full strategy: dense schemas, curated alerts, interpretation guidance.
 * - 'words'   — the middle arm: identical prose and schemas to 'rich', but no computed
 *               alerts. Isolates what the WORDS buy from what the CAPABILITY adds.
 * - 'minimal' — the ablation: one-sentence description, no schema, no alerts. Same data,
 *               no layer.
 * - 'opaque'  — 'minimal' PLUS obfuscated field names. The minimal arm still ships the
 *               self-describing field names, which a model reads straight through, so it
 *               cannot measure what prose buys. This one removes that confound.
 * - 'opaque-words' — 'opaque' plus the interpretation guidance, keyed to the opaque codes.
 *               Identical in every other respect, so opaque → opaque-words isolates the
 *               guidance itself.
 */
/**
 * The metadata ladder. Each rung adds exactly ONE layer to the one before it, so
 * a difference between adjacent rungs is attributable:
 *
 *   minimal → schema → words → rich
 *     minimal  readable field names, one-sentence description, bare schema
 *     schema   + typed/described input & output schemas
 *     words    + the prose description (RETURNS / INTERPRETATION / ...)
 *     rich     + server-computed `alerts`, including the derived gas figure
 *
 * `opaque` and `opaque-words` are the orthogonal FIELD-NAMING axis: same payload
 * with the names stripped to terse codes, without and with the glossary.
 */
export type ServerVariant =
  | 'rich'
  | 'words'
  | 'inline'
  | 'inline-recipe'
  | 'inline-conditional'
  | 'words-recipe'
  | 'schema'
  | 'minimal'
  | 'opaque'
  | 'opaque-words';

export interface CreateServerOptions {
  /** Optional injected clients — useful for tests. Production code should omit these. */
  bagClient?: BagClientLike;
  epOnlineClient?: EpOnlineClientLike;
  /** Metadata tier. Default 'rich'. */
  variant?: ServerVariant;
}

/**
 * Server instructions for the rich and words tiers.
 *
 * ONE source of text for both arms: they differ by exactly the `alerts` bullet
 * and nothing else. Anything that diverges here is an uncontrolled variable in
 * the B->C comparison, so never fork this string — gate the change on
 * `includeAlerts` instead.
 */
function buildInstructions(includeAlerts: boolean): string {
  const usageAlertsBullet = includeAlerts
    ? '- Always read the `alerts` array — it contains bouwjaar-era warnings, Paris Proof ' +
        'threshold breaches, BENG compliance summaries, and (for residential) estimated gas ' +
        'consumption + warmtepomp-geschiktheidsindicatie.\n'
    : '';
  return (
        'You are connected to the metadata-demo MCP server — a demonstration of a ' +
        'rich-metadata strategy for AI tooling, applied at two levels at once:\n\n' +
        '1. RICH-DOMAIN TOOL — `get_building_profile` shows how dense tool metadata ' +
        '(input/output schemas, curated alerts, interpretation guidance) lets you reason ' +
        'about a domain (Dutch building data: BAG + EP-Online) without external priming.\n' +
        '2. SELF-DESCRIBING MCP APPS — `render_chart`, `render_table`, `render_map` apply ' +
        'the same approach to UI configuration. The schemas tell you which chart type fits ' +
        'which data shape, how cell formatters work, when to choose a stacked variant.\n\n' +
        'BUILDING-PROFILE TOOL:\n' +
        'This tool exposes Dutch building data from two open government registers:\n' +
        '- BAG (Basisregistratie Adressen en Gebouwen) via PDOK — postcode/huisnummer → ' +
        'bouwjaar, oppervlakte, gebruiksdoel, coordinates.\n' +
        '- EP-Online (RVO) — registered energielabels, EP-1/EP-2, warmtebehoefte, CO₂ emissie.\n\n' +
        'USAGE:\n' +
        '- Call `get_building_profile` with a Dutch postcode (e.g. "3543AR") and a huisnummer ' +
        '(integer only). Optionally include huisletter and/or toevoeging to disambiguate ' +
        'multi-unit buildings.\n' +
        usageAlertsBullet +
        '\n' +
        'RENDER TOOLS (MCP APPS):\n' +
        '- `render_chart` — render data as a chart (bar/line/pie/sankey/etc.). Read the ' +
        'schema descriptions to choose the right chart type for your data shape.\n' +
        '- `render_table` — render data as an interactive table with cell formatters ' +
        '(currency, dates, badges, icons).\n' +
        '- `render_map` — render geographic data on an interactive map with markers.\n' +
        '- `fetch_image` — server-side image proxy with SSRF protection (used by render_table ' +
        'for image cells when the host iframe CSP blocks external img-src).\n\n' +
        'WEATHER TOOL:\n' +
        '- `get_weather_context` — daily weather + degree-day/solar metrics for a Dutch location ' +
        'and date range (Open-Meteo). Demonstrates the Select mechanism: pass `select` to project ' +
        'daily records down to only the fields you need instead of the full row set.\n\n' +
        'OBSERVABILITY TOOL:\n' +
        '- `get_tool_call_log` — reads back recent tool calls (queryIntent, status, duration). Every ' +
        'other tool accepts a `queryIntent` param describing the business question it answers.\n\n' +
        'LIMITATIONS:\n' +
        '- This server returns a snapshot of public-register data and weather data only. It does ' +
        'not provide metered energy consumption or building automation data.\n' +
        '- EP-Online coverage is incomplete for older residential buildings — `energielabel: null` ' +
        'does not mean the building has no label, just that none is registered in EP-Online.\n\n' +
        'This server demonstrates the metadata strategy from the paper "The Missing Layer" ' +
        '(https://davidgolverdingen.nl/en/the-missing-layer). The tool descriptions below are ' +
        'the strategy in practice.'
  );
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const bagClient = options.bagClient ?? new BagClient();
  const epOnlineClient = options.epOnlineClient ?? new EpOnlineClient();
  const variant = options.variant ?? 'rich';

  if (variant === 'minimal') {
    // Deliberately bare: the SAME tool set as the rich tier, but every tool stripped to
    // minimal instructions (one-sentence descriptions, no rich guidance) and the domain
    // tool also stripped of its schema + alerts. Same tools, no metadata layer — so the
    // only variable versus the rich tier is the metadata itself.
    const server = new McpServer(
      { name: 'metadata-demo-minimal', version: VERSION },
      { instructions: 'Dutch building data lookup, plus chart/table/map rendering.' }
    );
    registerGetBuildingProfileMinimalTool(server, bagClient, epOnlineClient);
    registerRenderChartTool(server, { minimal: true });
    registerRenderTableTool(server, { minimal: true });
    registerRenderMapTool(server, { minimal: true });
    registerGetWeatherContextTool(server, { minimal: true });
    registerGetToolCallLogTool(server, { minimal: true });
    return server;
  }

  if (variant === 'opaque' || variant === 'opaque-words') {
    // A' and B'. Identical but for the tool description — see get-building-profile-opaque.ts.
    const withProse = variant === 'opaque-words';
    const server = new McpServer(
      { name: `metadata-demo-${variant}`, version: VERSION },
      { instructions: 'Dutch building data lookup, plus chart/table/map rendering.' }
    );
    registerGetBuildingProfileOpaqueTool(server, bagClient, epOnlineClient, { withProse });
    registerRenderChartTool(server, { minimal: true });
    registerRenderTableTool(server, { minimal: true });
    registerRenderMapTool(server, { minimal: true });
    registerGetWeatherContextTool(server, { minimal: true });
    registerGetToolCallLogTool(server, { minimal: true });
    return server;
  }

  if (variant === 'schema') {
    // One rung above minimal: the schemas are the ONLY thing that changes. Same
    // one-sentence tool description, same bare instructions, no alerts. The
    // render tools stay minimal too, so the building-profile schema is the sole
    // variable against `minimal`.
    const server = new McpServer(
      { name: 'metadata-demo-schema', version: VERSION },
      { instructions: 'Dutch building data lookup, plus chart/table/map rendering.' }
    );
    registerGetBuildingProfileSchemaTool(server, bagClient, epOnlineClient);
    registerRenderChartTool(server, { minimal: true });
    registerRenderTableTool(server, { minimal: true });
    registerRenderMapTool(server, { minimal: true });
    registerGetWeatherContextTool(server, { minimal: true });
    registerGetToolCallLogTool(server, { minimal: true });
    return server;
  }

  if (variant === 'inline' || variant === 'inline-recipe') {
    // The CHANNEL arm. Same one-sentence description and schemas as `schema`;
    // the INTERPRETATION prose rides in the RESPONSE instead of the description.
    // Render tools stay minimal so the building-profile tool is the sole variable,
    // exactly as in the `schema` branch it is compared against.
    const server = new McpServer(
      { name: `metadata-demo-${variant}`, version: VERSION },
      { instructions: 'Dutch building data lookup, plus chart/table/map rendering.' }
    );
    registerGetBuildingProfileInlineTool(server, bagClient, epOnlineClient, {
      withRecipe: variant === 'inline-recipe',
    });
    registerRenderChartTool(server, { minimal: true });
    registerRenderTableTool(server, { minimal: true });
    registerRenderMapTool(server, { minimal: true });
    registerGetWeatherContextTool(server, { minimal: true });
    registerGetToolCallLogTool(server, { minimal: true });
    return server;
  }

  if (variant === 'inline-conditional') {
    // Q2. As `inline`, but the response carries only the INTERPRETATION lines that
    // apply to the record: the matching berekeningstype branch, plus the notes for
    // fields that are actually populated. Same description, same schemas, same
    // render tools as `inline` — the only variable is how much of the prose ships.
    const server = new McpServer(
      { name: 'metadata-demo-inline-conditional', version: VERSION },
      { instructions: 'Dutch building data lookup, plus chart/table/map rendering.' }
    );
    registerGetBuildingProfileInlineConditionalTool(server, bagClient, epOnlineClient);
    registerRenderChartTool(server, { minimal: true });
    registerRenderTableTool(server, { minimal: true });
    registerRenderMapTool(server, { minimal: true });
    registerGetWeatherContextTool(server, { minimal: true });
    registerGetToolCallLogTool(server, { minimal: true });
    return server;
  }

  if (variant === 'words' || variant === 'words-recipe') {
    // Arm B: every word the rich tier has, none of the computation. Same
    // instructions, same tool surface — the ONLY difference from 'rich' is the
    // absent `alerts` field and the one bullet that would have promised it.
    const server = new McpServer(
      { name: `metadata-demo-${variant}`, version: VERSION },
      { instructions: buildInstructions(false) }
    );
    registerGetBuildingProfileWordsTool(server, bagClient, epOnlineClient, {
      withRecipe: variant === 'words-recipe',
    });
    registerRenderChartTool(server);
    registerRenderTableTool(server);
    registerRenderMapTool(server);
    registerFetchImageTool(server);
    registerGetWeatherContextTool(server);
    registerGetToolCallLogTool(server);
    return server;
  }

  const server = new McpServer(
    { name: 'metadata-demo', version: VERSION },
    {
      instructions:
        buildInstructions(true),
    }
  );

  registerGetBuildingProfileTool(server, bagClient, epOnlineClient);
  registerRenderChartTool(server);
  registerRenderTableTool(server);
  registerRenderMapTool(server);
  registerFetchImageTool(server);
  registerGetWeatherContextTool(server);
  registerGetToolCallLogTool(server);

  return server;
}
