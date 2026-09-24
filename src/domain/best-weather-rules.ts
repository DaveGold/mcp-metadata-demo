/**
 * Computed values and record-conditional rules for get_weather_context (reference implementation).
 *
 * Numbers come from the shared summarizeWeather; this file decides what the response SAYS about
 * them. The rule shape, and why provenance is never serialized: best-rules.ts.
 */

import type { Rule } from './best-rules.js';
import type { ReferencePeriod } from './reference-period.js';

export const NL_REFERENCE_ANNUAL_WEIGHTED_HDD = 2800;
export const SOLAR_PERFORMANCE_RATIO = [0.75, 0.85] as const;
export const SOLAR_INVESTIGATE_BELOW = 0.7;
export const FIGHTING_TEMP_MIN_BELOW_C = 14;
export const FIGHTING_TEMP_MAX_ABOVE_C = 20;

export const WEATHER_CONSTANTS = {
  hddBaseTempC: 18,
  hddWeightNovFeb: 1.1,
  hddWeightMarOct: 1.0,
  hddWeightAprSep: 0.8,
  referenceAnnualWeightedHDD: NL_REFERENCE_ANNUAL_WEIGHTED_HDD,
  solarPerformanceRatio: [...SOLAR_PERFORMANCE_RATIO],
  solarInvestigateBelowFractionOfExpected: SOLAR_INVESTIGATE_BELOW,
  fightingDayTempMinBelowC: FIGHTING_TEMP_MIN_BELOW_C,
  fightingDayTempMaxAboveC: FIGHTING_TEMP_MAX_ABOVE_C,
};

export interface DayMinMax {
  date: string;
  tempMin: number;
  tempMax: number;
}

/** Strict on both sides: a day at exactly 14.0 / 20.0 is NOT a fighting day. */
export function fightingSystemDays(rows: readonly (DayMinMax & { isForecast?: boolean })[]): DayMinMax[] {
  return rows
    .filter((r) => !r.isForecast && r.tempMin < FIGHTING_TEMP_MIN_BELOW_C && r.tempMax > FIGHTING_TEMP_MAX_ABOVE_C)
    .map(({ date, tempMin, tempMax }) => ({ date, tempMin, tempMax }));
}

/** Exactly 12 whole consecutive months: dateTo is the day before dateFrom one year later. */
export function isFullYearWindow(dateFrom: string, dateTo: string): boolean {
  const y = Number(dateFrom.slice(0, 4));
  const md = dateFrom.slice(4);
  const next = new Date(`${y + 1}${md}T00:00:00Z`);
  if (Number.isNaN(next.getTime())) return false;
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10) === dateTo;
}

export interface SolarCheck {
  installedKwp: number;
  actualYieldKwh: number;
  expectedYieldKwh: [number, number];
  actualPctOfExpected: [number, number];
  verdict: 'normal' | 'borderline' | 'investigate';
  basis: string;
}

export function solarCheck(totalGhiKwhM2: number, kwp: number, actualKwh: number): SolarCheck {
  const lo = Math.round(totalGhiKwhM2 * kwp * SOLAR_PERFORMANCE_RATIO[0]);
  const hi = Math.round(totalGhiKwhM2 * kwp * SOLAR_PERFORMANCE_RATIO[1]);
  const verdict: SolarCheck['verdict'] =
    actualKwh >= SOLAR_INVESTIGATE_BELOW * hi
      ? 'normal'
      : actualKwh < SOLAR_INVESTIGATE_BELOW * lo
        ? 'investigate'
        : 'borderline';
  return {
    installedKwp: kwp,
    actualYieldKwh: actualKwh,
    expectedYieldKwh: [lo, hi],
    actualPctOfExpected: [Math.round((actualKwh / hi) * 100), Math.round((actualKwh / lo) * 100)],
    verdict,
    basis: `totalGHI_kWhM2 ${totalGhiKwhM2} × ${kwp} kWp × performance ratio ${SOLAR_PERFORMANCE_RATIO.join('–')}; investigate below ${SOLAR_INVESTIGATE_BELOW * 100}% of expected`,
  };
}

export interface Normalization {
  energyUse: number;
  normalizedEnergyUse: number;
  reference: number;
  referenceKind: 'annual (2800)' | 'reference period';
  formula: string;
}

export interface WeatherCtx {
  dateFrom: string;
  dateTo: string;
  requestedDays: number;
  measuredDays: number;
  forecastDays: number;
  fullYear: boolean;
  totalWeightedHDD: number | null;
  factor: number | null;
  reference: ReferencePeriod | { value: null; reason: string } | null;
  fighting: DayMinMax[];
  normalization: Normalization | null;
  solar: SolarCheck | null;
  solarRequestedWithoutData: boolean;
  energyUseRequestedWithoutReference: boolean;
  usingDefaultLocation: boolean;
  hddPerDay: number | null;
}

const hasRef = (r: WeatherCtx['reference']): r is ReferencePeriod => !!r && 'referencePeriodWeightedHDD' in r;

export const WEATHER_RULES: readonly Rule<WeatherCtx>[] = [
  {
    id: 'wx.no_measured',
    kind: 'branch',
    relates_to_fields: ['summary.period.measuredDays'],
    applies: (c) => c.measuredDays === 0,
    render: () =>
      'No MEASURED (archive) days in this window: every temperature, degree-day and solar aggregate is null — not zero. Nothing can be weather-corrected yet.',
    provenance:
      '2026-09-23 · with no measured days the summarizer returns 0 °C and factor 0, which read as measurements; say null instead · docs/weather-findings.md',
  },
  {
    id: 'wx.forecast',
    kind: 'branch',
    relates_to_fields: ['summary.period.forecastDays', 'records.isForecast'],
    applies: (c) => c.forecastDays > 0,
    render: (c) =>
      `${c.forecastDays} of ${c.measuredDays + c.forecastDays} days are FORECAST (isForecast=true). All aggregates cover the ${c.measuredDays} measured days only. Do not present a normalization over this window as measured: normalize the measured days and say so, or wait until the window has closed.`,
    provenance: '2026-08-29 · forecast days are not measurements; aggregates cover archive days only · PR #20',
  },
  {
    id: 'wx.full_year',
    kind: 'verdict',
    relates_to_fields: ['summary.degreeDays.fullYearGasNormalizationFactor', 'summary.degreeDays.totalWeightedHDD'],
    applies: (c) => c.fullYear && c.factor !== null,
    render: (c) =>
      `Full 12-month window: fullYearGasNormalizationFactor ${c.factor} (= 2800 ÷ totalWeightedHDD ${c.totalWeightedHDD}). Weather-corrected heating energy = actual × ${c.factor}.`,
    provenance: '2026-08-29 · the 2800 reference is annual, so its factor is valid for a full year only · PR #20',
  },
  {
    id: 'wx.partial.reference',
    kind: 'verdict',
    relates_to_fields: [
      'summary.degreeDays.referencePeriodWeightedHDD',
      'summary.degreeDays.totalWeightedHDD',
      'summary.degreeDays.fullYearGasNormalizationFactor',
    ],
    applies: (c) => !c.fullYear && c.measuredDays > 0 && hasRef(c.reference),
    render: (c) => {
      const r = c.reference as ReferencePeriod;
      return `This ${c.requestedDays}-day window is NOT a full year, so fullYearGasNormalizationFactor is null — never apply 2800 to part of a year. Its reference is referencePeriodWeightedHDD ${r.referencePeriodWeightedHDD} (mean of ${r.window} over the fixed span ${r.fromYear}–${r.toYear}, the same for every query year, so two periods corrected this way are comparable). Weather-corrected energy = actual × ${r.referencePeriodWeightedHDD} ÷ totalWeightedHDD ${c.totalWeightedHDD}. That is the figure for THIS window in a normal year — do not scale it to a full year: a window's share of annual use depends on base load and the heating season, which this data does not contain.`;
    },
    provenance:
      "2026-09-23 · for a partial year the fix is the same window's reference, shipped as data, not the annual factor · evals/results/2026-09-23-q16-fetch-vs-apply.json",
  },
  {
    id: 'wx.partial.no_reference',
    kind: 'branch',
    relates_to_fields: ['summary.degreeDays.referencePeriodWeightedHDD'],
    applies: (c) => !c.fullYear && c.measuredDays > 0 && !hasRef(c.reference),
    render: (c) =>
      `This ${c.requestedDays}-day window is NOT a full year and no reference period could be computed (${c.reference && 'reason' in c.reference ? c.reference.reason : 'not available'}). Never apply 2800 to part of a year; compare against the same window in another year by the ratio of their totalWeightedHDD.`,
    provenance:
      '2026-08-29 · when the reference cannot be fetched, degrade with a reason instead of failing the call · PR #20',
  },
  {
    id: 'wx.normalization',
    kind: 'verdict',
    relates_to_fields: ['summary.normalization'],
    applies: (c) => c.normalization !== null,
    render: (c) => {
      const n = c.normalization as Normalization;
      return `Weather-corrected energy use: ${n.normalizedEnergyUse} (from ${n.energyUse}; ${n.formula}). This is the weather-corrected use for this window only; do not scale it to a year. Base load (hot water, cooking) is scaled too, so treat small differences with care.`;
    },
    provenance:
      '2026-09-23 · when the caller passes energyUse the correction is determinate, so the server computes it · evals/results/2026-09-21-readable-ladder-gas.json',
  },
  {
    id: 'wx.energy_without_reference',
    kind: 'branch',
    relates_to_fields: ['summary.normalization'],
    applies: (c) => c.energyUseRequestedWithoutReference,
    render: () =>
      'energyUse was passed but no valid reference exists for this window, so no normalized figure is returned.',
    provenance:
      '2026-09-23 · an input that did nothing must say so · .claude/skills/rich-domain-mcp-server/references/discovery.md',
  },
  {
    id: 'wx.solar',
    kind: 'verdict',
    relates_to_fields: ['summary.solarCheck', 'summary.solarRadiation.totalGHI_kWhM2'],
    applies: (c) => c.solar !== null,
    render: (c) => {
      const s = c.solar as SolarCheck;
      return `Solar yield: ${s.verdict.toUpperCase()} — ${s.actualYieldKwh} kWh is ${s.actualPctOfExpected[0]}–${s.actualPctOfExpected[1]}% of the expected ${s.expectedYieldKwh[0]}–${s.expectedYieldKwh[1]} kWh (${s.basis}).`;
    },
    provenance: '2026-08-29 · performance ratio 0.75–0.85, investigate below 70% of expected · PR #20',
  },
  {
    id: 'wx.solar_without_data',
    kind: 'branch',
    relates_to_fields: ['summary.solarCheck'],
    applies: (c) => c.solarRequestedWithoutData,
    render: () =>
      'solarKwp and solarYieldKwh must both be passed, over a window with measured days, for a solar check; none was computed.',
    provenance:
      '2026-09-23 · an input that did nothing must say so · .claude/skills/rich-domain-mcp-server/references/discovery.md',
  },
  {
    id: 'wx.fighting',
    kind: 'verdict',
    relates_to_fields: ['summary.fightingSystemDays', 'records.tempMin', 'records.tempMax'],
    applies: (c) => c.fighting.length > 0,
    render: (c) =>
      `${c.fighting.length} fighting-system day(s) (tempMin < 14 °C AND tempMax > 20 °C, both strict), COMPLETE list: ${c.fighting.map((d) => d.date).join(', ')}. Values per day in summary.fightingSystemDays.days.`,
    provenance:
      '2026-09-23 · a truncated list ("+6 more") hid the boundary days; ship the whole list · evals/results/2026-09-23-q11-select.json',
  },
  {
    id: 'wx.base_load',
    kind: 'fact',
    relates_to_fields: ['summary.degreeDays.totalWeightedHDD'],
    applies: (c) => c.hddPerDay !== null && c.hddPerDay < 2.5,
    render: (c) =>
      `Low heating intensity (${c.hddPerDay} weighted HDD/day): energy use in this window is mostly base load, not space heating; weather correction explains little of it.`,
    provenance: '2026-08-29 · reason not recorded · PR #20',
  },
  {
    id: 'wx.weighting',
    kind: 'fact',
    relates_to_fields: ['records.weightedHdd', 'records.hdd', 'summary.degreeDays.totalWeightedHDD'],
    applies: (c) => c.measuredDays > 0,
    render: () =>
      'Dutch gas normalization uses WEIGHTED degree days (weightedHdd: base 18 °C, ×1.1 Nov–Feb, ×1.0 Mar/Oct, ×0.8 Apr–Sep for solar gain), not raw hdd. To compare two periods, use the ratio of their totalWeightedHDD.',
    provenance: '2026-08-29 · weighted degree days are the Dutch standard for gas correction, not raw HDD · PR #20',
  },
  {
    id: 'wx.default_location',
    kind: 'fact',
    relates_to_fields: ['summary.location'],
    applies: (c) => c.usingDefaultLocation,
    render: () =>
      'Default coordinates used (Utrecht 52.09 N, 5.11 E). For a specific building pass coordinaten.lat/lon from get_building_profile.',
    provenance: '2026-08-29 · reason not recorded · PR #20',
  },
];
