/**
 * MCP App tool: render_table
 *
 * Renders interactive TanStack Table v9 tables inline in the conversation.
 * Supports sorting, filtering, pagination, row selection, column visibility,
 * cell formatting (numbers, currency, dates, percentages, booleans, badges),
 * and footer aggregation.
 *
 * This is a pass-through tool — validates input, enforces payload limits,
 * and returns structuredContent for the Angular UI to render.
 *
 * @see ui/apps/table/ for the Angular MCP App
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

export const RESOURCE_URI = 'ui://metadata-demo/table.html';

/**
 * Path to the Vite-built UI directory.
 * At runtime: dist/tools/render-table.js
 * UI output:  build/ui/table.html
 */
const UI_DIR = path.resolve(import.meta.dirname, '..', '..', 'build', 'ui');

let cachedHtml: string | null = null;
async function getAppHtml(): Promise<string> {
  if (!cachedHtml) {
    const htmlPath = path.join(UI_DIR, 'table.html');
    try {
      cachedHtml = await fs.readFile(htmlPath, 'utf-8');
    } catch (err) {
      logger.error('render_table.missing_ui_artifact', {
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
Renders an interactive data table inline in the conversation with sortable columns,
optional filtering, pagination, row selection, and column visibility toggles.
Supports cell formatting: numbers, currency (€), dates, percentages, booleans (✓/✗),
and colored badges for status fields. Footer aggregation (sum, avg, count, min, max).

WHEN TO USE:
- User asks for a table, overview, or list view of data
- Displaying individual records with multiple fields
- User needs to sort, filter, or browse through records
- Data has mixed types (text + numbers + dates + statuses) in one view
- Follow-up to a chart: "show the underlying data" → render_table with the same dataset
- Comparing records side by side
- Presenting structured key-value pairs or compact summaries — even 5-10 rows benefit from proper formatting (currency, dates, percentages, badges) over plain markdown tables
- ALWAYS prefer render_table over markdown tables. Markdown tables lack number formatting, sorting, and visual hierarchy. Use render_table for ANY structured data presentation.

WHEN NOT TO USE:
- Data has 1-2 columns only → respond with a text list
- Visual trends or comparisons → use render_chart
- Single aggregate answer ("total hours?") → respond with text + call render_chart if visualization helps
- You need to fetch data first → call the appropriate data tool THEN pass results here
- More than 500 rows → pre-aggregate (group by, top-N) or filter before calling

QUERY STRATEGY:
1. Fetch data from the relevant data source
2. Limit to ≤500 rows (use filters, take/skip, or small date ranges)
3. Extract the specific fields you need into columns[] + data[]
4. Choose column types for proper formatting (currency for money, date for timestamps, badge for statuses)
5. Enable features based on data size: filtering/globalSearch for >50 rows, compact density for >10 columns
NEVER pass raw API responses — extract, set proper column types, and choose column headers in the language of the conversation.

OUTPUT EFFICIENCY (important — tool-call payloads are user-visible and expensive to stream):
- Pass the records directly as the "data" argument. Do NOT print/echo the JSON to chat or to stdout in an analysis step first — that doubles the tokens for no gain.
- Prefer POSITIONAL rows over keyed objects for any dataset larger than ~20 rows. "data" accepts TWO shapes:
    Positional (preferred): data = [["3451","André","andre@x.nl"], ["3452","Jane","jane@x.nl"]]  — values match the order of columns[]
    Keyed (fine for tiny tables):  data = [{"id":"3451","name":"André","email":"andre@example.com"}]
  The positional form cuts ~40% off per-row tokens by omitting the repeated keys. Use it by default; only fall back to keyed objects when the dataset is tiny (<10 rows) and readability in the request payload matters more than size.
- Only set "type" on columns that need non-text formatting. Plain string fields (names, addresses, free text) can omit "type" — the default is text.
- Only include "badgeMap", "formatConfig", "iconMap", "ratingConfig", etc. on the specific column that needs it. Do not add these "just in case" on every column.
- Auto-formatting in text columns (the default): the renderer auto-detects and formats these value shapes, so send the plain string — no type, no wrapping:
  - Emails ("foo@example.com") render as clickable mailto links.
  - Http(s) URLs render as clickable links.
  - ISO dates ("2025-03-14" or full timestamps) render as nl-NL dates.
  Only set type: "date" / use "link" with {label, href} when the label differs from the URL or you need a non-default target.
- Link-column shorthand: in a type: "link" column, you can send a plain email or URL string — the renderer prepends "mailto:" / "https://" automatically. No {label, href} object needed unless label ≠ value.

DATA VALUE SHAPES (per column type — send the SIMPLEST value that fits; column-level config does the styling):
  text / number / currency / percentage / date / boolean   → scalar (string / number / boolean)
  badge                                                     → scalar value; badgeMap on the column maps it to label + color  (e.g. value "active" + badgeMap {active:{color:"green", label:"Active"}})
  icon                                                      → scalar value; iconMap on the column maps it to icon + color
  multi_badge                                               → ARRAY of scalars (string[]); badgeMap maps each element      (e.g. ["priority","external"])
  progress                                                  → number 0..1; progressConfig.thresholds colors the bar
  rating                                                    → number; ratingConfig.max defines the scale
  sparkline                                                 → number[] (intrinsically per-row — each row's time series)
  link                                                      → plain email or URL string (shorthand); OR {label, href} only when label ≠ value
  image                                                     → URL string (http(s) or data:image/*)
  trend                                                     → {value, delta} object — both numbers, intrinsically per-row
Cells in a single positional row can mix scalars and objects as their column type requires. Example row for columns [id, name, email, trend, status]: ["3451", "André", "andre@example.com", {"value": 120000, "delta": 0.08}, "active"]. Only the trend cell needs an object — everything else is scalar. Define color/label/threshold/scale metadata ONCE on the column (badgeMap, iconMap, progressConfig, ratingConfig, trendConfig) and let the renderer apply it across all rows.

INTERPRETATION:
Column type selection — pick the most specific type that fits the value, and read the "Pick instead of" hints when two types look similar:
| Data shape | Column type | Example | Pick instead of |
| money amounts | currency | revenue, cost, invoice amount | number (currency adds € prefix + locale separators) |
| counts, hours, km | number | hours, count, distance | text (number enables numeric sort + footer aggregation) |
| ratios (0..1) | percentage | margin, coverage, success rate | progress (percentage is pure numeric, progress has a visual bar with thresholds) |
| progress with threshold colors (0..1) | progress | budget spent, maintenance progress, capacity utilisation, compliance score (invertColors=true) | percentage (use progress when threshold color guides the reader's eye) |
| dates (ISO) | date | start date, invoice date, event date | text (date parses + formats per locale; text doesn't) |
| yes/no | boolean | approved, active, paid | badge (boolean is 2-state; badge is 3+ states) |
| statuses, types, categories (enum) | badge + badgeMap | status, item type, classification | text / multi_badge (badge is single-value enum; multi_badge for arrays) |
| single iconic indicator | icon + iconMap | health (green/red/grey arrow), compliance (shield-check), trend arrow on a single numeric field | badge (icon is purely visual, badge shows text) |
| time series per row (number[]) | sparkline | consumption trend over 12 months, incident trend, hours trend per employee | render_chart (sparkline is per-row inline; render_chart is one chart for all rows) |
| value + period delta | trend ({value, delta}) | consumption YoY, cost MoM, revenue delta | two separate columns value + percentage (trend co-renders with arrow + color) |
| multiple tags per row (string[]) | multi_badge + badgeMap | feature tags, certifications | concatenated text (multi_badge gives per-tag color + wrapping) |
| clickable URL | link ({label, href}) | record link, contact email, external report | text (link navigates; text shows URL as text) |
| bounded score on fixed scale | rating + ratingConfig | condition 0..6 (shape=dots, max=6), SLA 1..5 stars, satisfaction score | number (rating visualizes a fixed scale; number is for unbounded counts) |
| photo / QR / avatar (URL) | image + imageConfig | thumbnail, type plate, QR code, profile photo | text (image shows the thumbnail; text shows the URL) |
| rest | text | name, address, description, email as text | — |

Feature selection:
| Scenario | Recommended features |
| Quick overview (<20 rows) | sorting only, no pagination, comfortable density |
| Standard data table (20-100 rows) | sorting + pagination (pageSize 25), normal density |
| Data-heavy analysis (100-500 rows) | sorting + filtering + globalSearch + pagination, compact density |
| Selection for action | add selection=true (adds checkbox column) |
| Wide table (>8 columns) | add columnVisibility=true |

Example patterns (composition guidance — adapt to your data):
- Key-value summary: columns [Attribute(text), Value(text)], pagination=false — e.g. a building profile shown as 8-15 attribute rows
- Records overview: columns [Id(text), Name(text), Amount(currency), Date(date), Status(badge)], sorting=true, footer sum on Amount
- Wide analysis table: columns include sparkline (per-row time series), rating (bounded score), trend ({value, delta}) — pair with filtering=true and compact density
- Portfolio layout: columns [Image(image), Name(link), Address(text), Progress(progress, thresholds 0.7/0.9), Rating(rating, max=5), Status(badge)]
- External links: columns include a link-type column when an ID should navigate to another system

RELATED TOOLS:
- render_chart — for visual trends, comparisons, compositions (complementary: often useful to show both chart + table of the same data)
- render_map — for geographic context (complementary: table for detail, map for spatial overview)

ALERTS:
Maximum 500 rows. Always set column types for proper formatting — default "text" loses number sorting and currency display.
Do not combine footer aggregation with pagination — the footer shows totals across ALL rows, which is confusing when only a subset is visible. Use footer only when all rows fit on one page (pagination=false or dataset ≤ pageSize).`;

// ── Input schema ─────────────────────────────────────────────────────────────
// Raw Zod shape (NOT z.object()) — required by registerAppTool

const inputSchema = {
  columns: z
    .array(
      z.object({
        key: z
          .string()
          .describe(
            'Property key in each data row object. Must match exactly (case-sensitive). E.g. "id", "name", "amount".'
          ),
        header: z
          .string()
          .describe(
            'Column header text shown to the user. Use the language of the conversation (e.g. "Name", "Project", "Amount (€)").'
          ),
        type: z
          .enum([
            'text',
            'number',
            'currency',
            'date',
            'percentage',
            'boolean',
            'badge',
            'icon',
            'sparkline',
            'progress',
            'trend',
            'multi_badge',
            'link',
            'rating',
            'image',
          ])
          .optional()
          .default('text')
          .describe(
            'Data type — determines formatting, sorting behavior, and default alignment. Each type also says WHEN TO PICK IT vs a similar type so the column stays single-purpose:\n' +
              '- text: plain string. Left-aligned, alphabetic sort. Default fallback — pick anything more specific if the value has structure (number, date, URL, bounded score, etc.).\n' +
              '- number: nl-NL locale formatting (1.234,56). Right-aligned, numeric sort. Data: a raw number. Pick over text for anything countable (uren, km, aantallen). Note: years as number get thousand separators ("2.014") — use text for year columns.\n' +
              '- currency: € nl-NL formatting (€ 1.234,56). Right-aligned. Data: a raw number. Pick over number for any euro amount (omzet, kosten, factuurbedrag, begroting).\n' +
              '- date: dd-MM-yyyy via Intl.DateTimeFormat nl-NL. Left-aligned. Data: ISO date string (YYYY-MM-DD) or ISO datetime. Pick over text for any datum field.\n' +
              '- percentage: value 0..1 shown as percentage ("0.15" → "15,0%"). Right-aligned. Data: number in [0, 1]. Pick over progress for pure numeric presentation (marge, dekking). Pick progress instead when you want a visual bar with threshold coloring.\n' +
              '- boolean: true → ✓ (green), false → ✗ (red). Center-aligned. Data: true/false. Pick over badge for pure ja/nee (geaccordeerd, actief, doorbelast). Pick badge when you have more than two states.\n' +
              '- badge: colored pill. Center-aligned. Data: a string key; requires badgeMap. Pick over text for any enumerated status/type/category. Pick multi_badge when multiple tags apply per row.\n' +
              '- icon: single Heroicon. Center-aligned. Data: the icon name (or a key looked up in iconMap). Pick over badge when the value is inherently iconic (health indicator, compliance check, direction). Pick boolean for plain ja/nee.\n' +
              '- sparkline: inline trend mini-chart (80×24 SVG). Center-aligned. Data: number[] (e.g. 12 monthly values, ideally 2–60 points). Sortable on last/avg/min/max via sparklineConfig.sortBy. Pick over rendering render_chart next to the table when the trend is a per-row attribute (consumption trend per building, incident trend per asset). Pick render_chart when you have one shared trend across rows, not one per row.\n' +
              '- progress: filled horizontal bar 0–100% with numeric label. Left-aligned. Data: number in [0, 1]. Thresholds (default: green <70%, orange 70–90%, red >90%) via progressConfig.thresholds. For up-is-good metrics (compliance score, voortgang) set progressConfig.invertColors=true. Pick over percentage when threshold emphasis matters (budget besteed, voortgang, capaciteit). Pick percentage for analytical figures (marge, dekking).\n' +
              '- trend: value + directional arrow + signed delta ("€ 1.234 ▲ +12,0%"). Right-aligned. Data: { value: number, delta: number, direction?: "up"|"down"|"flat" } — direction is inferred from delta sign if omitted; delta is a fraction (0.12 = +12,0%). Default colors: up=red/down=green (correct for verbruik, kosten, storingen — rising is bad). Set trendConfig.invertColors=true when rising is good (omzet, marge, Paris-Proof progress). Pick over two separate columns (value + delta%) when the pair should be read together and space is tight.\n' +
              '- multi_badge: multiple colored pills per cell, flex-wrapped. Left-aligned. Data: string[] (array of keys). Reuses the same badgeMap as badge — no separate map needed. Global search matches any label. Pick over concatenated text ("priority | external | urgent") when users benefit from per-tag color. Pick over separate columns when the tags are a variable-length set that belongs together (attributes, systems, certifications).\n' +
              '- link: clickable navigation. Left-aligned. Data: a string (used as both label and href) OR { label: string, href: string }. Safe schemes only: http(s) and mailto — anything else renders as plain text (no javascript:, no data:). Opens in new tab by default (linkConfig.target="_self" to override). Pick over text when the user should navigate (record URL, contact email, external report). Pick text when the URL is reference-only or when the destination is another row in the same table.\n' +
              '- rating: filled/half/empty glyphs (★/★½/☆ or ●/◐/○). Center-aligned. Data: a number — HALF-GLYPHS SUPPORTED, values snap to nearest 0.5 via Math.round(n*2)/2 (3.4 → 3½, 3.5 → 3½, 7.6 → 7½). Configure max (default 5; common scales: 5 for sterren, 6 for Conditie-dots, 10 for 0..10 waarderingen), shape ("stars" | "dots"), color via ratingConfig. Sorts numerically. Pick over number when the value is a bounded, fixed-scale score. Pick number when the count is unbounded.\n' +
              '- image: thumbnail (default 32×32). Center-aligned. Data: a string URL — http(s) or data:image/*. External http(s) URLs are fetched server-side via the fetch_image companion tool (bypasses iframe CSP, first-load delay, 2MB cap, allowed MIMEs: jpeg/png/webp/gif/svg+xml). data:image/* URLs render directly. URLs with other schemes, broken responses, or blocked hosts render as a grey placeholder. Configure size/shape/alt via imageConfig. Not sortable by default. Pick over text for foto, typeplaatje-thumbnail, avatar, QR-code. Pick text when the URL is display-only.'
          ),
        align: z
          .enum(['left', 'center', 'right'])
          .optional()
          .describe(
            'Override default alignment. Defaults: text/date/multi_badge/link/progress=left, number/currency/percentage/trend=right, boolean/badge/icon/sparkline/rating/image=center.'
          ),
        width: z
          .string()
          .optional()
          .describe('CSS column width (e.g. "200px", "30%", "minmax(100px, 1fr)"). Default: auto.'),
        sortable: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether this column can be sorted by clicking the header. Default: true.'),
        filterable: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            'Whether this column shows a filter input in the header. Default: true when features.filtering=true.'
          ),
        badgeMap: z
          .record(
            z.string(),
            z.object({
              label: z.string().optional().describe('Display text. Omit to use the raw value.'),
              color: z
                .enum(['green', 'red', 'yellow', 'blue', 'gray', 'orange'])
                .describe(
                  'Badge color. green=success/active, red=error/critical, yellow=warning/pending, blue=info, gray=inactive, orange=attention.'
                ),
            })
          )
          .optional()
          .describe(
            'Value-to-badge mapping. Only for type=badge. Keys are the raw data values, values define display.\n' +
              'Example: {"actief": {"color": "green"}, "storing": {"color": "red"}, "onderhoud": {"color": "yellow"}}'
          ),
        iconMap: z
          .record(
            z.string(),
            z.object({
              icon: z
                .string()
                .describe(
                  'Heroicon name (kebab-case). E.g. "check-circle", "bolt", "arrow-trending-up", "exclamation-triangle".'
                ),
              color: z
                .enum(['green', 'red', 'yellow', 'blue', 'gray', 'orange', 'primary'])
                .optional()
                .describe('Icon color. Omit for default text color (inherits from row).'),
              label: z.string().optional().describe('Tooltip or screen reader label. Omit to use the raw value.'),
            })
          )
          .optional()
          .describe(
            'Value-to-icon mapping. Only for type=icon. Keys are the raw data values, values define which icon + color to render.\n' +
              'Example: {"true": {"icon": "check-circle", "color": "green"}, "false": {"icon": "x-circle", "color": "red"}}\n' +
              'Example: {"up": {"icon": "arrow-trending-up", "color": "green"}, "down": {"icon": "arrow-trending-down", "color": "red"}, "stable": {"icon": "arrow-path", "color": "gray"}}\n' +
              'If omitted, the data value itself is used as the icon name (e.g. data value "bolt" renders the bolt icon).\n' +
              'Available icons: check, x-mark, check-circle, x-circle, exclamation-triangle, exclamation-circle, information-circle, shield-check, ' +
              'building-office, currency-euro, calculator, document-text, chart-bar, chart-pie, calendar, clock, ' +
              'user, user-group, truck, map-pin, wrench, cog-6-tooth, ' +
              'bolt, bolt-slash, fire, sun, globe-europe-africa, arrow-trending-up, arrow-trending-down, ' +
              'eye, eye-slash, star, tag, arrow-down-tray, arrow-path, funnel, magnifying-glass'
          ),
        sparklineConfig: z
          .object({
            color: z
              .enum(['green', 'red', 'yellow', 'blue', 'gray', 'orange', 'primary'])
              .optional()
              .describe('Line color. Defaults to primary (Warmteblauw).'),
            sortBy: z
              .enum(['last', 'avg', 'min', 'max'])
              .optional()
              .describe('Which aggregate to sort by when the column header is clicked. Default: last.'),
          })
          .optional()
          .describe(
            'Config for type=sparkline. Only meaningful when type=sparkline.\n' +
              'Data value must be number[] — 2+ points, ≤60 recommended. Non-number entries are skipped; fewer than 2 valid points renders nothing.\n' +
              'Example config: {"color": "red", "sortBy": "last"}\n' +
              'Example cell value: [0,1,0,2,3,2,4,5,6,5,7,8]'
          ),
        progressConfig: z
          .object({
            thresholds: z
              .object({
                warn: z.number().describe('Value above this turns orange (0..1).'),
                danger: z.number().describe('Value above this turns red (0..1).'),
              })
              .optional()
              .describe('Custom thresholds. Defaults: warn=0.7, danger=0.9.'),
            invertColors: z
              .boolean()
              .optional()
              .describe(
                'Flip color semantics: false (default) = low is good (e.g. budget-besteed, resource usage); true = high is good (e.g. compliance-score, voortgang).'
              ),
          })
          .optional()
          .describe(
            'Config for type=progress. Only meaningful when type=progress.\n' +
              'Data value must be a number in [0, 1] (same shape as percentage). Values outside the range are clamped. Non-numbers render nothing.\n' +
              'Default thresholds (warn=0.7, danger=0.9) assume "up is bad" (e.g. budget-besteed, capaciteitsbenutting). Flip with invertColors=true when "up is good" (e.g. compliance-score, voortgang).\n' +
              'Example config (default up-is-bad): {"thresholds": {"warn": 0.7, "danger": 0.9}, "invertColors": false} — used for Budget besteed\n' +
              'Example config (up-is-good): {"thresholds": {"warn": 0.5, "danger": 0.3}, "invertColors": true} — used for Voortgang (below 30% is red)\n' +
              'Example cell value: 0.88'
          ),
        trendConfig: z
          .object({
            valueType: z
              .enum(['number', 'currency', 'percentage'])
              .optional()
              .describe('Formatting of the main value. Default: number.'),
            invertColors: z
              .boolean()
              .optional()
              .describe(
                'Flip color semantics: false (default) = up is bad (verbruik, kosten, storingen: rising = red); true = up is good (omzet, marge: rising = green).'
              ),
          })
          .optional()
          .describe(
            'Config for type=trend. Only meaningful when type=trend.\n' +
              'Data value must be { value: number, delta: number, direction?: "up"|"down"|"flat" }. Delta is a fraction (0.12 = +12,0%). Direction auto-inferred from delta sign if omitted (>0 = up, <0 = down, ~0 = flat).\n' +
              'Default colors: up=red, down=green — correct for metrics where rising is bad (verbruik, kosten, storingen, achterstand). Set invertColors=true for metrics where rising is good (omzet, marge, Paris-Proof-voortgang, tevredenheid).\n' +
              'Example config (up-is-bad): {"valueType": "number", "invertColors": false} — used for Verbruik YoY\n' +
              'Example config (up-is-good): {"valueType": "currency", "invertColors": true} — used for Omzet YoY\n' +
              'Example cell value: {"value": 184500, "delta": -0.08}'
          ),
        linkConfig: z
          .object({
            target: z
              .enum(['_blank', '_self'])
              .optional()
              .describe('Link target. Default: _blank (opens new tab with rel=noopener).'),
          })
          .optional()
          .describe(
            'Config for type=link. Only meaningful when type=link.\n' +
              'Data value (preferred shorthand): a plain string — used as both label AND href. Bare emails get "mailto:" prepended; bare "www." hostnames get "https://" prepended. Use this whenever label == value.\n' +
              'Data value (explicit): { label: string, href: string } — ONLY when label ≠ href (e.g. show "G240286 Vitrum" but navigate to a long URL). Unsafe schemes (javascript:, data:, file:) render as plain text.\n' +
              'Default target="_blank" opens in a new tab with rel=noopener. Use "_self" only when navigation within the same tab is intended.\n' +
              'Example config: {"target": "_blank"}\n' +
              'Example cell value (shorthand, URL): "https://example.com/record/12345"\n' +
              'Example cell value (shorthand, email): "person@example.com"  // → mailto link\n' +
              'Example cell value (explicit): {"label": "Record #12345", "href": "https://example.com/record/12345"}'
          ),
        ratingConfig: z
          .object({
            max: z
              .number()
              .optional()
              .describe(
                'Maximum value (number of glyphs). Common: 5 (sterren), 6 (Conditie dots), 10 (0..10 waarderingsschaal). Default: 5.'
              ),
            shape: z.enum(['stars', 'dots']).optional().describe('Glyph shape. Default: stars.'),
            color: z
              .enum(['yellow', 'primary', 'green', 'red', 'gray', 'orange'])
              .optional()
              .describe('Fill color. Default: yellow.'),
          })
          .optional()
          .describe(
            'Config for type=rating. Only meaningful when type=rating.\n' +
              'Data value is a number. HALF-GLYPHS ARE SUPPORTED: values snap to the nearest 0.5 via Math.round(n*2)/2, so 3.4 renders as 3½, 3.5 renders as 3½, 4.7 renders as 4½.\n' +
              'Values outside [0, max] are clamped.\n' +
              'Common scales: satisfaction/SLA uses max=5 + shape="stars" (yellow); fixed condition scales use max=6 + shape="dots"; generic 1..10 ratings use max=10 + shape="stars".\n' +
              'Example config (sterren 5-schaal, halve toegestaan): {"max": 5, "shape": "stars", "color": "yellow"} — cell value 4.5 renders ★★★★½\n' +
              'Example config (0..10 schaal): {"max": 10, "shape": "stars", "color": "yellow"} — cell value 7.5 renders 7 filled + 1 half + 2 empty\n' +
              'Example config (Conditie): {"max": 6, "shape": "dots", "color": "primary"} — cell value 3 renders ●●●○○○\n' +
              'Example cell values: 4.5  (half)  |  7  (whole)  |  3.4  (snaps up to 3½)'
          ),
        imageConfig: z
          .object({
            width: z.number().optional().describe('Image width in px. Default: 32.'),
            height: z.number().optional().describe('Image height in px. Default: 32.'),
            alt: z
              .string()
              .optional()
              .describe('Alt text shown on hover and to screen readers. Default: column header.'),
            shape: z.enum(['square', 'circle']).optional().describe('Border-radius. Default: square.'),
          })
          .optional()
          .describe(
            'Config for type=image. Only meaningful when type=image.\n' +
              'Data value: string URL. Accepted schemes: http, https, data:image/*. Other schemes, broken hosts, disallowed MIMEs, and images over 2 MB render as a grey placeholder (not an error).\n' +
              'External http(s) URLs are fetched server-side via the fetch_image companion tool — expect ~100–500 ms delay on first load for each unique URL (cached thereafter in Firestore). data:image/* URLs render instantly without the proxy.\n' +
              'Default size 32×32 square. Use larger sizes (48–64) for table density="comfortable", and shape="circle" for avatars.\n' +
              'Example config: {"width": 48, "height": 48, "shape": "square", "alt": "Building photo"}\n' +
              'Example cell value (http): "https://storage.example.com/vitrum.jpg"\n' +
              'Example cell value (data): "data:image/svg+xml;base64,PHN2Zy4uLg=="'
          ),
        footer: z
          .enum(['sum', 'avg', 'count', 'min', 'max'])
          .optional()
          .describe(
            'Footer aggregation for this column. Only meaningful for number/currency/percentage columns.\n' +
              '- sum: total of all visible (filtered) rows\n' +
              '- avg: average of visible rows\n' +
              '- count: number of visible rows\n' +
              '- min / max: minimum/maximum value\n' +
              'Footer value is formatted using the same column type (e.g. currency footer shows € total).'
          ),
      })
    )
    .describe(
      'Column definitions. Order determines display order left to right.\n' +
        'Tip: put the most important identifying column first (e.g. id, name, reference number), ' +
        'status/badge columns near the end, numeric totals right-aligned.'
    ),
  data: z
    .union([z.array(z.record(z.string(), z.unknown())), z.array(z.array(z.unknown()))])
    .describe(
      'Row data. Two accepted shapes (do not mix them — all rows must use the same shape):\n' +
        '1. Array of ARRAYS (positional, preferred for datasets >20 rows — ~40% smaller payload):\n' +
        '   Each inner array is one row. Values are in the SAME ORDER as "columns[]" and each row must have exactly one value per column.\n' +
        '   Example: columns=[{key:"id"},{key:"name"},{key:"email"}], data=[["3451","André","andre@example.com"], ["3452","Jane","jane@example.com"]]\n' +
        '2. Array of OBJECTS (keyed, fine for small tables):\n' +
        '   Each object is one row. Keys must match column key values.\n' +
        '   Example: [{"id":"3451","name":"André","email":"andre@example.com"}]\n' +
        'Maximum 500 rows — pre-aggregate or filter before calling for larger datasets.\n' +
        'Dates as ISO strings (YYYY-MM-DD). Booleans as true/false. Numbers as numbers (not strings).'
    ),
  features: z
    .object({
      sorting: z
        .boolean()
        .optional()
        .default(true)
        .describe('Enable click-to-sort on column headers. Supports multi-column sort (shift+click). Default: true.'),
      filtering: z
        .boolean()
        .optional()
        .default(false)
        .describe('Enable per-column filter inputs in the header row. Each column gets a text input. Default: false.'),
      globalSearch: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Enable a search box above the table that filters across ALL columns simultaneously. Useful for "find record matching X" type queries. Default: false.'
        ),
      pagination: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'Enable pagination with page size selector (10/25/50/100). Default: true. Disable only for very small datasets (<20 rows).'
        ),
      pageSize: z
        .number()
        .optional()
        .default(10)
        .describe('Initial rows per page. 10 for detail views, 25 for overviews, 50 for data-heavy analysis.'),
      selection: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Enable row selection with checkboxes. Adds a checkbox column on the left. Useful when user needs to select items for follow-up action.'
        ),
      columnVisibility: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Enable column visibility toggles. Adds a dropdown to show/hide columns. Useful for wide tables with many columns.'
        ),
    })
    .optional()
    .describe(
      'Interactive features. Enable only what adds value — too many features clutters the UI.\n' +
        'Recommended defaults: sorting=true, pagination=true, rest=false.\n' +
        'Add filtering/globalSearch for tables with >50 rows or many text columns.\n' +
        'Add selection when the user needs to pick items.'
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Table title. Use the language of the conversation, descriptive (e.g. "Q1 2025 Hours", "Invoice Overview", "Team Members").'
    ),
  emptyMessage: z
    .string()
    .optional()
    .default('Geen data beschikbaar')
    .describe('Message shown when data array is empty or all rows are filtered out.'),
  density: z
    .enum(['compact', 'normal', 'comfortable'])
    .optional()
    .default('normal')
    .describe(
      'Row height density:\n' +
        '- compact: minimal padding, small font — for data-heavy tables with many rows/columns\n' +
        '- normal: balanced padding — default for most tables\n' +
        '- comfortable: spacious padding, larger font — for dashboard-style overviews with few rows'
    ),
  striped: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Alternating row background colors for readability. Default: true. Set false for very short tables (<5 rows).'
    ),
  bordered: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Add borders between cells. Default: false (cleaner look). Set true for data-dense tables where column separation helps.'
    ),
  maxHeight: z
    .string()
    .optional()
    .describe(
      'CSS max-height for scrollable table body (e.g. "400px", "60vh"). Header stays sticky. Omit for auto height.'
    ),
};

// ── Types ────────────────────────────────────────────────────────────────────

interface TableArgs {
  columns: Array<{
    key: string;
    header: string;
    type?: string;
    align?: string;
    width?: string;
    sortable?: boolean;
    filterable?: boolean;
    badgeMap?: Record<string, { label?: string; color: string }>;
    iconMap?: Record<string, { icon: string; color?: string; label?: string }>;
    sparklineConfig?: { color?: string; sortBy?: string };
    progressConfig?: { thresholds?: { warn: number; danger: number }; invertColors?: boolean };
    trendConfig?: { valueType?: string; invertColors?: boolean };
    linkConfig?: { target?: string };
    ratingConfig?: { max?: number; shape?: string; color?: string };
    imageConfig?: { width?: number; height?: number; alt?: string; shape?: string };
    footer?: string;
  }>;
  data: Array<Record<string, unknown>> | Array<Array<unknown>>;
  features?: {
    sorting?: boolean;
    filtering?: boolean;
    globalSearch?: boolean;
    pagination?: boolean;
    pageSize?: number;
    selection?: boolean;
    columnVisibility?: boolean;
  };
  title?: string;
  emptyMessage?: string;
  density?: string;
  striped?: boolean;
  bordered?: boolean;
  maxHeight?: string;
}

/**
 * Validates the row data shape against the column definitions. The UI zips
 * positional rows with columns[] by index and decides keyed-vs-positional on
 * the FIRST row only — so a length mismatch or a mixed-shape payload would
 * silently drop values or render empty cells. Reject here with a clear
 * message instead. Returns an error message, or null when the shape is valid.
 */
export function findRowShapeError(columns: TableArgs['columns'], data: TableArgs['data']): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const firstRowIsPositional = Array.isArray(data[0]);
  for (let index = 0; index < data.length; index++) {
    const row = data[index];
    if (Array.isArray(row) !== firstRowIsPositional) {
      return `Row ${index} is ${Array.isArray(row) ? 'a positional array' : 'a keyed object'} but row 0 is ${
        firstRowIsPositional ? 'a positional array' : 'a keyed object'
      }. All rows must use the same shape — mixed shapes render incorrectly.`;
    }
    if (firstRowIsPositional && (row as unknown[]).length !== columns.length) {
      return `Positional row ${index} has ${(row as unknown[]).length} values but there are ${columns.length} columns. Each positional row must have exactly one value per column, in columns[] order.`;
    }
  }
  return null;
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerRenderTableTool(server: McpServer, opts: { minimal?: boolean } = {}): void {
  // Register the ui:// resource (serves the Vite-built Angular app)
  registerAppResource(server, 'Table App', RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [
      {
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: await getAppHtml(),
      },
    ],
  }));

  // Register the tool with MCP App UI metadata
  registerAppTool(
    server,
    'render_table',
    {
      title: 'Render Table',
      description: opts.minimal ? 'Render data as a table.' : description,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (args: TableArgs, extra: { authInfo?: AuthInfo }) => {
      const start = Date.now();
      let auth: { email: string; userId: string; roles: string[] } | null = null;

      try {
        auth = getAuthExtra(extra.authInfo);

        // ── Validate payload limits ──────────────────────────────────
        if (args.data && args.data.length > 500) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Too many rows (${args.data.length}). Maximum 500. Pre-aggregate or filter before calling render_table.`,
              },
            ],
            isError: true,
          };
        }

        // ── Validate row shape (positional length, mixed shapes) ─────
        const rowShapeError = findRowShapeError(args.columns, args.data);
        if (rowShapeError) {
          return {
            content: [{ type: 'text' as const, text: rowShapeError }],
            isError: true,
          };
        }

        await logToolCall({ auth, args, start, status: 'success' });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Table rendered: "${args.title ?? 'Untitled'}" — ${args.data.length} rows, ${args.columns.length} columns`,
            },
          ],
          structuredContent: { ...args },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('tool.error', {
          tool: 'render_table',
          connector: 'RenderTable',
          user: auth?.email ?? 'unknown',
          userId: auth?.userId ?? 'unknown',
          error: errorMessage,
          durationMs: Date.now() - start,
        });

        await logToolCall({ auth, args, start, status: 'error' });

        return {
          content: [{ type: 'text' as const, text: `Error in render_table: ${errorMessage}` }],
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
  args: TableArgs;
  start: number;
  status: 'success' | 'error';
}): Promise<void> {
  const ctx = requestContext.getStore();
  if (ctx) {
    await writeToolCallLog({
      sessionId: ctx.sessionId,
      environment: ctx.environment,
      server: 'metadata-demo',
      user: auth?.email ?? 'unknown',
      userId: auth?.userId ?? 'unknown',
      tool: 'render_table',
      connector: 'RenderTable',
      queryIntent: args.title ?? 'table',
      filters: [],
      filterCount: 0,
      summaryOnly: false,
      skip: 0,
      take: 0,
      status,
      rowCount: args.data.length,
      hasMore: false,
      durationMs: Date.now() - start,
      errorType: status === 'error' ? 'ToolError' : null,
    });
  }
}
