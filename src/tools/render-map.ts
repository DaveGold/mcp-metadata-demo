/**
 * MCP App tool: render_map
 *
 * Renders an interactive Leaflet map inline in the conversation.
 * Shows markers for company cars, customer buildings, projects, or custom pins.
 *
 * This is a pass-through tool — validates input, enforces payload limits,
 * and returns structuredContent for the Angular UI to render.
 *
 * @see ui/apps/utility/map/ for the Angular MCP App
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { getAuthExtra } from '../shared/auth.js';
import { requestContext } from '../shared/log-context.js';
import { writeToolCallLog } from '../shared/log-store.js';

// ── UI Resource ──────────────────────────────────────────────────────────────

export const RESOURCE_URI = 'ui://metadata-demo/map.html';

/**
 * Path to the Vite-built UI directory.
 * At runtime: build/servers/utility-tools/tools/render-map.js
 * UI output:  build/ui/utility-map.html
 */
const UI_DIR = path.resolve(import.meta.dirname, '..', '..', 'build', 'ui');

let cachedHtml: string | null = null;
async function getAppHtml(): Promise<string> {
  if (!cachedHtml) {
    const htmlPath = path.join(UI_DIR, 'map.html');
    try {
      cachedHtml = await fs.readFile(htmlPath, 'utf-8');
    } catch (err) {
      logger.error('render_map.missing_ui_artifact', {
        htmlPath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error(`Missing UI build artifact: ${htmlPath} — run "npm run build" first`, { cause: err });
    }
  }
  return cachedHtml;
}

// ── Description ──────────────────────────────────────────────────────────────

const description = `\
RETURNS:
Renders a fully interactive map inline in the conversation with clickable markers, popups, pan, zoom, and auto-fit.
Uses OpenStreetMap tiles loaded directly in the browser — the UI resource declares _meta.ui.csp.resourceDomains so the iframe can reach tile.openstreetmap.org.

WHEN TO USE:
- "toon op de kaart", "toon op map", "laat zien op kaart", "waar is/zijn/staat/staan", "plot op een map"
- "toon locatie(s)", "laat de positie(s) zien", "waar liggen", "kaart met", "map van"
- Vehicle positions → get_vehicle_positions → render_map
- Project locations → get_project or search_projects → render_map
- Building locations → get_building_profile → render_map
- Multiple locations for comparison ("toon alle projecten in Amsterdam op de kaart")
- Any question that benefits from geographic/spatial context
- ALWAYS use this tool when the user mentions "kaart", "map", "locatie", "positie" in combination with data

WHEN NOT TO USE:
- Single address without visual context → respond with text
- User wants tabular data with coordinates → use render_table
- No coordinates available yet → fetch data first, THEN call render_map

QUERY STRATEGY:
1. Fetch data from the relevant data tool (get_vehicle_positions, get_project, get_building_profile, search_projects, etc.)
2. Extract lat/lng, names, and relevant details
3. Transform into markers[] with lat, lng, label, description, type
4. Call render_map — NEVER pass raw API responses, always reshape first
If the data source doesn't include coordinates, use get_building_profile (postcode → lat/lng) to geocode.

OUTPUT EFFICIENCY (important — tool-call payloads are user-visible and expensive to stream):
- Pass the markers directly as the "markers" argument. Do NOT print/echo the JSON to chat or to stdout in an analysis step first.
- Prefer POSITIONAL marker rows over keyed objects for any dataset >10 markers. "markers" accepts TWO shapes:
    Positional (preferred): [[lat, lng, label, description?, type?, color?], ...]  — values in this fixed order
    Keyed objects (fine for small sets): [{lat, lng, label, description, type, color}, ...]
  Positional cuts ~40-50% off per-marker tokens by omitting the repeated keys. Use it by default; fall back to keyed objects only when you have <5 markers and prefer the self-documenting shape.
- Omit trailing fields you don't need. In the positional form a marker can be as short as [lat, lng, label] — description/type/color default to undefined.
- Only set "type" when it differs from the marker's natural domain (car / building / project). Omit for generic pins.
- Only set "color" to override the default type color. Leave it off when the default is fine.

INTERPRETATION:
Marker type selection:
| Data shape | Marker type | Example |
| vehicle/fleet positions with lat/lng | car | GPS positions, real-time tracking |
| buildings / addresses | building | building profiles, asset locations |
| project sites | project | construction or service-project locations |
| anything else | pin | generic locations |

Example patterns:
- Single building: a building-profile tool → render_map with one marker of type=building
- Building portfolio: multiple addresses → render_map with markers[type=building], one per address
- Project locations: a project-search result → render_map with markers[type=project]
- Mixed: combine building + project + car markers in one call when comparing them spatially
- Real-time fleet: each marker carries lat/lng + speed/driver/timestamp metadata in the description field

RELATED TOOLS:
- render_chart — for data visualization (complementary: map for geographic context, chart for numeric insight)
- render_table — for tabular data with sorting/filtering

ALERTS:
Maximum 500 markers. Pre-filter or aggregate before passing large datasets.
Coordinates must be valid: latitude -90 to 90, longitude -180 to 180.
Netherlands coordinates are roughly: lat 50.7-53.6, lng 3.3-7.2.`;

// ── Input schema ─────────────────────────────────────────────────────────────
// Raw Zod shape (NOT z.object()) — required by registerAppTool

const inputSchema = {
  markers: z
    .union([
      z.array(
        z.object({
          lat: z.number().describe('Latitude (WGS84). Netherlands range: 50.7–53.6.'),
          lng: z.number().describe('Longitude (WGS84). Netherlands range: 3.3–7.2.'),
          label: z
            .string()
            .describe(
              'Marker popup title. Use the language of the conversation (e.g. "Van #12-AB-34", "Office building", "Project ABC").'
            ),
          description: z
            .string()
            .optional()
            .describe(
              'Popup body text. Supports simple HTML (<br>, <b>, <i>). ' +
                'Use for details like address, project number, driver name, energy label, status. ' +
                'Example: "Driver: Jane Doe<br>Speed: 65 km/h<br>Last update: 14:32"'
            ),
          type: z
            .enum(['car', 'building', 'project', 'pin'])
            .optional()
            .describe(
              'Marker icon type:\n' +
                '- car: vehicle icon (blue) — fleet positions\n' +
                '- building: building icon (green) — buildings / addresses\n' +
                '- project: construction icon (petrol) — project sites\n' +
                '- pin: default pin icon (blue) — anything else\n' +
                'Default: pin'
            ),
          color: z
            .string()
            .optional()
            .describe('Custom marker color (hex, e.g. "#e82b21"). Overrides the default type color.'),
        })
      ),
      // Positional tuple with typed first three slots (lat/lng/label). Trailing
      // slots (description/type/color) stay as z.unknown so valid shorter rows
      // like [lat, lng, label] still parse; normalizeMarkers() handles the
      // optional slots and validates them before rendering.
      z.array(z.tuple([z.number(), z.number(), z.string()]).rest(z.unknown())),
    ])
    .describe(
      'Array of markers to place on the map. Two accepted shapes:\n' +
        '1. Array of ARRAYS (positional, preferred for >10 markers — ~40-50% smaller payload):\n' +
        '   [[lat, lng, label, description?, type?, color?], ...]  — values in this fixed order. Trailing fields may be omitted.\n' +
        '   Example: [[52.09, 5.11, "Utrecht hub"], [52.37, 4.90, "Amsterdam", "Hoofdkantoor", "building"]]\n' +
        '2. Array of OBJECTS (keyed, fine for small sets):\n' +
        '   [{lat, lng, label, description?, type?, color?}, ...]\n' +
        'Each marker has a position (lat/lng), label, and optional description/type/color. Maximum 500 markers.'
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Map title displayed above the map. Use Dutch, concise (e.g. "Bedrijfswagens positie", "Projectlocaties Utrecht").'
    ),
  center: z
    .object({
      lat: z.number().describe('Center latitude.'),
      lng: z.number().describe('Center longitude.'),
    })
    .optional()
    .describe(
      'Manual map center. Default: auto-fit to show all markers. ' +
        'Only set when you want a specific view (e.g. centered on Utrecht: {lat: 52.09, lng: 5.11}).'
    ),
  zoom: z
    .number()
    .optional()
    .describe(
      'Zoom level 1-18. Default: auto-fit to show all markers. ' +
        'Guide: 6=country, 10=province, 13=city, 16=street, 18=building. ' +
        'Only set together with center for a specific view.'
    ),
  height: z
    .number()
    .optional()
    .describe('Map height in pixels. Default: 500. Use 400 for compact views, 600 for detail-rich maps.'),
};

// ── Types ────────────────────────────────────────────────────────────────────

interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  description?: string;
  type?: string;
  color?: string;
}

interface MapArgs {
  markers: MapMarker[] | unknown[][];
  title?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
}

/**
 * Normalize markers to the keyed MapMarker[] shape regardless of which input
 * form the agent used. Positional rows map by fixed position:
 *   [lat, lng, label, description?, type?, color?]
 *
 * Keeps downstream (lat/lng bounds check, marker count validation, UI
 * rendering) uniform — all consumers see MapMarker[].
 */
function normalizeMarkers(raw: MapMarker[] | unknown[][]): MapMarker[] {
  if (raw.length === 0) return [];
  const first = raw[0];
  if (!Array.isArray(first)) return raw as MapMarker[];
  return (raw as unknown[][]).map((row) => ({
    lat: row[0] as number,
    lng: row[1] as number,
    label: (row[2] as string) ?? '',
    description: row[3] as string | undefined,
    type: row[4] as string | undefined,
    color: row[5] as string | undefined,
  }));
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerRenderMapTool(server: McpServer): void {
  // Register the ui:// resource (serves the Vite-built Angular app)
  registerAppResource(server, 'Map App', RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [
      {
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await getAppHtml(),
        // CSP allow-list per MCP Apps spec (McpUiResourceCsp). resourceDomains
        // maps to img-src, letting the iframe load OSM tiles directly from the
        // OSM origin — no server-side proxy needed.
        _meta: {
          ui: {
            csp: {
              resourceDomains: ['https://tile.openstreetmap.org'],
            },
          },
        },
      },
    ],
  }));

  // Register the tool with MCP App UI metadata
  registerAppTool(
    server,
    'render_map',
    {
      title: 'Kaart weergeven',
      description,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: MapArgs, extra: { authInfo?: AuthInfo }) => {
      const start = Date.now();
      let auth: { email: string; userId: string; roles: string[] } | null = null;

      try {
        auth = getAuthExtra(extra.authInfo);

        // Normalize positional rows to keyed objects before any validation.
        const markers = normalizeMarkers(args.markers);

        // ── Validate marker count ────────────────────────────────────
        if (markers.length > 500) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Too many markers (${markers.length}). Maximum 500. Pre-filter or aggregate before calling render_map.`,
              },
            ],
            isError: true,
          };
        }

        // ── Validate empty markers ───────────────────────────────────
        if (markers.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No markers provided. Add at least one marker with lat, lng, and label.',
              },
            ],
            isError: true,
          };
        }

        // ── Validate coordinates ─────────────────────────────────────
        for (const marker of markers) {
          if (typeof marker.lat !== 'number' || marker.lat < -90 || marker.lat > 90) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Invalid latitude ${marker.lat} for marker "${marker.label}". Must be a number between -90 and 90.`,
                },
              ],
              isError: true,
            };
          }
          if (typeof marker.lng !== 'number' || marker.lng < -180 || marker.lng > 180) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Invalid longitude ${marker.lng} for marker "${marker.label}". Must be a number between -180 and 180.`,
                },
              ],
              isError: true,
            };
          }
        }

        await logToolCall({ auth, args: { ...args, markers }, start, status: 'success' });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Map rendered: ${markers.length} marker(s) — "${args.title ?? 'Untitled'}"`,
            },
          ],
          // Pass the normalized keyed shape to the UI so it doesn't need to
          // re-implement the same conversion client-side.
          structuredContent: { ...args, markers },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('tool.error', {
          tool: 'render_map',
          connector: 'RenderMap',
          user: auth?.email ?? 'unknown',
          userId: auth?.userId ?? 'unknown',
          error: errorMessage,
          durationMs: Date.now() - start,
        });

        await logToolCall({ auth, args, start, status: 'error' });

        return {
          content: [{ type: 'text' as const, text: `Error in render_map: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

async function logToolCall({
  auth,
  args,
  start,
  status,
}: {
  auth: { email: string; userId: string; roles: string[] } | null;
  args: MapArgs;
  start: number;
  status: 'success' | 'error';
}): Promise<void> {
  const ctx = requestContext.getStore();
  if (ctx) {
    await writeToolCallLog({
      sessionId: ctx.sessionId,
      environment: ctx.environment,
      server: 'utility-tools',
      user: auth?.email ?? 'unknown',
      userId: auth?.userId ?? 'unknown',
      tool: 'render_map',
      connector: 'RenderMap',
      queryIntent: args.title ?? `map-${args.markers.length}-markers`,
      filters: [],
      filterCount: 0,
      summaryOnly: false,
      skip: 0,
      take: 0,
      status,
      rowCount: args.markers.length,
      hasMore: false,
      durationMs: Date.now() - start,
      errorType: status === 'error' ? 'ToolError' : null,
    });
  }
}
