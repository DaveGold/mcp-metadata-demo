/**
 * MCP tool: get_weather_context
 *
 * Historical weather data for a Dutch location and date range, with pre-computed
 * energy-relevant metrics: heating/cooling degree days, Dutch weighted graaddagen,
 * solar irradiance (GHI), and a gasNormalizationFactor for weather-corrected
 * year-over-year comparisons.
 *
 * Data sources (both free, no auth required):
 *  - Open-Meteo Historical Weather Archive API — measured data, 1940–present, ~2 day lag.
 *  - Open-Meteo Forecast API — predicted data, fills the archive lag tail + upcoming days
 *    (past_days ≤ 92, forecast_days ≤ 15 → up to today+14). Forecast days are flagged
 *    isForecast=true and excluded from all summary aggregates.
 *
 * Demonstrates the "Select" mechanism (see ../domain/project-fields.ts): a `select` input
 * field that projects daily records down to only the requested fields, for long ranges
 * where summaryOnly=true would drop the per-day detail you actually need.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../logger.js';
import { requestContext } from '../shared/log-context.js';
import { writeToolCallLog } from '../shared/log-store.js';
import { applySelect } from '../domain/project-fields.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default coordinates: Utrecht (central Netherlands) */
const DEFAULT_LAT = 52.09;
const DEFAULT_LON = 5.11;

/** Dutch long-term annual weighted HDD reference (graaddagen, base 18°C) */
const NL_REFERENCE_HDD = 2800;

/** Open-Meteo archive API endpoint (measured data) */
const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/** Open-Meteo forecast API endpoint (predicted data + recent past bridge) */
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Maximum query range in days (2 years) */
const MAX_DAYS = 730;

/** Forecast API: max days of recent past it can serve (bridges the archive lag) */
const FORECAST_MAX_PAST_DAYS = 92;

/**
 * Forecast API: max days ahead (incl. today) → covers today … today+14.
 * Capped at 15 (not 16): Open-Meteo returns a 16th day but its daily temperature
 * aggregates are often still null (far-horizon day not yet published), so a query
 * for today+15 would drop to an empty result. today+14 is the deterministic,
 * always-populated horizon — the guard promise then matches the data delivered.
 */
const FORECAST_MAX_DAYS = 15;

/** Daily variables requested from both Open-Meteo APIs (weather_code drives the calendar pictogram) */
const DAILY_PARAMS =
  'temperature_2m_mean,temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,sunshine_duration,weather_code';

// ── Date helpers (yyyy-MM-dd string math, timezone-safe) ────────────────────────
// Firebase runs UTC; a raw `new Date()` shifts the calendar day around NL midnight.
// All routing/lag math is done on yyyy-MM-dd strings interpreted as UTC calendar dates.

/** Today's calendar date in Europe/Amsterdam as yyyy-MM-dd (not server-local). */
function todayInAmsterdam(): string {
  // en-CA formats as yyyy-MM-dd
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

/** yyyy-MM-dd → epoch ms at UTC midnight. */
function ymdToUtcMs(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** epoch ms → yyyy-MM-dd (UTC). */
function utcMsToYmd(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Add (or subtract) whole days to a yyyy-MM-dd date. */
function addDays(ymd: string, days: number): string {
  return utcMsToYmd(ymdToUtcMs(ymd) + days * 86_400_000);
}

/** Whole-day difference (to − from); negative if `to` precedes `from`. */
function diffDays(from: string, to: string): number {
  return Math.round((ymdToUtcMs(to) - ymdToUtcMs(from)) / 86_400_000);
}

/** Every yyyy-MM-dd in [from, to] inclusive, ascending. */
function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = ymdToUtcMs(from); ms <= ymdToUtcMs(to); ms += 86_400_000) out.push(utcMsToYmd(ms));
  return out;
}

// ── WMO weather-code → Dutch calendar label ─────────────────────────────────────
// Derived field so consumers never have to interpret the raw WMO int themselves.

const WMO_WEATHER_LABELS: Record<number, string> = {
  0: 'Onbewolkt',
  1: 'Overwegend helder',
  2: 'Half bewolkt',
  3: 'Bewolkt',
  45: 'Mist',
  48: 'Aanvriezende mist',
  51: 'Lichte motregen',
  53: 'Motregen',
  55: 'Dichte motregen',
  56: 'Lichte aanvriezende motregen',
  57: 'Aanvriezende motregen',
  61: 'Lichte regen',
  63: 'Regen',
  65: 'Zware regen',
  66: 'Lichte ijzel',
  67: 'Zware ijzel',
  71: 'Lichte sneeuwval',
  73: 'Sneeuwval',
  75: 'Zware sneeuwval',
  77: 'Sneeuwkorrels',
  80: 'Lichte regenbuien',
  81: 'Regenbuien',
  82: 'Hevige regenbuien',
  85: 'Lichte sneeuwbuien',
  86: 'Zware sneeuwbuien',
  95: 'Onweer',
  96: 'Onweer met lichte hagel',
  99: 'Onweer met zware hagel',
};

/** Map a WMO weather code to a Dutch calendar label; null/unknown → "Onbekend". */
export function wmoWeatherLabel(code: number | null): string {
  if (code === null) return 'Onbekend';
  return WMO_WEATHER_LABELS[code] ?? 'Onbekend';
}

// ── Description ───────────────────────────────────────────────────────────────

const description = `\
RETURNS:
Daily weather for a location in the Netherlands — MEASURED (historical archive) and, for recent/upcoming
dates, FORECAST — with pre-computed energy analysis metrics:
- Daily records: date, temperatures (mean/min/max), HDD, CDD, weightedHdd, GHI (kWh/m²), sunshine hours,
  weatherCode + weatherLabel (Dutch pictogram label for calendars), and isForecast (true = predicted).
- Period summary: degree-day totals, gasNormalizationFactor, solar radiation totals, temperature stats,
  plus measuredDays / forecastDays counts.
- gasNormalizationFactor (KEY METRIC): multiply heating energy use by this to normalize to an average
  Dutch year.
The tool auto-bridges the archive's ~2-day lag with the forecast API and returns ONE continuous daily
series (no gap across today). Summary aggregates are computed over MEASURED days only.

WHEN TO USE:
- Week/day outlook: per-day weather icon + max temperature for recent AND upcoming days → query e.g.
  dateFrom=today-2, dateTo=today+7; read weatherLabel/weatherCode + tempMax per day, isForecast tells
  measured vs predicted.
- Weather-normalized energy comparison: fetch weather for two periods, compare gasNormalizationFactor
  and totalWeightedHDD to judge whether a raw consumption difference reflects usage or just weather.
- Solar-yield estimation: totalGHI_kWhM2 × installed kWp × performance ratio (0.75–0.85) gives an
  expected solar yield to compare actual production against.
- Fighting-system risk: check daily tempMin/tempMax during shoulder months (Apr–May, Sep–Oct) for wide
  swings that can trigger simultaneous heating and cooling.
- Full daily detail over a long range (e.g. a year-long calendar or chart), where summaryOnly=true would
  drop the per-day rows you need: use select=[...] to project records to only the fields you need.

WHEN NOT TO USE:
- Energy normalization on forecast days — forecast values are predictions (isForecast=true); degree-days
  and gasNormalizationFactor use MEASURED days only.
- Dates more than 14 days ahead — forecast horizon is today+14 (queries beyond it are rejected).
- Sub-daily / hourly weather — this tool is daily-granularity only.
- Locations outside the Netherlands — lat/lon validation enforces NL bounds (50.75–53.55 / 3.36–7.23).

QUERY STRATEGY:
1. For annual normalization: query full year (dateFrom=YYYY-01-01, dateTo=YYYY-12-31), summaryOnly=true
   → use gasNormalizationFactor and totalWeightedHDD from summary.
2. Location: pass coordinaten.lat / coordinaten.lon from get_building_profile as latitude/longitude. If
   unsure, omit them — default is Utrecht (52.09°N, 5.11°E), suitable for most NL locations.
3. Max range: 730 days per query. For multi-year analysis, make two queries.
4. Week/day outlook: query dateFrom=today-2, dateTo=today+7 (or up to today+14). The tool auto-bridges
   the archive lag — no need to split archive vs forecast.
5. Full daily detail over a long range where summaryOnly=true would drop rows you need: use
   select=['date','weatherLabel','tempMax'] (or similar) to project records to only the fields you need
   instead of fetching all 12 fields per day. Ignored when summaryOnly=true (no records either way).

INTERPRETATION:
- isForecast per day = MEASURED (archive) vs FORECAST (predicted). Forecast days are fine for a planning
  outlook (icon + temperature) but are excluded from degree-days, gasNormalizationFactor and solar
  totals — those summary aggregates cover the measuredDays only. Never normalize energy against a
  forecast day.
- weatherCode is the raw WMO code; prefer weatherLabel (Dutch, "Onbekend" if the code is missing) for
  display.
- gasNormalizationFactor = 2800 / totalWeightedHDD. The Dutch long-term average year has ~2800 weighted
  HDD. A cold year (factor < 1.0) means raw energy use looks high — but that's expected. A warm year
  (factor > 1.0) means raw energy use looks low.
  Formula: normalizedHeatingEnergy = actualHeatingEnergy × gasNormalizationFactor.
  IMPORTANT: gasNormalizationFactor is only valid for full-year (Jan 1–Dec 31) queries. For partial-period
  year-over-year comparison, use the HDD ratio directly: normalizedEnergy = energy × (refPeriodHDD /
  thisPeriodHDD).
- GHI (global horizontal irradiance) in kWh/m² = Peak Sun Hours (PSH) for the period.
  Expected solar yield = totalGHI_kWhM2 × installedKwp × performanceRatio (0.75–0.85 for healthy panels).
  If actual production < 70% of expected yield → investigate: inverter issue, soiling, shading, curtailment.
- Dutch weighted HDD seasonal factors: Nov–Feb ×1.1, Mar/Oct ×1.0, Apr–Sep ×0.8.
  These account for solar gain: in summer, the sun provides heat gain that partially offsets heating demand.
- select: when requested, records are projected to only the named fields. Unknown field names are
  ignored (with an alert naming them, valid fields listed). If none of the requested fields are valid,
  zero records are returned — select never silently falls back to full records.

RELATED TOOLS:
- get_building_profile(postcode, huisnummer) → coordinaten.lat / coordinaten.lon feed this tool's
  latitude/longitude directly.

ALERTS: Always check interpretation.alerts — they contain normalization guidance, forecast/measured
composition, fighting-system risk days, select-projection notes, and data quality warnings.`;

const minimalDescription = 'Look up daily weather and degree-day/solar metrics for a Dutch location and date range.';

// ── Input schema ──────────────────────────────────────────────────────────────

const inputSchema = {
  latitude: z
    .number()
    .min(50.75)
    .max(53.55)
    .optional()
    .describe(
      'Latitude in decimal degrees. Netherlands range: 50.75–53.55. Default: 52.09 (Utrecht). ' +
        'Get from get_building_profile coordinaten.lat, or use the regional default.'
    ),
  longitude: z
    .number()
    .min(3.36)
    .max(7.23)
    .optional()
    .describe(
      'Longitude in decimal degrees. Netherlands range: 3.36–7.23. Default: 5.11 (Utrecht). ' +
        'Reference points: Amsterdam 52.37/4.90, Rotterdam 51.92/4.48, Den Haag 52.07/4.30, ' +
        'Utrecht 52.09/5.11, Eindhoven 51.44/5.48, Groningen 53.22/6.57.'
    ),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be yyyy-MM-dd')
    .describe(
      'Start date in yyyy-MM-dd format. Historical data available from 1940-01-01. ' +
        'Europe/Amsterdam timezone. For annual normalization: use YYYY-01-01.'
    ),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be yyyy-MM-dd')
    .describe(
      'End date in yyyy-MM-dd format (inclusive). Max range: 730 days from dateFrom. ' +
        'May be today or up to 14 days in the future: recent/upcoming dates are served by the forecast API ' +
        '(flagged isForecast=true), which also bridges the archive’s ~2 day lag so measured days stay ' +
        'complete. Dates beyond today+14 are rejected. For annual normalization: use YYYY-12-31.'
    ),
  summaryOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, returns only aggregated summary without daily records. ' +
        'Recommended true for periods >30 days when only gasNormalizationFactor or degree-day totals are needed.'
    ),
  select: z
    .array(z.string())
    .optional()
    .describe(
      'Return only these fields per daily record — a token saver for a long range where you need per-day ' +
        'detail (e.g. a full-year calendar or chart), not just the summary. Fields: date, tempMean, tempMin, ' +
        'tempMax, hdd, cdd, weightedHdd, ghiKwhM2, sunshineDurationHours, weatherCode, weatherLabel, isForecast. ' +
        'Ignored when summaryOnly=true (no records returned either way).'
    ),
  queryIntent: z.string().optional().describe('Describe what this weather data is being used for. Used for observability.'),
};

// ── Output schema ─────────────────────────────────────────────────────────────

const outputSchema = {
  recordCount: z.number().describe('Number of daily weather records returned'),
  summary: z.object({
    location: z.object({
      latitude: z.number().describe('Latitude used for the weather query'),
      longitude: z.number().describe('Longitude used for the weather query'),
      note: z.string().describe('Whether default or custom coordinates were used'),
    }),
    period: z.object({
      dateFrom: z.string().describe('Start date of the period (yyyy-MM-dd)'),
      dateTo: z.string().describe('End date of the period (yyyy-MM-dd)'),
      days: z.number().describe('Total number of days with data returned (measured + forecast)'),
      measuredDays: z.number().describe('Number of MEASURED (archive) days — summary aggregates cover these only'),
      forecastDays: z.number().describe('Number of FORECAST (predicted) days included'),
      archiveLagNote: z.string().nullable().describe('Set only when the archive lag affected recent days'),
    }),
    temperature: z.object({
      periodMean: z.number().describe('Mean of daily mean temperatures across the period (°C)'),
      periodMin: z.number().describe('Absolute minimum temperature recorded in the period (°C)'),
      periodMax: z.number().describe('Absolute maximum temperature recorded in the period (°C)'),
      coldestDay: z.string().describe('Date (yyyy-MM-dd) with the lowest mean temperature'),
      hottestDay: z.string().describe('Date (yyyy-MM-dd) with the highest mean temperature'),
    }),
    degreeDays: z.object({
      totalHDD: z.number().describe('Sum of raw Heating Degree Days for the period (base 18°C)'),
      totalWeightedHDD: z.number().describe('Sum of Dutch weighted HDD for the period'),
      totalCDD: z.number().describe('Sum of Cooling Degree Days for the period (base 18°C)'),
      referenceAnnualHDD: z.number().describe('Dutch long-term average weighted HDD per year (2800)'),
      gasNormalizationFactor: z.number().describe('2800 / totalWeightedHDD — see INTERPRETATION'),
    }),
    solarRadiation: z.object({
      totalGHI_kWhM2: z.number().describe('Total Global Horizontal Irradiance for the period (kWh/m²)'),
      avgDailyGHI_kWhM2: z.number().describe('Average daily GHI (kWh/m²) across the period'),
      totalSunshineDurationHours: z.number().describe('Total sunshine hours for the period'),
    }),
    monthlyBreakdown: z
      .array(
        z.object({
          month: z.string().describe('Month in YYYY-MM format'),
          weightedHDD: z.number().describe('Total Dutch weighted HDD for this month'),
          totalGHI_kWhM2: z.number().describe('Total solar irradiance for this month (kWh/m²)'),
          avgTempMean: z.number().describe('Average mean daily temperature for this month (°C)'),
        })
      )
      .describe('Weather aggregated per calendar month'),
  }),
  records: z
    .array(
      z
        .object({
          date: z.string().describe('Calendar date yyyy-MM-dd (Europe/Amsterdam)'),
          tempMean: z.number().describe('Mean daily temperature (°C)'),
          tempMin: z.number().describe('Minimum daily temperature (°C)'),
          tempMax: z.number().describe('Maximum daily temperature (°C)'),
          hdd: z.number().describe('Raw Heating Degree Day (°C·day, base 18°C)'),
          cdd: z.number().describe('Cooling Degree Day (°C·day, base 18°C)'),
          weightedHdd: z.number().describe('Dutch weighted HDD for this day (°C·day)'),
          ghiKwhM2: z.number().describe('Global Horizontal Irradiance for this day (kWh/m²)'),
          sunshineDurationHours: z.number().describe('Sunshine duration for this day (hours)'),
          weatherCode: z.number().nullable().describe('Raw WMO weather code (0–99). Null when unavailable.'),
          weatherLabel: z.string().describe('Dutch weather label derived from weatherCode ("Onbekend" if null/unknown)'),
          isForecast: z.boolean().describe('true = FORECAST (predicted); false = MEASURED (archive)'),
        })
        .partial()
    )
    .optional()
    .describe(
      'Daily weather records, chronologically sorted. Omitted when summaryOnly=true. A subset of fields ' +
        'when select is used — see interpretation.alerts for which fields were selected.'
    ),
  interpretation: z.object({
    alerts: z.array(z.string()).describe('Weather context warnings and normalization guidance'),
  }),
};

// ── Open-Meteo response type ──────────────────────────────────────────────────

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    shortwave_radiation_sum: (number | null)[];
    sunshine_duration: (number | null)[];
    weather_code?: (number | null)[];
  };
}

interface WeatherDayRow {
  date: string;
  tempMean: number;
  tempMin: number;
  tempMax: number;
  hdd: number;
  cdd: number;
  weightedHdd: number;
  ghiKwhM2: number;
  sunshineDurationHours: number;
  weatherCode: number | null;
  weatherLabel: string;
  isForecast: boolean;
}

// ── Degree-day helpers ────────────────────────────────────────────────────────

const BASE_TEMP = 18; // °C, Dutch standard

export function computeWeightedHdd(month: number, rawHdd: number): number {
  // month: 1–12
  let weight: number;
  if (month >= 11 || month <= 2)
    weight = 1.1; // Nov–Feb: weaker sun
  else if (month === 3 || month === 10)
    weight = 1.0; // Mar, Oct: neutral
  else weight = 0.8; // Apr–Sep: stronger sun
  return Math.round(rawHdd * weight * 100) / 100;
}

// ── Open-Meteo fetch + row building ─────────────────────────────────────────────

/** Convert Open-Meteo parallel daily arrays into WeatherDayRow[], stamping isForecast. */
export function buildRows(daily: OpenMeteoResponse['daily'] | undefined, isForecast: boolean): WeatherDayRow[] {
  const rows: WeatherDayRow[] = [];
  if (!daily?.time?.length) return rows;

  for (let i = 0; i < daily.time.length; i++) {
    const tempMean = daily.temperature_2m_mean[i];
    const tempMin = daily.temperature_2m_min[i];
    const tempMax = daily.temperature_2m_max[i];
    const ghiMjM2 = daily.shortwave_radiation_sum[i];
    const sunshineSec = daily.sunshine_duration[i];
    const weatherCode = daily.weather_code?.[i] ?? null;

    // Skip days with missing core data (archive lag for recent dates).
    // `== null` also catches `undefined` from a short/malformed upstream array (avoids NaN rows).
    if (tempMean == null || tempMin == null || tempMax == null) continue;

    const rawHdd = Math.max(0, BASE_TEMP - tempMean);
    const rawCdd = Math.max(0, tempMean - BASE_TEMP);
    const month = parseInt(daily.time[i].slice(5, 7), 10);

    rows.push({
      date: daily.time[i],
      tempMean: Math.round(tempMean * 10) / 10,
      tempMin: Math.round(tempMin * 10) / 10,
      tempMax: Math.round(tempMax * 10) / 10,
      hdd: Math.round(rawHdd * 100) / 100,
      cdd: Math.round(rawCdd * 100) / 100,
      weightedHdd: computeWeightedHdd(month, rawHdd),
      // Open-Meteo returns MJ/m² — convert to kWh/m² (÷ 3.6)
      ghiKwhM2: ghiMjM2 != null ? Math.round((ghiMjM2 / 3.6) * 100) / 100 : 0,
      // Open-Meteo returns seconds — convert to hours
      sunshineDurationHours: sunshineSec != null ? Math.round((sunshineSec / 3600) * 10) / 10 : 0,
      weatherCode,
      weatherLabel: wmoWeatherLabel(weatherCode),
      isForecast,
    });
  }

  return rows;
}

/** Fetch an Open-Meteo endpoint and return its `daily` block (or throw on HTTP error). */
async function fetchOpenMeteoDaily(url: string): Promise<OpenMeteoResponse['daily'] | undefined> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Open-Meteo API error: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
    );
  }

  const data = (await response.json()) as OpenMeteoResponse;
  return data.daily;
}

/** Archive (measured) rows for [startDate, endDate] inclusive. */
async function fetchArchive(lat: number, lon: number, startDate: string, endDate: string): Promise<WeatherDayRow[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: startDate,
    end_date: endDate,
    daily: DAILY_PARAMS,
    timezone: 'Europe/Amsterdam',
  });
  return buildRows(await fetchOpenMeteoDaily(`${OPEN_METEO_ARCHIVE_URL}?${params.toString()}`), false);
}

/** Forecast (predicted) rows spanning [today − pastDays, today + forecastDays − 1]. */
async function fetchForecast(
  lat: number,
  lon: number,
  pastDays: number,
  forecastDays: number
): Promise<WeatherDayRow[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    daily: DAILY_PARAMS,
    timezone: 'Europe/Amsterdam',
  });
  return buildRows(await fetchOpenMeteoDaily(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`), true);
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeWeather(records: WeatherDayRow[], args: Record<string, unknown>) {
  const alerts: string[] = [];
  const lat = (args.latitude as number | undefined) ?? DEFAULT_LAT;
  const lon = (args.longitude as number | undefined) ?? DEFAULT_LON;
  const usingDefault = args.latitude === undefined;
  const dateFrom = args.dateFrom as string;
  const dateTo = args.dateTo as string;

  // Aggregates run over MEASURED (archive) rows only — forecast values must never enter
  // degree-days / gasNormalizationFactor / solar totals (they'd corrupt energy normalization).
  const measuredRows = records.filter((r) => !r.isForecast);
  const measuredDays = measuredRows.length;
  const forecastDays = records.length - measuredDays;

  const requestedDays = diffDays(dateFrom, dateTo) + 1;
  const isFullYear = requestedDays >= 330;

  if (forecastDays > 0) {
    alerts.push(
      `${forecastDays} of ${records.length} day(s) are FORECAST (predicted), flagged isForecast=true in records. ` +
        `Degree-days, gasNormalizationFactor and solar totals are computed over the ${measuredDays} measured day(s) only. ` +
        'Do not use forecast values for energy normalization.'
    );
  }

  const lagDays = diffDays(dateTo, todayInAmsterdam());
  const archiveLagNote =
    forecastDays > 0 && lagDays >= 0 && lagDays < 3
      ? 'Recent range requested — the archive has a ~2-day lag, so the most recent day(s) are served ' +
        'by the forecast API (flagged isForecast=true) instead of measured archive data.'
      : null;

  if (measuredDays === 0) {
    return {
      summary: {
        location: {
          latitude: lat,
          longitude: lon,
          note: usingDefault
            ? 'Default regional coordinates (Utrecht)'
            : `Custom coordinates (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
        },
        period: { dateFrom, dateTo, days: records.length, measuredDays, forecastDays, archiveLagNote },
        temperature: { periodMean: 0, periodMin: 0, periodMax: 0, coldestDay: '', hottestDay: '' },
        degreeDays: {
          totalHDD: 0,
          totalWeightedHDD: 0,
          totalCDD: 0,
          referenceAnnualHDD: NL_REFERENCE_HDD,
          gasNormalizationFactor: 0,
        },
        solarRadiation: { totalGHI_kWhM2: 0, avgDailyGHI_kWhM2: 0, totalSunshineDurationHours: 0 },
        monthlyBreakdown: [],
      },
      interpretation: { alerts },
    };
  }

  const means = measuredRows.map((r) => r.tempMean);
  const mins = measuredRows.map((r) => r.tempMin);
  const maxs = measuredRows.map((r) => r.tempMax);
  const periodMean = Math.round((means.reduce((s, v) => s + v, 0) / means.length) * 10) / 10;
  const periodMin = Math.round(Math.min(...mins) * 10) / 10;
  const periodMax = Math.round(Math.max(...maxs) * 10) / 10;
  const coldestDay = measuredRows.reduce((a, b) => (a.tempMean <= b.tempMean ? a : b)).date;
  const hottestDay = measuredRows.reduce((a, b) => (a.tempMean >= b.tempMean ? a : b)).date;

  const totalHDD = Math.round(measuredRows.reduce((s, r) => s + r.hdd, 0) * 10) / 10;
  const totalWeightedHDD = Math.round(measuredRows.reduce((s, r) => s + r.weightedHdd, 0) * 10) / 10;
  const totalCDD = Math.round(measuredRows.reduce((s, r) => s + r.cdd, 0) * 10) / 10;

  const gasNormalizationFactor =
    totalWeightedHDD > 0 ? Math.round((NL_REFERENCE_HDD / totalWeightedHDD) * 100) / 100 : 0;

  const totalGHI = Math.round(measuredRows.reduce((s, r) => s + r.ghiKwhM2, 0) * 100) / 100;
  const avgDailyGHI = Math.round((totalGHI / measuredRows.length) * 100) / 100;
  const totalSunshine = Math.round(measuredRows.reduce((s, r) => s + r.sunshineDurationHours, 0) * 10) / 10;

  if (archiveLagNote) alerts.push(archiveLagNote);

  // Base load detection: use HDD density (per-day), not absolute total — a short winter
  // period can have low absolute HDD but high daily intensity.
  const hddDensity = totalWeightedHDD / measuredRows.length;
  if (hddDensity < 2.5) {
    alerts.push(
      `Very low average heating intensity (${hddDensity.toFixed(1)} weighted HDD/day, ${totalWeightedHDD} total) — ` +
        'energy use in this period is largely base load, not space heating. ' +
        'Do not apply gasNormalizationFactor to base load.'
    );
  } else if (gasNormalizationFactor >= 1.2 || gasNormalizationFactor <= 0.8) {
    const roundedFactor = Math.round(gasNormalizationFactor * 100) / 100;
    const direction = gasNormalizationFactor >= 1.2 ? 'Warmer' : 'Colder';
    const rawEffect = gasNormalizationFactor >= 1.2 ? 'lower' : 'higher';
    if (isFullYear) {
      alerts.push(
        `${direction} than average Dutch year (factor ${roundedFactor}×, ${totalWeightedHDD} vs 2800 annual reference HDD). ` +
          `Raw heating energy use appears ${rawEffect} than a typical year. ` +
          `Multiply heating energy use by ${roundedFactor} for a weather-corrected comparison.`
      );
    } else {
      alerts.push(
        `This ${requestedDays}-day period had ${totalWeightedHDD} weighted HDD (${hddDensity.toFixed(1)}/day). ` +
          `gasNormalizationFactor = ${roundedFactor}× (= 2800 / ${totalWeightedHDD}). ` +
          'Note: gasNormalizationFactor is designed for full-year (Jan 1–Dec 31) normalization. ' +
          'For same-period year-over-year comparison, use the HDD ratio directly: ' +
          'normalizedEnergy = actualEnergy × (periodHDD_referenceYear / periodHDD_thisYear).'
      );
    }
  }

  const fightingDays = measuredRows.filter((r) => r.tempMin < 14 && r.tempMax > 20);
  if (fightingDays.length > 0) {
    const dayList = fightingDays
      .slice(0, 5)
      .map((r) => `${r.date} (min ${r.tempMin}°C / max ${r.tempMax}°C)`)
      .join(', ');
    const more = fightingDays.length > 5 ? ` (+${fightingDays.length - 5} more)` : '';
    alerts.push(
      `${fightingDays.length} fighting-system risk day(s) detected (tempMin < 14°C AND tempMax > 20°C): ${dayList}${more}. ` +
        'A simultaneous morning heating peak and afternoon cooling peak on these days is the signature to look for.'
    );
  }

  if (usingDefault) {
    alerts.push('Using default coordinates (Utrecht 52.09°N, 5.11°E). Provide latitude/longitude for a specific location.');
  }

  const monthMap = new Map<string, WeatherDayRow[]>();
  for (const r of measuredRows) {
    const month = r.date.slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(r);
  }
  const monthlyBreakdown = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, days]) => ({
      month,
      weightedHDD: Math.round(days.reduce((s, r) => s + r.weightedHdd, 0) * 10) / 10,
      totalGHI_kWhM2: Math.round(days.reduce((s, r) => s + r.ghiKwhM2, 0) * 100) / 100,
      avgTempMean: Math.round((days.reduce((s, r) => s + r.tempMean, 0) / days.length) * 10) / 10,
    }));

  return {
    summary: {
      location: {
        latitude: lat,
        longitude: lon,
        note: usingDefault
          ? 'Default regional coordinates (Utrecht)'
          : `Custom coordinates (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
      },
      period: { dateFrom, dateTo, days: records.length, measuredDays, forecastDays, archiveLagNote },
      temperature: { periodMean, periodMin, periodMax, coldestDay, hottestDay },
      degreeDays: { totalHDD, totalWeightedHDD, totalCDD, referenceAnnualHDD: NL_REFERENCE_HDD, gasNormalizationFactor },
      solarRadiation: { totalGHI_kWhM2: totalGHI, avgDailyGHI_kWhM2: avgDailyGHI, totalSunshineDurationHours: totalSunshine },
      monthlyBreakdown,
    },
    interpretation: { alerts },
  };
}

// ── Query execution (archive + forecast routing) ────────────────────────────────

/**
 * Fetch a continuous daily weather series for [dateFrom, dateTo], bridging the archive
 * lag with the forecast API. Measured days come from the archive (isForecast=false),
 * recent/upcoming days from the forecast API (isForecast=true). Exported for unit tests.
 */
export async function executeWeatherQuery(args: Record<string, unknown>): Promise<WeatherDayRow[]> {
  const lat = (args.latitude as number | undefined) ?? DEFAULT_LAT;
  const lon = (args.longitude as number | undefined) ?? DEFAULT_LON;
  const dateFrom = args.dateFrom as string;
  const dateTo = args.dateTo as string;

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error(`Invalid date format. Use yyyy-MM-dd. Got: dateFrom=${dateFrom}, dateTo=${dateTo}`);
  }
  if (dateTo < dateFrom) {
    throw new Error(`dateTo (${dateTo}) must be >= dateFrom (${dateFrom})`);
  }
  const daysDiff = diffDays(dateFrom, dateTo) + 1;
  if (daysDiff > MAX_DAYS) {
    throw new Error(`Date range too large: ${daysDiff} days (max ${MAX_DAYS}). Split into multiple queries.`);
  }

  const today = todayInAmsterdam();
  const forecastHorizon = addDays(today, FORECAST_MAX_DAYS - 1); // today+14
  if (dateTo > forecastHorizon) {
    throw new Error(
      `dateTo (${dateTo}) is beyond the forecast horizon (${forecastHorizon}, today+${FORECAST_MAX_DAYS - 1}). ` +
        `Weather forecast is only available up to ${FORECAST_MAX_DAYS - 1} days ahead.`
    );
  }

  // 1. Archive (measured) for [dateFrom, min(dateTo, today)] — skip if the whole range is future.
  let archiveRows: WeatherDayRow[] = [];
  if (dateFrom <= today) {
    const archiveEnd = dateTo < today ? dateTo : today;
    archiveRows = await fetchArchive(lat, lon, dateFrom, archiveEnd);
  }

  // 2. Missing dates = every in-range day not returned by archive (lag tail, future days, rare
  //    internal null gaps), restricted to the forecast window [today-92, today+14].
  const returned = new Set(archiveRows.map((row) => row.date));
  const windowStart = addDays(today, -FORECAST_MAX_PAST_DAYS);
  const missing = enumerateDates(dateFrom, dateTo).filter(
    (date) => !returned.has(date) && date >= windowStart && date <= forecastHorizon
  );

  // 3. One forecast call sized to span the missing dates; keep only the days we actually need.
  let forecastRows: WeatherDayRow[] = [];
  if (missing.length > 0) {
    const earliestMissing = missing[0];
    const latestMissing = missing[missing.length - 1];
    const pastDays = Math.min(FORECAST_MAX_PAST_DAYS, Math.max(0, diffDays(earliestMissing, today)));
    const forecastDays = Math.min(FORECAST_MAX_DAYS, Math.max(1, diffDays(today, latestMissing) + 1));
    const missingSet = new Set(missing);
    const rows = await fetchForecast(lat, lon, pastDays, forecastDays);
    forecastRows = rows.filter((row) => missingSet.has(row.date));
  }

  // 4. Merge + dedup (archive wins on overlap) + sort → one continuous series, no gap across today.
  const byDate = new Map<string, WeatherDayRow>();
  for (const row of forecastRows) byDate.set(row.date, row);
  for (const row of archiveRows) byDate.set(row.date, row);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerGetWeatherContextTool(server: McpServer, opts: { minimal?: boolean } = {}): void {
  server.registerTool(
    'get_weather_context',
    {
      title: 'Weercondities & Graaddagen (Open-Meteo)',
      description: opts.minimal ? minimalDescription : description,
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: Record<string, unknown>) => {
      const start = Date.now();

      try {
        const records = await executeWeatherQuery(args);
        const summaryOnly = (args.summaryOnly as boolean) ?? false;

        const { summary, interpretation } = summarizeWeather(records, args);

        let outputRecords: unknown[] | undefined;
        if (!summaryOnly) {
          const selected = applySelect(records, args.select as string[] | undefined);
          outputRecords = selected.records;
          interpretation.alerts.push(...selected.alerts);
        }

        const output = { recordCount: records.length, summary, records: outputRecords, interpretation };

        await logToolCall({ args, start, status: 'success', rowCount: records.length });

        return {
          structuredContent: output,
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('tool.error', { tool: 'get_weather_context', error: errorMessage });
        await logToolCall({ args, start, status: 'error', rowCount: 0 });
        return {
          content: [{ type: 'text' as const, text: `Error in get_weather_context: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Emit a `tool.invoked` audit row. No-op when no request context is active
 * (stdio transport / local dev), mirroring the other tool-log helpers.
 */
async function logToolCall({
  args,
  start,
  status,
  rowCount,
}: {
  args: Record<string, unknown>;
  start: number;
  status: 'success' | 'error';
  rowCount: number;
}): Promise<void> {
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
    queryIntent: (args.queryIntent as string | undefined) ?? `${args.dateFrom} to ${args.dateTo}`,
    filters: [],
    filterCount: 0,
    summaryOnly: (args.summaryOnly as boolean) ?? false,
    skip: 0,
    take: 0,
    status,
    rowCount,
    hasMore: false,
    durationMs: Date.now() - start,
    errorType: status === 'error' ? 'ToolError' : null,
  });
}
