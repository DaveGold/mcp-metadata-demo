/**
 * render_table's input schema — reference implementation.
 *
 * Delivered in full and re-sent on every turn (evals/results/2026-09-24-input-schema-delivery.json),
 * so it carries what forming the call needs: which column type fits which value, the data shape
 * of each, one example, and for the types a model passes over, when to pick them
 * (evals/results/2026-09-25-q26b-table-when-to-pick.json). Structure identical to the other tiers'
 * schema apart from one more badge colour (a test pins it).
 */
import { z } from 'zod';

const COLORS = ['green', 'red', 'yellow', 'blue', 'gray', 'orange', 'primary'] as const;

const COLUMN_TYPES =
  'How the value is shown and sorted; pick the most specific type for the value:\n' +
  '- text: a string (also years, so "2014" gets no thousands separator).\n' +
  '- number: a raw number, nl-NL formatted. Put the unit in the header: "EP-2 berekend (kWh/m²)".\n' +
  '- currency: a raw number of euros.\n' +
  '- date: an ISO date "2024-03-01".\n' +
  '- percentage: a number in [0, 1] (0.15 → 15,0%).\n' +
  '- boolean: true/false → ✓/✗.\n' +
  '- badge: a string key, coloured through badgeMap; for a status or label letter.\n' +
  '- multi_badge: an array of badgeMap keys; for several tags per row (installations, certifications), instead of a comma list in text.\n' +
  '- icon: a Heroicon name, or a key looked up in iconMap; for a status shown as a symbol (running, warning, fault).\n' +
  '- sparkline: a number[] per row (2–60 points), for a trend per row.\n' +
  '- progress: a number in [0, 1] shown as a bar with thresholds.\n' +
  '- trend: {value, delta}, delta a fraction (0.12 = +12%).\n' +
  '- link: a URL string, or {label, href}; http(s) and mailto only.\n' +
  '- rating: a number on a fixed scale (ratingConfig.max); for a score on a fixed scale (condition 1–6: max 6, dots; satisfaction 1–5: stars), instead of a badge or a number.\n' +
  '- image: an http(s) or data:image URL.';

function tableInputSchema(columnTypes: string) {
  return {
    columns: z
      .array(
        z.object({
          key: z.string().describe('The key of this column in each row object.'),
          header: z
            .string()
            .describe(
              'Header text, in the language of the conversation, with the unit and "berekend" where the field has them.',
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
            .describe(columnTypes),
          align: z.enum(['left', 'center', 'right']).optional().describe('Override the type default.'),
          width: z.string().optional().describe('CSS width, e.g. "200px".'),
          sortable: z.boolean().optional().default(true),
          filterable: z.boolean().optional().default(true),
          badgeMap: z
            .record(z.string(), z.object({ label: z.string().optional(), color: z.enum(COLORS) }))
            .optional()
            .describe(
              'badge / multi_badge: value → {label?, color}, e.g. {"A": {"color": "green"}, "G": {"color": "red"}}.',
            ),
          iconMap: z
            .record(
              z.string(),
              z.object({ icon: z.string(), color: z.enum(COLORS).optional(), label: z.string().optional() }),
            )
            .optional()
            .describe('icon: value → {icon, color?}, e.g. {"true": {"icon": "check-circle", "color": "green"}}.'),
          sparklineConfig: z
            .object({
              color: z.enum(COLORS).optional(),
              sortBy: z.enum(['last', 'avg', 'min', 'max']).optional(),
            })
            .optional()
            .describe('sparkline: colour, and which aggregate the column sorts on (default last).'),
          progressConfig: z
            .object({
              thresholds: z.object({ warn: z.number(), danger: z.number() }).optional(),
              invertColors: z.boolean().optional(),
            })
            .optional()
            .describe('progress: thresholds in [0, 1] (default warn 0.7, danger 0.9); invertColors when high is good.'),
          trendConfig: z
            .object({
              valueType: z.enum(['number', 'currency', 'percentage']).optional(),
              invertColors: z.boolean().optional(),
            })
            .optional()
            .describe('trend: rising shows red by default (use, cost); invertColors when rising is good.'),
          linkConfig: z
            .object({ target: z.enum(['_blank', '_self']).optional() })
            .optional()
            .describe('link: default _blank.'),
          ratingConfig: z
            .object({
              max: z.number().optional(),
              shape: z.enum(['stars', 'dots']).optional(),
              color: z.enum(['yellow', 'primary', 'green', 'red', 'gray', 'orange']).optional(),
            })
            .optional()
            .describe('rating: max (default 5), shape, colour; halves allowed.'),
          imageConfig: z
            .object({
              width: z.number().optional(),
              height: z.number().optional(),
              alt: z.string().optional(),
              shape: z.enum(['square', 'circle']).optional(),
            })
            .optional()
            .describe('image: size in px (default 32), alt text, shape.'),
          footer: z
            .enum(['sum', 'avg', 'count', 'min', 'max'])
            .optional()
            .describe('A footer aggregate over the visible rows, for number, currency or percentage columns.'),
        }),
      )
      .describe('Columns, left to right; the identifying column first.'),
    data: z
      .union([z.array(z.record(z.string(), z.unknown())), z.array(z.array(z.unknown()))])
      .describe(
        'Rows, one shape for all: positional arrays in the order of columns (preferred above ~20 rows), ' +
          'e.g. [["Gustav Mahlerlaan 10", "A", 179.06]], or objects keyed by column key. At most 500 rows. ' +
          'Numbers as numbers, dates as ISO strings.',
      ),
    features: z
      .object({
        sorting: z.boolean().optional().default(true),
        filtering: z.boolean().optional().default(false),
        globalSearch: z.boolean().optional().default(false),
        pagination: z.boolean().optional().default(true),
        pageSize: z.number().optional().default(10),
        selection: z.boolean().optional().default(false),
        columnVisibility: z.boolean().optional().default(false),
      })
      .optional()
      .describe('Defaults: sorting and pagination on. Add filtering or globalSearch above ~50 rows.'),
    title: z.string().optional().describe('Short title, in the language of the conversation.'),
    emptyMessage: z.string().optional().default('Geen data beschikbaar'),
    density: z
      .enum(['compact', 'normal', 'comfortable'])
      .optional()
      .default('normal')
      .describe('compact for many columns.'),
    striped: z.boolean().optional().default(true),
    bordered: z.boolean().optional().default(false),
    maxHeight: z.string().optional().describe('CSS max-height for a scrolling body, e.g. "400px".'),
    queryIntent: z.string().optional().describe('The business question this call answers. Used for observability.'),
  };
}

export const bestTableInputSchema = tableInputSchema(COLUMN_TYPES);

/** Temporary, for one measurement: the same schema without the when-to-pick lines of three types. */
export const bestTableInputSchemaNoWhen = tableInputSchema(
  COLUMN_TYPES.replace(
    '; for several tags per row (installations, certifications), instead of a comma list in text.',
    '.',
  )
    .replace('; for a status shown as a symbol (running, warning, fault).', '.')
    .replace(
      '; for a score on a fixed scale (condition 1–6: max 6, dots; satisfaction 1–5: stars), instead of a badge or a number.',
      '.',
    ),
);
