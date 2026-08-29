/**
 * MCP server factory — registers tools and returns an McpServer instance.
 *
 * The same factory is used by every transport entrypoint (stdio, HTTP),
 * so tool registration lives in exactly one place.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BagClient } from './clients/bag-client.js';
import { EpOnlineClient } from './clients/ep-online-client.js';
import {
  registerGetBuildingProfileTool,
  type BagClientLike,
  type EpOnlineClientLike,
} from './tools/get-building-profile.js';
import { registerGetBuildingProfileMinimalTool } from './tools/get-building-profile-minimal.js';
import { registerRenderChartTool } from './tools/render-chart.js';
import { registerRenderTableTool } from './tools/render-table.js';
import { registerRenderMapTool } from './tools/render-map.js';
import { registerFetchImageTool } from './tools/fetch-image.js';
import { registerGetWeatherContextTool } from './tools/get-weather-context.js';
import { registerGetToolCallLogTool } from './tools/get-tool-call-log.js';

const VERSION = '1.3.0';

/**
 * Which metadata tier to expose. See the paper "The Missing Layer":
 * - 'rich'    — the full strategy: dense schemas, curated alerts, interpretation guidance.
 * - 'minimal' — the ablation: one-sentence description, no schema, no alerts. Same data,
 *               no layer. Deployed side-by-side so the two can be compared.
 */
export type ServerVariant = 'rich' | 'minimal';

export interface CreateServerOptions {
  /** Optional injected clients — useful for tests. Production code should omit these. */
  bagClient?: BagClientLike;
  epOnlineClient?: EpOnlineClientLike;
  /** Metadata tier. Default 'rich'. */
  variant?: ServerVariant;
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

  const server = new McpServer(
    { name: 'metadata-demo', version: VERSION },
    {
      instructions:
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
        '- Always read the `alerts` array — it contains bouwjaar-era warnings, Paris Proof ' +
        'threshold breaches, BENG compliance summaries, and (for residential) estimated gas ' +
        'consumption + warmtepomp-geschiktheidsindicatie.\n\n' +
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
        'the strategy in practice.',
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
