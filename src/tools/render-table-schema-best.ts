/**
 * render_table's input schema — reference implementation.
 *
 * Delivered in full and re-sent on every turn (evals/results/2026-09-24-input-schema-delivery.json),
 * so it carries what forming the call needs: which column type fits which value, the data shape
 * of each, one example, and for the types a model passes over, when to pick them
 * (evals/results/2026-09-25-q26b-table-when-to-pick.json). It stays under the 5,000 characters past
 * which some clients drop every describe (evals/results/2026-09-27-host-delivery.json), so
 * presentation knobs with good defaults are left out and the renderer applies the defaults. Apart
 * from those, and one more badge colour, its structure is the other tiers' schema (a test pins it).
 */
import { z } from 'zod';

const COLORS = ['green', 'red', 'yellow', 'blue', 'gray', 'orange', 'primary'] as const;

const COLUMN_TYPES =
  'Pick the most specific type for the value:\n' +
  '- text: a string (also years, so "2014" gets no thousands separator).\n' +
  '- number: a raw number; the unit goes in the header: "EP-2 berekend (kWh/m²)".\n' +
  '- currency: a raw number of euros.\n' +
  '- date: an ISO date "2024-03-01".\n' +
  '- percentage: a number in [0, 1] (0.15 → 15,0%).\n' +
  '- boolean: true/false → ✓/✗.\n' +
  '- badge: a string key, coloured through badgeMap; for a status or label letter.\n' +
  '- multi_badge: an array of badgeMap keys; for several tags per row (installations, certifications), instead of a comma list in text.\n' +
  '- icon: a Heroicon name or an iconMap key; for a status shown as a symbol (running, warning, fault).\n' +
  '- sparkline: a number[] per row (2–60 points), for a trend per row.\n' +
  '- progress: a number in [0, 1] shown as a bar with thresholds.\n' +
  '- trend: {value, delta}, delta a fraction (0.12 = +12%).\n' +
  '- link: a URL string, or {label, href}; http(s) and mailto only.\n' +
  '- rating: a number on a fixed scale (ratingConfig.max); for a score on a fixed scale (condition 1–6: max 6, dots; satisfaction 1–5: stars), instead of a badge or a number.\n' +
  '- image: an http(s) or data:image URL.';

export const bestTableInputSchema = {
  columns: z
    .array(
      z.object({
        key: z.string().describe('The key of this column in each row object.'),
        header: z
          .string()
          .describe('Header in the conversation language, with the unit and "berekend" where they apply.'),
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
          .describe(COLUMN_TYPES),
        badgeMap: z
          .record(z.string(), z.object({ label: z.string().optional(), color: z.enum(COLORS) }))
          .optional()
          .describe('badge, multi_badge: value → {label?, color}, e.g. {"A": {"color": "green"}}.'),
        iconMap: z
          .record(
            z.string(),
            z.object({ icon: z.string(), color: z.enum(COLORS).optional(), label: z.string().optional() }),
          )
          .optional()
          .describe('icon: value → {icon, color?}, e.g. {"true": {"icon": "check-circle", "color": "green"}}.'),
        sparklineConfig: z
          .object({ color: z.enum(COLORS).optional() })
          .optional()
          .describe('sparkline: colour.'),
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
          .describe('Footer aggregate over the visible rows: number, currency, percentage columns.'),
      }),
    )
    .describe('Columns, left to right; the identifying column first.'),
  data: z
    .union([z.array(z.record(z.string(), z.unknown())), z.array(z.array(z.unknown()))])
    .describe(
      'Rows, one shape for all: positional arrays in column order (preferred above ~20 rows), ' +
        'e.g. [["Gustav Mahlerlaan 10", "A", 179.06]], or objects by column key. Max 500. ' +
        'Numbers as numbers, dates ISO.',
    ),
  features: z
    .object({
      filtering: z.boolean().optional(),
      globalSearch: z.boolean().optional(),
      pageSize: z.number().optional(),
    })
    .optional()
    .describe('Sorting and pagination (10 rows) are on. Add filtering or globalSearch above ~50 rows.'),
  title: z.string().optional().describe('Short title, in the language of the conversation.'),
  queryIntent: z.string().optional().describe('The business question this call answers. Used for observability.'),
};
