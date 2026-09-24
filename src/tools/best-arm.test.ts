/**
 * The reference implementation's contract: what reaches the model, and what it says about each record.
 *
 * Budgets are measured through the real transport (listTools / getInstructions), not only
 * on the constants, because what matters is what the host receives (skill delivery.md).
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { emptyProfile } from '../domain/build-profile.js';
import type { ProfileCore } from '../domain/generate-alerts.js';
import { BUILDING_RULES, UNCOVERED_BY_DESIGN, buildingCtx } from '../domain/best-building-rules.js';
import { WEATHER_RULES } from '../domain/best-weather-rules.js';
import {
  BUILDING_FIELD_NAMES,
  WEATHER_FIELD_NAMES,
  allBuildingResponseNames,
  buildingName,
} from '../domain/best-field-names.js';
import {
  bestBuildingDescription,
  bestBuildingOutputSchema,
  buildBestBuildingResponse,
} from './get-building-profile-best.js';
import {
  bestWeatherDescription,
  buildBestWeatherResponse,
  MAX_RESPONSE_CHARS,
  RECORD_FIELDS,
} from './get-weather-context-best.js';
import { outputSchema as richOutputSchema } from './get-building-profile.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import addresses from '../../evals/addresses.json' with { type: 'json' };
import weatherFixtures from '../../evals/weather-fixtures.json' with { type: 'json' };

const HOST_CUT = 2048;
const CEILING = 1800;

const noBag: BagClientLike = {
  findAddress: async () => [],
  getVerblijfsobject: async () => null,
  getPand: async () => null,
};
const noEp: EpOnlineClientLike = { getByBagVboId: async () => [] };

async function connectBest() {
  const server = createServer({ variant: 'best', bagClient: noBag, epOnlineClient: noEp });
  const [c, s] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'best-test', version: '0.0.0' });
  await Promise.all([client.connect(c), server.connect(s)]);
  return client;
}

type Key = keyof typeof addresses.addresses;
/** A profile built from the frozen key_values of one eval address (fields not captured stay null). */
function fixture(key: Key, extra: Partial<ProfileCore> = {}): ProfileCore {
  const a = addresses.addresses[key] as { adres: string; key_values: Record<string, unknown> };
  const { alerts_count: _ignored, ...kv } = a.key_values;
  return {
    ...emptyProfile(a.adres),
    matchStatus: 'exact',
    candidateCount: 1,
    labelCount: kv.energielabel ? 1 : 0,
    bag_vbo_id: '0',
    ...(kv as Partial<ProfileCore>),
    ...extra,
  } as ProfileCore;
}
const text = (r: ReturnType<typeof buildBestBuildingResponse>) => JSON.stringify(r);

// ── Delivery ───────────────────────────────────────────────────────────────────

describe('best — delivery budgets (the host cuts at 2,048)', () => {
  it('both descriptions and the instructions fit the cut, with a working ceiling, on the wire', async () => {
    const client = await connectBest();
    const { tools } = await client.listTools();
    for (const name of ['get_building_profile', 'get_weather_context']) {
      const d = tools.find((t) => t.name === name)!.description!;
      expect(d.length, name).toBeLessThanOrEqual(CEILING);
    }
    expect((client.getInstructions() ?? '').length).toBeLessThanOrEqual(900);
    expect(bestBuildingDescription.length).toBeLessThan(HOST_CUT);
  });

  it('load-bearing sentences sit early in the description', () => {
    expect(bestBuildingDescription.indexOf('NO metered')).toBeGreaterThan(-1);
    expect(bestBuildingDescription.indexOf('NO metered')).toBeLessThan(400);
    // The eight-block order (WHEN TO USE … RETURNS, then INTERPRETATION) puts the rules after
    // RETURNS; they must still sit at least ~500 chars inside the 2,048 cut.
    expect(bestBuildingDescription.indexOf('CALCULATED vs MEASURED')).toBeLessThan(1500);
    expect(bestWeatherDescription.indexOf('referencePeriodWeightedHDD')).toBeLessThan(1500);
    expect(bestWeatherDescription.indexOf('never apply the annual 2800')).toBeLessThan(1500);
    expect(bestWeatherDescription.indexOf('no address is needed')).toBeLessThan(600);
    for (const d of [bestBuildingDescription, bestWeatherDescription])
      for (const h of [
        'WHEN TO USE:',
        'WHEN NOT TO USE:',
        'RELATED TOOLS:',
        'QUERY STRATEGY:',
        'RETURNS:',
        'INTERPRETATION',
        'ALERTS:',
      ])
        expect(d, h).toContain(h);
  });

  it('exposes six tools, each with all four annotations explicit', async () => {
    const { tools } = await (await connectBest()).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'get_building_profile',
        'get_tool_call_log',
        'get_weather_context',
        'render_chart',
        'render_map',
        'render_table',
      ].sort(),
    );
    for (const name of ['get_building_profile', 'get_weather_context']) {
      const a = tools.find((t) => t.name === name)!.annotations!;
      expect(a).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    }
  });

  it('the select field list is in the INPUT description, where it is delivered', async () => {
    const { tools } = await (await connectBest()).listTools();
    const select = (
      tools.find((t) => t.name === 'get_weather_context')!.inputSchema.properties as Record<
        string,
        { description?: string }
      >
    ).select;
    for (const f of RECORD_FIELDS) expect(select.description).toContain(f);
  });

  it('never states a numeric Paris Proof threshold (the calculated-vs-measured defect)', () => {
    const forbidden = /Paris Proof[^.\n]*\d+\s*kWh|above Paris Proof/i;
    expect(bestBuildingDescription).not.toMatch(forbidden);
    for (const key of Object.keys(addresses.addresses) as Key[])
      expect(text(buildBestBuildingResponse(fixture(key)))).not.toMatch(forbidden);
  });
});

/** `YYYY-MM-DD · why · source`: a reason and where the evidence lives, no scores. */
const PROVENANCE = /^\d{4}-\d{2}-\d{2} · [^·]{8,} · \S.+$/;

// ── Names ──────────────────────────────────────────────────────────────────────

describe('best — field names (the always-delivered layer)', () => {
  it('every rename has a reason and a provenance of the form date · reason · source', () => {
    for (const r of [...BUILDING_FIELD_NAMES, ...WEATHER_FIELD_NAMES]) {
      expect(r.reason.length, r.name).toBeGreaterThan(10);
      expect(r.provenance, r.name).toMatch(PROVENANCE);
    }
  });

  it('the written-out output schema has exactly the names the rename table produces', () => {
    const fromTable = allBuildingResponseNames(Object.keys(richOutputSchema.shape).filter((k) => k !== 'alerts'));
    const inSchema = Object.keys(bestBuildingOutputSchema.shape).filter(
      (k) => !['interpretation', 'derived', 'candidates'].includes(k),
    );
    expect(inSchema).toEqual(fromTable);
  });

  it('every EP-Online energy field says it is calculated, and every numeric field carries a unit', () => {
    const names = allBuildingResponseNames(Object.keys(richOutputSchema.shape).filter((k) => k !== 'alerts'));
    const energy = names.filter((n) =>
      /^(ep1|ep2|co2|energieverbruik|warmtebehoefte|energie_index|aandeel_hernieuwbare)/.test(n),
    );
    expect(energy.length).toBeGreaterThanOrEqual(8);
    for (const n of energy) expect(n, n).toContain('berekend');
    const numeric = Object.entries(bestBuildingOutputSchema.shape)
      .filter(([, t]) => JSON.stringify((t as { _zod?: { def?: unknown } })._zod?.def ?? '').includes('number'))
      .map(([k]) => k);
    const UNIT = /(_m2|_kwh_m2|_kg_m2|_pct|_kg_jaar|_mj|_eenheidloos)$/;
    const COUNTS = [
      'candidateCount',
      'labelCount',
      'aantal_verblijfsobjecten_in_pand',
      'bouwjaar',
      'ep_online_bouwjaar',
      'coordinaten',
    ];
    for (const k of numeric) if (!COUNTS.includes(k)) expect(k, k).toMatch(UNIT);
  });

  it('no renamed upstream name leaks into a response, and Nader Voorschrift records get the _totaal_ names', () => {
    const r = text(buildBestBuildingResponse(fixture('vanbeuningen')));
    for (const row of BUILDING_FIELD_NAMES) expect(r).not.toContain(`"${row.upstream}"`);
    const nv = buildBestBuildingResponse(
      fixture('vanbeuningen', { berekeningstype: 'Nader Voorschrift', co2_emissie_kg_m2: 4200 }),
    );
    expect(nv).toHaveProperty('co2_emissie_berekend_totaal_kg_jaar', 4200);
    expect(nv).not.toHaveProperty('co2_emissie_berekend_kg_m2');
    expect(nv.derived).toMatchObject({ totalCo2KgPerYear: { value: 4200 } });
  });

  it('interpretation is the first key of every response', () => {
    expect(Object.keys(buildBestBuildingResponse(fixture('ijburglaan')))[0]).toBe('interpretation');
  });
});

// ── Rules ──────────────────────────────────────────────────────────────────────

describe('best — rule registry', () => {
  const all = [...BUILDING_RULES, ...WEATHER_RULES];

  it('ids are unique and every rule has a dated provenance', () => {
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) expect(r.provenance, r.id).toMatch(PROVENANCE);
  });

  it('building relates_to_fields exist in the response schema or under derived', () => {
    const keys = new Set(Object.keys(bestBuildingOutputSchema.shape));
    for (const r of BUILDING_RULES)
      for (const f of r.relates_to_fields) {
        const upstreamOk =
          BUILDING_FIELD_NAMES.some((x) => x.upstream === f) || keys.has(f) || f.startsWith('derived.');
        expect(upstreamOk, `${r.id} → ${f}`).toBe(true);
      }
  });

  it('coverage: every response field is explained by a rule or listed as uncovered by design', () => {
    const covered = new Set(
      BUILDING_RULES.flatMap((r) => r.relates_to_fields.map((f) => buildingName(f, { berekeningstype: null }))),
    );
    for (const r of BUILDING_RULES) for (const f of r.relates_to_fields) covered.add(f);
    const fields = Object.keys(bestBuildingOutputSchema.shape).filter(
      (k) => !['interpretation', 'derived', 'candidates'].includes(k),
    );
    const upstreamOf = (k: string) => BUILDING_FIELD_NAMES.find((x) => x.name === k)?.upstream;
    const missing = fields.filter(
      (k) => !covered.has(k) && !covered.has(upstreamOf(k) ?? '') && !(k in UNCOVERED_BY_DESIGN),
    );
    expect(missing).toEqual([]);
    for (const k of Object.keys(UNCOVERED_BY_DESIGN)) expect(fields, `stale entry ${k}`).toContain(k);
  });

  it('no rule metadata is serialized: only rendered lines reach the model', () => {
    for (const key of Object.keys(addresses.addresses) as Key[]) {
      const json = text(buildBestBuildingResponse(fixture(key)));
      expect(json).not.toMatch(/relates_to_fields|provenance"\s*:\s*"20\d\d|"applies"|"bp\.[a-z_.]+"/);
      for (const r of BUILDING_RULES) expect(json).not.toContain(r.provenance);
    }
  });

  it('rendered lines are single-line, bounded, and never carry provenance', () => {
    for (const key of Object.keys(addresses.addresses) as Key[]) {
      const ctx = buildingCtx(fixture(key));
      for (const rule of BUILDING_RULES.filter((r) => r.applies(ctx))) {
        const line = rule.render(ctx);
        expect(line, rule.id).not.toContain('\n');
        expect(line.length, rule.id).toBeLessThanOrEqual(500);
        expect(line).not.toContain(rule.provenance);
      }
    }
  });
});

// ── Per record (evals/addresses.json key_values; ground truth in evals/questions.json) ──

describe('best — per record', () => {
  it('IJburglaan 433: gas 253 m³, CO₂ 552 kg, suitable 2.73 above 50, one unit of 106', () => {
    const r = buildBestBuildingResponse(fixture('ijburglaan'));
    expect(r.derived).toMatchObject({
      spaceHeatingGasM3PerYear: { value: 253 },
      totalCo2KgPerYear: { value: 552 },
      heatPump: { band: 'suitable', nearestBoundaryKwhM2: 50, distanceToBoundaryKwhM2: 2.73, side: 'above' },
      buildingLevelAreaM2: { value: null },
    });
    expect(r.interpretation.alerts.join(' ')).toMatch(/ONE verblijfsobject of 106/);
  });

  it('Van Beuningenstraat 1: CO₂ 2630, 0.88 below 100, overheating significant', () => {
    const r = buildBestBuildingResponse(fixture('vanbeuningen'));
    expect(r.derived).toMatchObject({
      totalCo2KgPerYear: { value: 2630 },
      heatPump: {
        band: 'suitable with insulation upgrades',
        nearestBoundaryKwhM2: 100,
        distanceToBoundaryKwhM2: 0.88,
        side: 'below',
      },
      overheatingRisk: { level: 'significant', indicator: 3.59 },
    });
  });

  it('Troelstralaan 25: insulate first', () => {
    expect(buildBestBuildingResponse(fixture('troelstralaan')).derived).toMatchObject({
      heatPump: { band: 'insulate first' },
    });
  });

  it('Middenwetering 1 (NEN 7120): the null warmtebehoefte note is present, totals are null with a reason', () => {
    const r = buildBestBuildingResponse(fixture('middenwetering'));
    expect(r.interpretation.notes.join(' ')).toMatch(
      /warmtebehoefte_berekend_kwh_m2 is null: the NEN 7120 method does not produce it/,
    );
    expect(r.derived).toMatchObject({ totalCo2KgPerYear: { value: null } });
    expect((r.derived as { totalCo2KgPerYear: { reason: string } }).totalCo2KgPerYear.reason).toMatch(/thermal-zone/);
  });

  it('Gustav Mahlerlaan 10: calculated-vs-measured line, no Paris Proof verdict, area ratio 1.77', () => {
    const r = buildBestBuildingResponse(fixture('mahlerlaan'));
    expect(r.interpretation.notes.join(' ')).toMatch(/CALCULATED vs MEASURED/);
    expect(r.interpretation.alerts.join(' ')).not.toMatch(/Paris Proof/);
    expect(r.derived).toMatchObject({ thermalZoneToBagAreaRatio: { value: 1.77 } });
  });

  it('Hoogeveen: no label — says do not infer one', () => {
    const r = buildBestBuildingResponse(fixture('hoogeveen'));
    expect(r.interpretation.alerts.join(' ')).toMatch(/NO registered label.*do not infer/);
  });

  it('not found: says EP-Online was NOT queried, and has no derived values', () => {
    const r = buildBestBuildingResponse(emptyProfile('3581AE 10'));
    expect(r.interpretation.alerts[0]).toMatch(/EP-Online was NOT queried/);
    expect(r.derived).toEqual({});
  });

  it('every building response is small (no host replacement risk)', () => {
    for (const key of Object.keys(addresses.addresses) as Key[])
      expect(text(buildBestBuildingResponse(fixture(key))).length).toBeLessThan(8000);
  });

  it('the response validates against its own output schema', () => {
    for (const key of Object.keys(addresses.addresses) as Key[])
      expect(bestBuildingOutputSchema.safeParse(buildBestBuildingResponse(fixture(key))).success, key).toBe(true);
  });
});

// ── Weather ────────────────────────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof import('./get-weather-context.js').executeWeatherQuery>>[number];
function row(date: string, tempMin: number, tempMax: number, weightedHdd = 10, isForecast = false): Row {
  const tempMean = (tempMin + tempMax) / 2;
  return {
    date,
    tempMean,
    tempMin,
    tempMax,
    hdd: Math.max(0, 18 - tempMean),
    cdd: Math.max(0, tempMean - 18),
    weightedHdd,
    ghiKwhM2: 3,
    sunshineDurationHours: 5,
    weatherCode: 1,
    weatherLabel: 'Overwegend helder',
    isForecast,
  };
}
function days(from: string, n: number, make: (d: string, i: number) => Row): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < n; i++)
    out.push(make(new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), i));
  return out;
}

describe('best — weather', () => {
  const q1 = days('2024-01-01', 91, (d) => row(d, 2, 10, 1106.3 / 91));
  const archive = async (s: string, e: string) =>
    // Every prior Q1 totals exactly 1,231.3 weighted HDD (the 2014–2023 Utrecht mean), whatever its length.
    days(s, Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1, (d) => {
      const y = Number(d.slice(0, 4));
      const q1Days = y % 4 === 0 ? 91 : 90;
      return row(d, 2, 10, d.slice(5, 7) <= '03' ? 1231.3 / q1Days : 5);
    });

  it('a single quarter: no annual factor, the reference period shipped, energyUse corrected by it', async () => {
    const r = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-03-31', summaryOnly: true, energyUse: 4200 },
      { query: async () => q1, archive },
    );
    expect(r.summary.degreeDays.fullYearGasNormalizationFactor).toBeNull();
    expect(r.summary.degreeDays.referencePeriodWeightedHDD).toBeCloseTo(1231.3, 0);
    expect(r.summary.degreeDays.referencePeriod).toMatchObject({ fromYear: 2014, toYear: 2023, yearsUsed: 10 });
    // 4,200 × 1,231.3 ÷ 1,106.3.
    expect(r.summary.normalization?.normalizedEnergyUse).toBe(4675);
    expect(r.interpretation.alerts.join(' ')).toMatch(/NOT a full year/);
    expect(JSON.stringify(r)).not.toContain('2.53');
    expect(Object.keys(r)[0]).toBe('interpretation');
  });

  it('two quarters get the SAME reference, so the real improvement is 3.6%, and it says not to annualise', async () => {
    const q1_2023 = days('2023-01-01', 90, (d) => row(d, 2, 10, 1167.9 / 90));
    const r24 = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-03-31', summaryOnly: true, energyUse: 4200 },
      { query: async () => q1, archive },
    );
    const r23 = await buildBestWeatherResponse(
      { dateFrom: '2023-01-01', dateTo: '2023-03-31', summaryOnly: true, energyUse: 4600 },
      { query: async () => q1_2023, archive },
    );
    expect(r23.summary.degreeDays.referencePeriod).toEqual(r24.summary.degreeDays.referencePeriod);
    const n23 = r23.summary.normalization!.normalizedEnergyUse,
      n24 = r24.summary.normalization!.normalizedEnergyUse;
    expect((n23 - n24) / n23).toBeCloseTo(0.036, 2);
    expect(r24.interpretation.alerts.join(' ')).toMatch(/do not scale it to a full year/);
    expect(bestWeatherDescription).toMatch(/never scale a partial window up to a year/);
  });

  it('a full calendar year: the annual factor, no reference period', async () => {
    const year = days('2024-01-01', 366, (d) => row(d, 2, 10, 2479.9 / 366));
    const r = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-12-31', summaryOnly: true },
      { query: async () => year, archive },
    );
    expect(r.summary.degreeDays.fullYearGasNormalizationFactor).toBeCloseTo(1.13, 2);
    expect(r.summary.degreeDays.referencePeriodWeightedHDD).toBeNull();
  });

  it('fighting-system days: the complete list, strict on both boundaries (apr_may_2024 fixture)', async () => {
    const recs = weatherFixtures.apr_may_2024.records as { date: string; tempMin: number; tempMax: number }[];
    const rows = recs.map((x) => row(x.date, x.tempMin, x.tempMax, 3));
    const r = await buildBestWeatherResponse(
      { dateFrom: '2024-04-01', dateTo: '2024-05-31', summaryOnly: true },
      { query: async () => rows, archive },
    );
    // The 11 dates of the select-hides-the-evidence ground truth (evals/questions-weather.json).
    expect(r.summary.fightingSystemDays.days.map((d) => d.date)).toEqual([
      '2024-04-06',
      '2024-04-13',
      '2024-04-30',
      '2024-05-01',
      '2024-05-02',
      '2024-05-11',
      '2024-05-12',
      '2024-05-15',
      '2024-05-18',
      '2024-05-19',
      '2024-05-21',
    ]);
    expect(r.summary.fightingSystemDays.count).toBe(weatherFixtures.apr_may_2024.risk_days_expected);
    expect(r.interpretation.alerts.join(' ')).not.toContain('more)');
    const edge = await buildBestWeatherResponse(
      { dateFrom: '2024-04-01', dateTo: '2024-04-01', summaryOnly: true },
      { query: async () => [row('2024-04-01', 14, 20.0)], archive },
    );
    expect(edge.summary.fightingSystemDays.count).toBe(0);
  });

  it('zero measured days: aggregates are null, never 0', async () => {
    const r = await buildBestWeatherResponse(
      { dateFrom: '2099-01-01', dateTo: '2099-01-02', summaryOnly: true },
      { query: async () => [row('2099-01-01', 2, 8, 10, true)], archive },
    );
    expect(r.summary.temperature.periodMean).toBeNull();
    expect(r.summary.degreeDays.totalWeightedHDD).toBeNull();
    expect(r.interpretation.alerts.join(' ')).toMatch(/not zero/);
  });

  it('select with only unknown names is called a naming error and lists the valid names', async () => {
    const r = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-01-03', select: ['maxTemperature'] },
      { query: async () => q1.slice(0, 3), archive },
    );
    expect(r.records).toEqual([]);
    expect(r.interpretation.alerts.join(' ')).toMatch(/NAMING error/);
    expect(r.interpretation.alerts.join(' ')).toContain('tempMax');
  });

  it('a full year without projection drops its records and says so; with a 3-field select it keeps them', async () => {
    const year = days('2024-01-01', 366, (d) => row(d, 2, 10, 7));
    const full = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-12-31' },
      { query: async () => year, archive },
    );
    expect(full.records).toBeUndefined();
    expect(JSON.stringify(full).length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    expect(full.interpretation.alerts[0]).toMatch(/Records DROPPED/);
    const slim = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-12-31', select: ['date', 'weatherLabel', 'tempMax'] },
      { query: async () => year, archive },
    );
    expect(slim.records).toHaveLength(366);
  });

  it('solar check: 8,600 kWh from 12 kWp over 2024 (1,113.43 kWh/m²) is normal', async () => {
    const year = days('2024-01-01', 366, (d) => ({ ...row(d, 2, 10, 7), ghiKwhM2: 1113.43 / 366 }));
    const r = await buildBestWeatherResponse(
      { dateFrom: '2024-01-01', dateTo: '2024-12-31', summaryOnly: true, solarKwp: 12, solarYieldKwh: 8600 },
      { query: async () => year, archive },
    );
    expect(r.summary.solarCheck?.verdict).toBe('normal');
    expect(r.summary.solarCheck?.expectedYieldKwh[0]).toBeGreaterThan(9900);
  });

  it('the annual-factor field name carries its validity', () => {
    expect(WEATHER_FIELD_NAMES.map((r) => r.name)).toContain('fullYearGasNormalizationFactor');
  });
});
