/**
 * MCP tool: get_weather_context — `best` arm (reference implementation).
 *
 * Same data path and numbers as get-weather-context.ts (executeWeatherQuery +
 * summarizeWeather), with every eval lesson applied to what the model receives:
 * - description ≤ 2,048 chars, load-bearing rules first (Q7, Q15);
 * - `interpretation` first in the response, lines from a rule registry (best-weather-rules.ts);
 * - the partial-period REFERENCE shipped as data (Q16, Q16b), the annual factor null outside
 *   a full year and renamed so its validity is in its name;
 * - determinate steps computed when the caller passes the inputs (energyUse, solar);
 * - fighting-system days returned complete (Q11);
 * - response-size guard below the host's ~25k-token replacement limit (Q9);
 * - zero measured days → nulls, never 0 read as a measurement.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { requestContext } from '../shared/log-context.js';
import { writeToolCallLog } from '../shared/log-store.js';
import { applySelect } from '../domain/project-fields.js';
import { executeWeatherQuery, fetchArchive, summarizeWeather } from './get-weather-context.js';
import { referencePeriodWeightedHDD, type ArchiveFetcher } from '../domain/reference-period.js';
import { selectRules, type Interpretation } from '../domain/best-rules.js';
import {
  WEATHER_CONSTANTS,
  WEATHER_RULES,
  NL_REFERENCE_ANNUAL_WEIGHTED_HDD,
  fightingSystemDays,
  isFullYearWindow,
  solarCheck,
  type Normalization,
  type WeatherCtx,
} from '../domain/best-weather-rules.js';

const DEFAULT_LAT = 52.09;
const DEFAULT_LON = 5.11;

/** Above this many serialized chars the records are dropped (the host replaces results over ~25k tokens). */
export const MAX_RESPONSE_CHARS = 50_000;

export const RECORD_FIELDS = [
  'date', 'tempMean', 'tempMin', 'tempMax', 'hdd', 'cdd', 'weightedHdd',
  'ghiKwhM2', 'sunshineDurationHours', 'weatherCode', 'weatherLabel', 'isForecast',
] as const;

export const bestWeatherDescription = `\
Daily weather for a Dutch location (Open-Meteo): archive days (isForecast=false) and forecast days up to today+14 (isForecast=true), with degree days, solar irradiance (GHI) and a period summary. All aggregates cover archive days only.

READ \`interpretation\` FIRST: it states the weather correction that is valid for THIS window, the complete list of fighting-system days, and the forecast/archive split. Quote its computed values rather than recomputing them.

WEATHER CORRECTION (gas / heating energy):
- The Dutch convention uses weighted degree days: weightedHdd / totalWeightedHDD, never raw hdd.
- Full 12-month window: corrected = actual × fullYearGasNormalizationFactor (2800 ÷ totalWeightedHDD).
- Any shorter window: fullYearGasNormalizationFactor is null — never apply the annual 2800 to part of a year. Use summary.degreeDays.referencePeriodWeightedHDD (the same calendar window averaged over the previous 10 years): corrected = actual × referencePeriodWeightedHDD ÷ totalWeightedHDD.
- Two periods: compare by the ratio of their totalWeightedHDD.
- Never weather-correct against forecast days.
- Pass energyUse to get the corrected figure computed.

SOLAR: expected yield = totalGHI_kWhM2 × kWp × 0.75–0.85; investigate only below 70% of expected. Pass solarKwp + solarYieldKwh to get the verdict computed.

INPUT: dates yyyy-MM-dd, max 730 days, from 1940 to today+14. latitude/longitude from get_building_profile coordinaten (default Utrecht). summaryOnly=true when you need no per-day rows; select=[exact field names] to keep only some fields per day. Very large responses drop their records and say so.

NOT FOR: hourly weather, locations outside the Netherlands.`;

const inputSchema = {
  latitude: z.number().min(50.75).max(53.55).optional()
    .describe('Latitude, decimal degrees, Netherlands 50.75–53.55. Default 52.09 (Utrecht). Use get_building_profile coordinaten.lat.'),
  longitude: z.number().min(3.36).max(7.23).optional()
    .describe('Longitude, decimal degrees, Netherlands 3.36–7.23. Default 5.11 (Utrecht). Use get_building_profile coordinaten.lon.'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be yyyy-MM-dd')
    .describe('Start date yyyy-MM-dd (Europe/Amsterdam), from 1940-01-01. A full year: YYYY-01-01.'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be yyyy-MM-dd')
    .describe('End date yyyy-MM-dd, inclusive, at most 730 days after dateFrom and at most today+14. A full year: YYYY-12-31.'),
  summaryOnly: z.boolean().optional().default(false)
    .describe('true = summary + interpretation only, no per-day records.'),
  select: z.array(z.string()).optional()
    .describe(`Keep only these per-day fields. Exact, case-sensitive names: ${RECORD_FIELDS.join(', ')}. Unknown names are reported with the valid list.`),
  energyUse: z.number().positive().optional()
    .describe('Heating energy used in this window (any unit, e.g. m³ gas). If passed, the weather-corrected figure is computed in summary.normalization.'),
  solarKwp: z.number().positive().optional().describe('Installed solar capacity (kWp), for the computed solar check.'),
  solarYieldKwh: z.number().nonnegative().optional().describe('Actual solar production in this window (kWh), for the computed solar check.'),
  queryIntent: z.string().optional().describe('The business question this call answers. Used for observability.'),
};

const n = z.number().nullable();
const outputSchema = {
  interpretation: z.object({
    alerts: z.array(z.string()),
    notes: z.array(z.string()),
    constants: z.record(z.string(), z.unknown()),
  }),
  recordCount: z.number(),
  summary: z.object({
    location: z.object({ latitude: z.number(), longitude: z.number(), note: z.string() }),
    period: z.object({
      dateFrom: z.string(), dateTo: z.string(), days: z.number(), measuredDays: z.number(),
      forecastDays: z.number(), archiveLagNote: z.string().nullable(), isFullYearWindow: z.boolean(),
    }),
    temperature: z.object({ periodMean: n, periodMin: n, periodMax: n, coldestDay: z.string().nullable(), hottestDay: z.string().nullable() }),
    degreeDays: z.object({
      totalHDD: n, totalWeightedHDD: n, totalCDD: n,
      referenceAnnualWeightedHDD: z.number(),
      fullYearGasNormalizationFactor: n,
      referencePeriodWeightedHDD: n,
      referencePeriod: z.object({ window: z.string(), fromYear: z.number(), toYear: z.number(), yearsUsed: z.number(), source: z.string() }).nullable(),
    }),
    normalization: z.object({
      energyUse: z.number(), normalizedEnergyUse: z.number(), reference: z.number(), referenceKind: z.string(), formula: z.string(),
    }).optional(),
    solarRadiation: z.object({ totalGHI_kWhM2: n, avgDailyGHI_kWhM2: n, totalSunshineDurationHours: n }),
    solarCheck: z.object({
      installedKwp: z.number(), actualYieldKwh: z.number(), expectedYieldKwh: z.array(z.number()),
      actualPctOfExpected: z.array(z.number()), verdict: z.string(), basis: z.string(),
    }).optional(),
    fightingSystemDays: z.object({
      rule: z.string(), count: z.number(),
      days: z.array(z.object({ date: z.string(), tempMin: z.number(), tempMax: z.number() })),
    }),
    monthlyBreakdown: z.array(z.object({ month: z.string(), weightedHDD: z.number(), totalGHI_kWhM2: z.number(), avgTempMean: z.number() })),
  }),
  records: z.array(z.record(z.string(), z.unknown())).optional(),
};

type Args = {
  latitude?: number; longitude?: number; dateFrom: string; dateTo: string; summaryOnly?: boolean;
  select?: string[]; energyUse?: number; solarKwp?: number; solarYieldKwh?: number; queryIntent?: string;
};

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export async function buildBestWeatherResponse(
  args: Args,
  deps: { query?: typeof executeWeatherQuery; archive?: ArchiveFetcher } = {}
) {
  const query = deps.query ?? executeWeatherQuery;
  const lat = args.latitude ?? DEFAULT_LAT;
  const lon = args.longitude ?? DEFAULT_LON;
  const archive: ArchiveFetcher = deps.archive ?? ((s, e) => fetchArchive(lat, lon, s, e));

  const rows = await query(args as Record<string, unknown>);
  const base = summarizeWeather(rows, args as Record<string, unknown>);
  const s = base.summary;
  const measured = rows.filter((r) => !r.isForecast);
  const measuredDays = measured.length;
  const requestedDays = daysBetween(args.dateFrom, args.dateTo);
  const fullYear = isFullYearWindow(args.dateFrom, args.dateTo);
  const none = measuredDays === 0;

  const totalWeightedHDD = none ? null : s.degreeDays.totalWeightedHDD;
  const factor =
    fullYear && measuredDays === requestedDays && totalWeightedHDD
      ? Math.round((NL_REFERENCE_ANNUAL_WEIGHTED_HDD / totalWeightedHDD) * 100) / 100
      : null;

  // Reference for a partial window: the measured part of it, same calendar dates in prior years.
  let reference: WeatherCtx['reference'] = null;
  if (!fullYear && !none) {
    const lastMeasured = measured[measured.length - 1].date;
    reference = await referencePeriodWeightedHDD(measured[0].date, lastMeasured, archive, 10, deps.archive ? '' : `${lat.toFixed(2)},${lon.toFixed(2)}`);
  }
  const ref = reference && 'referencePeriodWeightedHDD' in reference ? reference : null;

  let normalization: Normalization | null = null;
  if (args.energyUse !== undefined && totalWeightedHDD) {
    if (factor !== null)
      normalization = {
        energyUse: args.energyUse,
        normalizedEnergyUse: Math.round(args.energyUse * factor),
        reference: NL_REFERENCE_ANNUAL_WEIGHTED_HDD,
        referenceKind: 'annual (2800)',
        formula: `energyUse × 2800 ÷ totalWeightedHDD ${totalWeightedHDD}`,
      };
    else if (ref)
      normalization = {
        energyUse: args.energyUse,
        normalizedEnergyUse: Math.round((args.energyUse * ref.referencePeriodWeightedHDD) / totalWeightedHDD),
        reference: ref.referencePeriodWeightedHDD,
        referenceKind: 'reference period',
        formula: `energyUse × referencePeriodWeightedHDD ${ref.referencePeriodWeightedHDD} ÷ totalWeightedHDD ${totalWeightedHDD}`,
      };
  }

  const solarInputs = args.solarKwp !== undefined && args.solarYieldKwh !== undefined;
  const solar = solarInputs && !none ? solarCheck(s.solarRadiation.totalGHI_kWhM2, args.solarKwp!, args.solarYieldKwh!) : null;
  const fighting = fightingSystemDays(rows);

  const ctx: WeatherCtx = {
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    requestedDays,
    measuredDays,
    forecastDays: rows.length - measuredDays,
    fullYear,
    totalWeightedHDD,
    factor,
    reference,
    fighting,
    normalization,
    solar,
    solarRequestedWithoutData: (args.solarKwp !== undefined || args.solarYieldKwh !== undefined) && solar === null,
    energyUseRequestedWithoutReference: args.energyUse !== undefined && normalization === null,
    usingDefaultLocation: args.latitude === undefined,
    hddPerDay: none || totalWeightedHDD === null ? null : Math.round((totalWeightedHDD / measuredDays) * 10) / 10,
  };
  const { alerts, notes } = selectRules(WEATHER_RULES, ctx);

  let records: Record<string, unknown>[] | undefined;
  if (!args.summaryOnly) {
    const selected = applySelect(rows, args.select);
    records = selected.records as Record<string, unknown>[];
    if (args.select && args.select.length > 0 && selected.records.length === 0 && rows.length > 0) {
      alerts.unshift('select named no valid field: this is a NAMING error, not missing data — every field exists. Re-call with names from the list below.');
    }
    alerts.unshift(...selected.alerts);
  }

  const interpretation: Interpretation = { alerts, notes, constants: WEATHER_CONSTANTS };
  const nul = <T>(v: T) => (none ? null : v);
  const output = {
    interpretation,
    recordCount: rows.length,
    summary: {
      location: s.location,
      period: { ...s.period, isFullYearWindow: fullYear },
      temperature: {
        periodMean: nul(s.temperature.periodMean),
        periodMin: nul(s.temperature.periodMin),
        periodMax: nul(s.temperature.periodMax),
        coldestDay: none ? null : s.temperature.coldestDay,
        hottestDay: none ? null : s.temperature.hottestDay,
      },
      degreeDays: {
        totalHDD: nul(s.degreeDays.totalHDD),
        totalWeightedHDD,
        totalCDD: nul(s.degreeDays.totalCDD),
        referenceAnnualWeightedHDD: NL_REFERENCE_ANNUAL_WEIGHTED_HDD,
        fullYearGasNormalizationFactor: factor,
        referencePeriodWeightedHDD: ref ? ref.referencePeriodWeightedHDD : null,
        referencePeriod: ref
          ? { window: ref.window, fromYear: ref.fromYear, toYear: ref.toYear, yearsUsed: ref.yearsUsed, source: ref.source }
          : null,
      },
      ...(normalization ? { normalization } : {}),
      solarRadiation: {
        totalGHI_kWhM2: nul(s.solarRadiation.totalGHI_kWhM2),
        avgDailyGHI_kWhM2: nul(s.solarRadiation.avgDailyGHI_kWhM2),
        totalSunshineDurationHours: nul(s.solarRadiation.totalSunshineDurationHours),
      },
      ...(solar ? { solarCheck: solar } : {}),
      fightingSystemDays: {
        rule: 'tempMin < 14 °C AND tempMax > 20 °C (strict), archive days only',
        count: fighting.length,
        days: fighting,
      },
      monthlyBreakdown: s.monthlyBreakdown,
    },
    records,
  };

  if (records && JSON.stringify(output).length > MAX_RESPONSE_CHARS) {
    output.records = undefined;
    output.interpretation.alerts.unshift(
      `Records DROPPED: ${rows.length} daily rows would exceed the response size limit (a larger result is replaced by a file notice on some hosts and its interpretation is lost). The summary is complete. For per-day detail re-call with select=[the 2–4 fields you need], or a shorter window.`
    );
  }
  return output;
}

export function registerGetWeatherContextBestTool(server: McpServer): void {
  server.registerTool(
    'get_weather_context',
    {
      title: 'Weercondities & Graaddagen (Open-Meteo)',
      description: bestWeatherDescription,
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args: Args) => {
      const start = Date.now();
      try {
        const output = await buildBestWeatherResponse(args);
        await logWeatherCall(args, start, 'success', output.recordCount);
        return { structuredContent: output, content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_weather_context', variant: 'best', error: message });
        await logWeatherCall(args, start, 'error', 0);
        return { content: [{ type: 'text' as const, text: `Error in get_weather_context: ${message}` }], isError: true };
      }
    }
  );
}

async function logWeatherCall(args: Args, start: number, status: 'success' | 'error', rowCount: number): Promise<void> {
  const ctx = requestContext.getStore();
  if (!ctx) return;
  await writeToolCallLog({
    sessionId: ctx.sessionId,
    environment: ctx.environment,
    server: 'metadata-demo',
    user: 'unknown',
    userId: 'unknown',
    tool: 'get_weather_context',
    connector: 'GetWeatherContext',
    queryIntent: args.queryIntent ?? `${args.dateFrom} to ${args.dateTo}`,
    filters: [],
    filterCount: 0,
    summaryOnly: args.summaryOnly ?? false,
    skip: 0,
    take: 0,
    status,
    rowCount,
    hasMore: false,
    durationMs: Date.now() - start,
    errorType: status === 'error' ? 'ToolError' : null,
    paramsPresent: (['latitude', 'select', 'energyUse', 'solarKwp', 'solarYieldKwh', 'summaryOnly', 'queryIntent'] as const).filter(
      (k) => args[k] !== undefined && args[k] !== false
    ),
  });
}
