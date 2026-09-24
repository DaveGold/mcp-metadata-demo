/**
 * The app tools (render_chart, render_table, render_map, get_tool_call_log) — reference implementation.
 *
 * The data tools fetch; these draw. What the model needs from them is mostly BEFORE the call (which
 * tool, which chart type, how to shape the payload), so each description fits within the 2,048
 * characters a host delivers, and the per-parameter rules live in the input schema, which is
 * delivered too. What can be checked on the finished call is checked here and returned under
 * `interpretation.alerts`, instead of being left to prose. Audit: docs/app-tools-findings.md.
 */

export const bestChartDescription = `\
WHEN TO USE: a chart of data already fetched from this server — a trend (monthly weightedHDD or GHI from get_weather_context summary.monthlyBreakdown), a ranking or comparison across addresses (get_building_profile), a distribution. Pick \`type\` with the rules on that parameter.

WHEN NOT TO USE: a single number or a short list → answer in text. Records to browse or sort → render_table. Locations → render_map. It fetches nothing: call the data tool first.

RELATED TOOLS: get_weather_context, get_building_profile (the data); render_table (the rows behind a chart); render_map.

QUERY STRATEGY: pass the prepared data directly; do not echo it in the conversation first. Use the tuple shorthand: datasets ["<label>", [n, n, …]], sankey flows ["from", "to", n], matrix cells [x, y, v]. bar, line, pie, doughnut, radar, polarArea, boxplot and funnel need labels[] with one entry per value. Pre-aggregate: at most 500 points per dataset (line 3,000) and 5 series.

RETURNS: the chart, rendered inline for the user, and \`interpretation.alerts\`. Read the alerts: they name a determinate problem with the call (too many slices, a target line of the wrong kind) and how to fix it.

INTERPRETATION: draw a target or benchmark line only against data of the same kind. Every energy figure from get_building_profile is CALCULATED by the label method; Paris Proof and other consumption benchmarks are defined on MEASURED energy, so never draw them against label figures.

ALERTS: interpretation.alerts — problems found in this call, each with its fix.`;

export const bestTableDescription = `\
WHEN TO USE: records the user wants to read, sort or compare field by field — several addresses side by side (get_building_profile), daily weather rows (get_weather_context records with select). Prefer it over a markdown table for anything with numbers, units or dates.

WHEN NOT TO USE: one or two values → answer in text. A trend or a ranking at a glance → render_chart. Locations → render_map. It fetches nothing: call the data tool first.

RELATED TOOLS: get_building_profile, get_weather_context (the data); render_chart (the picture of the same rows).

QUERY STRATEGY: pass the rows directly; do not echo them first. Above ~20 rows use positional rows (values in the order of columns[]). At most 500 rows: filter or aggregate first. Pick a column type per field (number, percentage, date, badge) and keep the unit and provenance from the field name in the header: "EP-2 berekend (kWh/m²)", not "Energy use".

RETURNS: the table, rendered inline for the user, with a one-line confirmation of rows and columns.

INTERPRETATION: a header must not claim more than the field does. Label figures from get_building_profile are CALCULATED, not metered consumption; say so in the header and never add a column that ranks them against a metered benchmark.`;

export const bestMapDescription = `\
WHEN TO USE: where one or more addresses are — a building (get_building_profile coordinaten.lat/lon), several addresses to compare spatially, the location a weather query used.

WHEN NOT TO USE: one address the user only needs named → answer in text. Coordinates in a list → render_table. No coordinates yet → call get_building_profile first; it returns them.

RELATED TOOLS: get_building_profile (coordinaten.lat / coordinaten.lon per address); get_weather_context (takes the same coordinates).

QUERY STRATEGY: markers are [lat, lng, label, description?, type?] — lat first. Use type "building" for addresses. Put what the user asked about in the description (energielabel, bouwjaar), not the whole profile. At most 500 markers.

RETURNS: the map, rendered inline for the user, and \`interpretation.alerts\` when a marker looks wrong (lat and lng swapped, outside the Netherlands).`;

export const bestLogDescription = `\
WHEN TO USE: to read how this server is used — the queryIntent of recent calls, which tools, which optional parameters, which calls failed. The Iterate step: consecutive queryIntent values read as a narrative name the gap in a tool's metadata.

WHEN NOT TO USE: to get a past call's data — the log keeps the shape of a call (tool, queryIntent, status, duration, parameter NAMES), never parameter values or responses.

RETURNS: records (most recent first) and a summary: environment, count per tool and per server variant, time span.

INTERPRETATION: environment "local" is this process's in-memory buffer (last 50 calls, reset on restart); "cloud" is the persisted history across every caller. An empty local log means no tool has been called yet in this process, not a broken log.`;

export const bestLogVariantDescription =
  'Filter to calls served by one server variant, e.g. "best". Read summary.countByVariant first.';

/** The line annotation examples on render_chart's `options`: a boundary on the same kind of quantity. */
export const BEST_ANNOTATION_EXAMPLES = {
  value:
    'For type="line": the position on scaleID. Number for numeric axes (e.g. value:50, the warmtebehoefte boundary for a heat pump). For a categorical x-axis (labels[] is strings, e.g. months), pass the label string verbatim (e.g. value:"2024-03").',
  lineExample:
    'Example — a boundary of the same kind as the data: [{type:"line", scaleID:"y", value:50, borderColor:"#d32f2f", borderDash:[6,6], label:{content:"warmtepomp zeer geschikt < 50", display:true}}]. A calculated label figure is never drawn against a metered target (Paris Proof, WEii).',
};

/**
 * A question-first decision path for render_chart's `type`: what the data IS decides the type,
 * then the per-type rules check it. Prepended to the rules, in the input schema, where it is
 * delivered (a description would lose it past char 2,048).
 */
export const CHART_DECISION_TREE =
  'Chart type. Decide from what the data IS, in this order, then check the per-type rules below.\n' +
  '1. Structure first:\n' +
  '- amounts flowing from one stage to the next (source → system → end use) → sankey\n' +
  '- stages where each is a subset of the one before (lead → quote → order) → funnel\n' +
  '- links between items, many-to-many (which system depends on which) → graph\n' +
  '- a hierarchy with a value per leaf, part-to-whole, 6+ leaves (project → phase → cost item) → treemap\n' +
  '- two categorical axes with a value per cell (hour × weekday) → matrix\n' +
  '- many samples per category, and the question is about spread or outliers → boxplot\n' +
  '- three numeric measures per item (x, y and size) → bubble\n' +
  '- two numeric measures per item, and the question is whether they move together → scatter\n' +
  '2. Otherwise one value per category or time step:\n' +
  '- a trend over continuous time or numbers → line\n' +
  '- a cycle (weekdays, hours, months) and the question is about the cycle → polarArea\n' +
  '- shares of one whole, 2–5 parts → pie; the same with one total or KPI to show in the centre → doughnut\n' +
  '- one or two items scored on 3–6 comparable measures on one scale → radar\n' +
  '- a ranking or comparison of categories → bar (horizontal above 8 items)\n' +
  'Per-type rules:\n';

// ── Checks on a finished call ────────────────────────────────────────────────

const METERED_TARGET = /paris\s*proof|weii/i;

/** Determinate problems with a render_chart call, each with its fix. Rendered anyway: the user may know better. */
export function chartAlerts(args: {
  type: string;
  labels?: unknown[];
  datasets?: { label?: string }[];
  options?: { annotations?: { label?: { content?: string } }[] };
}): string[] {
  const alerts: string[] = [];
  const slices = args.labels?.length ?? 0;
  const series = args.datasets?.length ?? 0;
  if ((args.type === 'pie' || args.type === 'doughnut') && slices > 5) {
    alerts.push(
      `${slices} slices: above 5 a ${args.type} is hard to read. A horizontal bar sorted descending shows the same shares.`,
    );
  }
  if (args.type === 'line' && series > 5) {
    alerts.push(
      `${series} series: above 5 lines are hard to tell apart. Show the top 5, or split into several charts.`,
    );
  }
  if (args.type === 'radar' && (series > 3 || slices > 8)) {
    alerts.push(
      `radar with ${series} overlays and ${slices} axes: above 3 overlays or 8 axes use a matrix or small multiples.`,
    );
  }
  for (const a of args.options?.annotations ?? []) {
    if (METERED_TARGET.test(a.label?.content ?? '')) {
      alerts.push(
        `The "${a.label?.content}" line is a target defined on MEASURED energy. Draw it only against metered consumption: the energy figures of get_building_profile are CALCULATED, so they cannot be compared with it. Remove the line, or say the chart does not show that comparison.`,
      );
    }
  }
  return alerts;
}

/** A header or row label that names a label energy figure. */
// Lookarounds, not \b: "²" and "₂" are not word characters, so \b never matches after them.
const LABEL_TERM =
  /(?<![a-z])(ep-?[12]|ep[₁₂]|energiebehoefte|primair fossiel|warmtebehoefte|berekend energieverbruik)(?![a-z])/i;
/** A generic energy word only names a LABEL figure when it is per m², as every label figure is. */
const ENERGY_WORD = /(?<![a-z])(energy|energie|primary|fossil|co2|co₂|emission|emissie|heat|heating|gas)/i;
const PER_M2 = /\/\s*m[²2](?![a-z0-9])|per m[²2](?![a-z0-9])/i;
const isLabelFigure = (header: string) => LABEL_TERM.test(header) || (ENERGY_WORD.test(header) && PER_M2.test(header));
const SAYS_CALCULATED = /berekend|calculated|rekenwaarde|label calc|modelled|modeled/i;

/**
 * Headers (or first-column row labels, for a transposed table) that name a label energy figure
 * without saying it is calculated. Models translate `ep2_primair_fossiel_berekend_kwh_m2` into
 * "EP-2 primary fossil energy (kWh/m²)" and the provenance falls out of the name
 * (evals/results/2026-09-24-q22-app-tools.json).
 */
export function tableAlerts(
  columns: { key: string; header?: string }[],
  data: (Record<string, unknown> | unknown[])[],
): string[] {
  const names = columns.map((c) => c.header ?? c.key);
  const first = columns[0]?.key;
  for (const row of data) {
    const v = Array.isArray(row) ? row[0] : first ? row[first] : undefined;
    if (typeof v === 'string') names.push(v);
  }
  const unmarked = [...new Set(names.filter((n) => isLabelFigure(n) && !SAYS_CALCULATED.test(n)))];
  if (!unmarked.length) return [];
  return [
    `Not rendered. ${unmarked.map((n) => `"${n}"`).join(', ')}: a label figure headed as if it were consumption. It is CALCULATED by the label method; say so in the header (e.g. "EP-2 berekend (kWh/m²)") and call render_table again.`,
  ];
}

/** Netherlands bounding box, as in get_weather_context's input schema. */
const NL = { lat: [50.75, 53.55], lng: [3.36, 7.23] } as const;
const inNl = (lat: number, lng: number) => lat >= NL.lat[0] && lat <= NL.lat[1] && lng >= NL.lng[0] && lng <= NL.lng[1];

/** Markers that look wrong for this server's data (Dutch addresses only). */
export function mapAlerts(markers: { lat: number; lng: number; label: string }[]): string[] {
  const alerts: string[] = [];
  const swapped = markers.filter((m) => !inNl(m.lat, m.lng) && inNl(m.lng, m.lat));
  const outside = markers.filter((m) => !inNl(m.lat, m.lng) && !inNl(m.lng, m.lat));
  if (swapped.length) {
    alerts.push(
      `${swapped.map((m) => `"${m.label}"`).join(', ')}: lat and lng look swapped (a Dutch lat is 50.75–53.55). Markers are [lat, lng, …].`,
    );
  }
  if (outside.length) {
    alerts.push(
      `${outside.map((m) => `"${m.label}"`).join(', ')}: outside the Netherlands. This server's addresses are Dutch; check the coordinates.`,
    );
  }
  return alerts;
}
