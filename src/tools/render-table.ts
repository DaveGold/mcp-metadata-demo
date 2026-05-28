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
 * @see ui/apps/utility/table/ for the Angular MCP App
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
 * At runtime: build/servers/utility-tools/tools/render-table.js
 * UI output:  build/ui/utility-table.html
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
- User asks to "toon een tabel", "laat de data zien", "geef een overzicht"
- Displaying individual records with multiple fields (medewerkers, projecten, facturen, uren, assets)
- User needs to sort, filter, or browse through records
- Data has mixed types (text + numbers + dates + statuses) in one view
- Follow-up to a chart: "toon de onderliggende data" → render_table with the same dataset
- Comparing records side by side (e.g. all projects sorted by marge)
- Presenting structured key-value pairs or compact summaries (e.g. energiebalans, projectkengetallen, gebouwprofiel) — even 5-10 rows benefit from proper formatting (currency, dates, percentages, badges) over plain markdown tables
- ALWAYS prefer render_table over markdown tables. Markdown tables lack number formatting, sorting, and visual hierarchy. Use render_table for ANY structured data presentation.

WHEN NOT TO USE:
- Data has 1-2 columns only → respond with a text list
- Visual trends or comparisons → use render_chart
- Single aggregate answer ("hoeveel uur totaal?") → respond with text + call render_chart if visualization helps
- You need to fetch data first → call the appropriate data tool THEN pass results here
- More than 500 rows → pre-aggregate (group by, top-N) or filter before calling

QUERY STRATEGY:
1. Fetch data from the relevant MCP server tool
2. Limit to ≤500 rows (use filters, take/skip, or summaryOnly=false with small date ranges)
3. Extract the specific fields you need into columns[] + data[]
4. Choose column types for proper formatting (currency for money, date for timestamps, badge for statuses)
5. Enable features based on data size: filtering/globalSearch for >50 rows, compact density for >10 columns
NEVER pass raw API responses — extract, rename to Dutch headers, and set proper column types.

OUTPUT EFFICIENCY (important — tool-call payloads are user-visible and expensive to stream):
- Pass the records directly as the "data" argument. Do NOT print/echo the JSON to chat or to stdout in an analysis step first — that doubles the tokens for no gain.
- Prefer POSITIONAL rows over keyed objects for any dataset larger than ~20 rows. "data" accepts TWO shapes:
    Positional (preferred): data = [["3451","André","andre@x.nl"], ["3452","Jane","jane@x.nl"]]  — values match the order of columns[]
    Keyed (fine for tiny tables):  data = [{"Id":"3451","Naam":"André","Email":"andre@x.nl"}]
  The positional form cuts ~40% off per-row tokens by omitting the repeated keys. Use it by default; only fall back to keyed objects when the dataset is tiny (<10 rows) and readability in the request payload matters more than size.
- Only set "type" on columns that need non-text formatting. Plain string fields (names, addresses, free text) can omit "type" — the default is text.
- Only include "badgeMap", "formatConfig", "iconMap", "ratingConfig", etc. on the specific column that needs it. Do not add these "just in case" on every column.
- Auto-formatting in text columns (the default): the renderer auto-detects and formats these value shapes, so send the plain string — no type, no wrapping:
  - Emails ("foo@warmtebouw.nl") render as clickable mailto links.
  - Http(s) URLs render as clickable links.
  - ISO dates ("2025-03-14" or full timestamps) render as nl-NL dates.
  Only set type: "date" / use "link" with {label, href} when the label differs from the URL or you need a non-default target.
- Link-column shorthand: in a type: "link" column, you can send a plain email or URL string — the renderer prepends "mailto:" / "https://" automatically. No {label, href} object needed unless label ≠ value.

DATA VALUE SHAPES (per column type — send the SIMPLEST value that fits; column-level config does the styling):
  text / number / currency / percentage / date / boolean   → scalar (string / number / boolean)
  badge                                                     → scalar value; badgeMap on the column maps it to label + color  (e.g. value "active" + badgeMap {active:{color:"green", label:"Actief"}})
  icon                                                      → scalar value; iconMap on the column maps it to icon + color
  multi_badge                                               → ARRAY of scalars (string[]); badgeMap maps each element      (e.g. ["R410A","Subcontractor"])
  progress                                                  → number 0..1; progressConfig.thresholds colors the bar
  rating                                                    → number; ratingConfig.max defines the scale
  sparkline                                                 → number[] (intrinsically per-row — each row's time series)
  link                                                      → plain email or URL string (shorthand); OR {label, href} only when label ≠ value
  image                                                     → URL string (http(s) or data:image/*)
  trend                                                     → {value, delta} object — both numbers, intrinsically per-row
Cells in a single positional row can mix scalars and objects as their column type requires. Example row for columns [Id, Naam, Email, Trend, Status]: ["3451", "André", "andre@x.nl", {"value": 120000, "delta": 0.08}, "active"]. Only the trend cell needs an object — everything else is scalar. Define color/label/threshold/scale metadata ONCE on the column (badgeMap, iconMap, progressConfig, ratingConfig, trendConfig) and let the renderer apply it across all rows.

INTERPRETATION:
Column type selection — pick the most specific type that fits the value, and read the "Pick instead of" hints when two types look similar:
| Data shape | Column type | Example | Pick instead of |
| euro bedragen | currency | Omzet, Kosten, Factuurbedrag | number (currency adds € prefix + locale separators) |
| aantallen, uren, km | number | Uren, Aantal, Km | text (number enables numeric sort + footer aggregation) |
| percentages (0..1) | percentage | Marge, Dekking, Slagingspercentage | progress (percentage is pure numeric, progress has a visual bar with thresholds) |
| voortgang met kleurdrempel (0..1) | progress | Budget besteed, Voortgang onderhoud, Capaciteitsbenutting, Compliance score (invertColors=true) | percentage (use progress when threshold color guides the reader's eye) |
| datums (ISO) | date | Startdatum, Factuurdatum, Datum melding | text (date parses + formats nl-NL; text doesn't) |
| ja/nee | boolean | Geaccordeerd, Actief, Doorbelast, Betaald | badge (boolean is 2-state; badge is 3+ states) |
| statussen, types, categorieën (enum) | badge + badgeMap | Status, TypeItem (Wst/Kst/Art), SoortInstallatie, Conditiescore | text / multi_badge (badge is single-value enum; multi_badge for arrays) |
| enkele iconische indicator | icon + iconMap | Health (groen/rood/grijs pijl), Compliance (shield-check), Trend-pijltje op één numeriek veld | badge (icon is purely visual, badge shows text) |
| tijdreeks per rij (number[]) | sparkline | Verbruikstrend 12 mnd, Storingstrend, Urentrend per medewerker | render_chart (sparkline is per-row inline; render_chart is one chart for all rows) |
| waarde + periode-delta | trend ({value, delta}) | Verbruik YoY, Kosten MoM, Omzet delta, BENG-score delta | twee aparte kolommen value + percentage (trend co-renders with arrow + color) |
| meerdere tags per rij (string[]) | multi_badge + badgeMap | Kenmerken installatie (R410A + Conditie 03 + Subcontractor), Certificeringen medewerker | concatenated text (multi_badge gives per-tag color + wrapping) |
| klikbare URL | link ({label, href}) | Dossier-link, Project-link, Klant-e-mail, externe rapportage | text (link navigates; text shows URL as text) |
| bounded score op vaste schaal | rating + ratingConfig | Conditie 0..6 (shape=dots, max=6), SLA 1..5 sterren, Klanttevredenheid | number (rating visualizes a fixed scale; number is for unbounded counts) |
| foto / QR / avatar (URL) | image + imageConfig | Installatiefoto, Typeplaatje-thumbnail, QR naar rapport, monteur-avatar | text (image shows the thumbnail; text shows the URL) |
| rest | text | Naam, Adres, Omschrijving, Email-adres als tekst | — |

Feature selection:
| Scenario | Recommended features |
| Quick overview (<20 rows) | sorting only, no pagination, comfortable density |
| Standard data table (20-100 rows) | sorting + pagination (pageSize 25), normal density |
| Data-heavy analysis (100-500 rows) | sorting + filtering + globalSearch + pagination, compact density |
| Selection for action | add selection=true (adds checkbox column) |
| Wide table (>8 columns) | add columnVisibility=true |

Domain examples (Warmtebouw):
- Nacalculatie uren: get_nacalculatie → columns [Medewerker, Datum(date), TypeItem(badge), Uren(number), Doorbelast(boolean)], density=compact, filtering=true
- Projectoverzicht: get_project → columns [ProjectId, Naam, Omzet(currency), Kosten(currency), Marge(percentage), Status(badge)], footer sum on Omzet/Kosten
- Factuuroverzicht: get_verkoopfactuurregel → columns [FactuurNr, Klant, Bedrag(currency), BTW(currency), Datum(date), Betaald(boolean)], globalSearch=true
- Budgetoverzicht: get_voorcalculatieregel → columns [Fase, TypeItem(badge), BedragBegroting(currency), UrenBegroting(number)], footer sum on bedragen
- Abonnementsregels: get_abonnementsregel → columns [ProjectId, SoortInstallatie(badge), Fabrikaat, Conditiescore(badge), Begindatum(date)], filtering=true
- Dossieroverzicht: get_dossier → columns [DossieritemId, Type(badge), Omschrijving, Status(badge), Datum(date), Afgehandeld(boolean)], filtering=true
- Medewerkers: get_medewerker → columns [Naam, Afdeling(badge), Email, Startdatum(date)], comfortable density, pagination=false
- Wagenpark: get_assets → columns [Kenteken, Merk, Chauffeur, Km(number), Brandstof(number), Score(number)], sorting=true
- Ritten: get_trips → columns [Chauffeur, Datum(date), Afstand(number), Duur(text), Type(badge)], filtering=true
- Rijscores: get_driver_scores / get_asset_scores → columns [Naam, Score(number), Remmen(number), Versnellen(number), Snelheid(number)], compact
- Energieverbruik: get_usages → columns [Periode, Verbruik(number), Eenheid(text), Levering(number)], footer sum on Verbruik
- Energiebalans: get_usages → columns [Kengetal(text), Waarde(number), Eenheid(text)], pagination=false, comfortable density
- Meteroverzicht: get_meters → columns [Bedrijf, EAN, Type(badge), Meter, Actief(boolean)], filtering=true
- Gebouwprofiel: get_building_profile → columns [Kenmerk(text), Waarde(text)], pagination=false — building year, surface, energy label, usage type
- BIM elementen: get_elements / get_elements_by_project → columns [Name, Category(badge), Family, Diameter(number), System], filtering=true, compact
- BIM modellen: get_element_groups → columns [Naam, Project, Elementen(number)], pagination=false
- Installatiepark met storingstrend: get_abonnementsregel + get_dossier aggregaten → columns [Installatie(text), Fabrikaat(text), Bouwjaar(number), StoringTrend(sparkline, sparklineConfig.sortBy="last"), Conditie(rating, ratingConfig.max=6, shape="dots"), Kenmerken(multi_badge), OnderhoudYoY(trend, trendConfig.valueType="currency"), Status(badge)]
- Portfolio gebouwen: get_project + get_building_profile + get_usages YoY → columns [Foto(image), Gebouw(link), Adres(text), BudgetBesteed(progress, thresholds 0.7/0.9), VerbruikYoY(trend, invertColors=false), OmzetYoY(trend, invertColors=true), Tevredenheid(rating, max=5), Label(badge)]
- Projectlinks: get_project → columns [ProjectId(link with href to EBS), Naam(text), Omzet(currency), Marge(percentage), Status(badge)] — use link column when ProjectId should jump to external system

RELATED TOOLS:
- render_chart — for visual trends, comparisons, compositions (complementary: often useful to show both chart + table of the same data)
- render_map — for geographic context (complementary: table for detail, map for spatial overview)
- report_problem — if column formatting is wrong, a badge color doesn't match status semantics, or the table layout is confusing

FEEDBACK:
If the column type guide or feature selection guide was unhelpful, call report_problem with severity "low".

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
            'Property key in each data row object. Must match exactly (case-sensitive). E.g. "MedewerkerNaam", "ProjectId", "Bedrag".'
          ),
        header: z
          .string()
          .describe(
            'Column header text shown to the user. Use Dutch for Warmtebouw data (e.g. "Medewerker", "Project", "Bedrag (€)").'
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
              '- badge: colored pill. Center-aligned. Data: a string key; requires badgeMap. Pick over text for any enumerated status/type/category (Status, TypeItem, Conditiescore, SoortInstallatie). Pick multi_badge when multiple tags apply per row.\n' +
              '- icon: single Heroicon. Center-aligned. Data: the icon name (or a key looked up in iconMap). Pick over badge when the value is inherently iconic (health indicator, compliance check, direction). Pick boolean for plain ja/nee.\n' +
              '- sparkline: inline trend mini-chart (80×24 SVG). Center-aligned. Data: number[] (e.g. 12 monthly values, ideally 2–60 points). Sortable on last/avg/min/max via sparklineConfig.sortBy. Pick over rendering render_chart next to the table when the trend is a per-row attribute (verbruikstrend per gebouw, storingstrend per installatie). Pick render_chart when you have one shared trend across rows, not one per row.\n' +
              '- progress: filled horizontal bar 0–100% with numeric label. Left-aligned. Data: number in [0, 1]. Thresholds (default: green <70%, orange 70–90%, red >90%) via progressConfig.thresholds. For up-is-good metrics (compliance score, voortgang) set progressConfig.invertColors=true. Pick over percentage when threshold emphasis matters (budget besteed, voortgang, capaciteit). Pick percentage for analytical figures (marge, dekking).\n' +
              '- trend: value + directional arrow + signed delta ("€ 1.234 ▲ +12,0%"). Right-aligned. Data: { value: number, delta: number, direction?: "up"|"down"|"flat" } — direction is inferred from delta sign if omitted; delta is a fraction (0.12 = +12,0%). Default colors: up=red/down=green (correct for verbruik, kosten, storingen — rising is bad). Set trendConfig.invertColors=true when rising is good (omzet, marge, Paris-Proof progress). Pick over two separate columns (value + delta%) when the pair should be read together and space is tight.\n' +
              '- multi_badge: multiple colored pills per cell, flex-wrapped. Left-aligned. Data: string[] (array of keys). Reuses the same badgeMap as badge — no separate map needed. Global search matches any label. Pick over concatenated text ("R410A | Conditie 03 | Subcontractor") when users benefit from per-tag color. Pick over separate columns when the tags are a variable-length set that belongs together (kenmerken, systemen, certificeringen).\n' +
              '- link: clickable navigation. Left-aligned. Data: a string (used as both label and href) OR { label: string, href: string }. Safe schemes only: http(s) and mailto — anything else renders as plain text (no javascript:, no data:). Opens in new tab by default (linkConfig.target="_self" to override). Pick over text when the user should navigate (dossier-URL, project-URL, klant-e-mail). Pick text when the URL is reference-only or when the destination is another row in the same table.\n' +
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
              'Example cell value (shorthand, URL): "https://warmtebouw.nl/dossier/2707962"\n' +
              'Example cell value (shorthand, email): "heuvel@warmtebouw.nl"  // → mailto link\n' +
              'Example cell value (explicit): {"label": "G240286 Vitrum", "href": "https://warmtebouw.nl/projecten/G240286"}'
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
              'Common scales: Klanttevredenheid/SLA uses max=5 + shape="stars" (yellow); Conditiescore uses max=6 + shape="dots" (Warmtebouw convention); generic 1..10 waarderingen use max=10 + shape="stars".\n' +
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
              'Example config: {"width": 48, "height": 48, "shape": "square", "alt": "Gebouwfoto"}\n' +
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
        'Tip: put the most important identifying column first (e.g. ProjectId, Medewerker, Factuur #), ' +
        'status/badge columns near the end, numeric totals right-aligned.'
    ),
  data: z
    .union([z.array(z.record(z.string(), z.unknown())), z.array(z.array(z.unknown()))])
    .describe(
      'Row data. Two accepted shapes:\n' +
        '1. Array of ARRAYS (positional, preferred for datasets >20 rows — ~40% smaller payload):\n' +
        '   Each inner array is one row. Values are in the SAME ORDER as "columns[]".\n' +
        '   Example: columns=[{key:"Id"},{key:"Naam"},{key:"Email"}], data=[["3451","André","andre@x.nl"], ["3452","Jane","jane@x.nl"]]\n' +
        '2. Array of OBJECTS (keyed, fine for small tables):\n' +
        '   Each object is one row. Keys must match column key values.\n' +
        '   Example: [{"Id":"3451","Naam":"André","Email":"andre@x.nl"}]\n' +
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
          'Enable a search box above the table that filters across ALL columns simultaneously. Useful for "zoek medewerker X" type queries. Default: false.'
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
      'Table title. Use Dutch, descriptive (e.g. "Nacalculatie Q1 2025", "Factuuroverzicht", "Medewerkers afdeling W").'
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
        '- compact: minimal padding, small font — for data-heavy tables with many rows/columns (nacalculatie, uren)\n' +
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
  theme: z
    .enum(['warmtebouw', 'auto'])
    .optional()
    .default('warmtebouw')
    .describe('Color theme. warmtebouw = Warmteblauw header + brand colors (default). auto = adapts to host theme.'),
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
  theme?: string;
  maxHeight?: string;
}

// ── Tool registration ────────────────────────────────────────────────────────

export function registerRenderTableTool(server: McpServer): void {
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
      title: 'Tabel weergeven',
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
      server: 'utility-tools',
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
