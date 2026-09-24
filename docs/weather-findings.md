# get_weather_context — findings

Open-Meteo historical archive (`archive-api.open-meteo.com/v1/archive`) plus the forecast API
for the archive's ~2-day lag and up to today+14. Keyless. Frozen reference values:
`evals/weather-fixtures.json`.

Structure per `.claude/skills/rich-domain-mcp-server/references/recording.md`; sections
without new findings are omitted.

## 2. Real scope

- Archive from 1940-01-01, daily. The archive is a reanalysis product built from
  observations, not station readings; the tool calls it "measured" to separate it from
  forecast. `[CONFIDENCE: MEDIUM — Open-Meteo documentation. TODO: DOMAIN EXPERT — is a
  reanalysis-based degree-day series acceptable for gas normalization, or should KNMI station
  data be used?]`
- Q1 2024 Utrecht: 1,106.3 weighted HDD; Q1 2023: 1,167.9; 2024: 2,479.9; GHI 2024:
  1,113.43 kWh/m² (fixture file, captured 2026-09-22).

## 5. Row shape

- Days with a null temperature (archive lag) are skipped, then bridged from the forecast API
  and flagged `isForecast: true`. All aggregates use archive days only.
- The fixed 2,800 weighted-HDD "normal year" is divided by Open-Meteo grid-point sums.
  `[CONFIDENCE: LOW — never checked. TODO: compare Open-Meteo's own 10-year mean annual
  weighted HDD at Utrecht with 2,800; above ~3% apart, every full-year factor is biased.]`

## 7. Known defects (in this repo's own `rich` weather tool)

- `gasNormalizationFactor` is returned for any window, including a single quarter (2.53 for
  Q1 2024 = 2800 ÷ 1106.3). The rule against using it sits at description char 3,958, past the
  2,048 cut. Q12b: with no rule 16/20 runs took that road.
- Zero measured days returns `periodMean: 0`, `gasNormalizationFactor: 0` — zeros that read as
  measurements.
- `isFullYear` is "≥ 330 days", not "12 whole months".
- The fighting-system alert truncates after five dates with "(+N more)"; Q11 sonnet scored
  0/20 on the boundary days of that question.
- `openWorldHint: false` on a tool that calls an external API.

### In the `best` arm (found by Q19, 2026-09-24)

- **The reference period moves with the query.** `referencePeriodWeightedHDD` is the mean of the
  same window over the 10 years BEFORE the window, so Q1 2023 is referenced to 2013–2022 and Q1
  2024 to 2014–2023. Normalising both quarters to their own reference and comparing them gives a
  6.6% real improvement where 3.6% is right. `weather-partial-normalization`: `best` 0/10,
  `rich` 10/10 (evals/results/2026-09-24-q19-best-arm.json). **Fixed 2026-09-24:** a fixed span
  (`REFERENCE_END_YEARS`, windows ending 2014–2023) for every query; measured values unchanged.
  Re-measured (Q19b, evals/results/2026-09-24-q19b-weather-fixes.json): `best` 8/10, `rich` 8/10;
  the 2 `best` misses asked for an address without calling.
- **Upstream cost (fixed).** The first version fetched one 10-year span per call (~260 Open-Meteo
  weighted calls). Under eval load it exhausted the hourly quota, and every weather call of the arm
  then returned 429. Now: window-sized fetches, sequential (10 concurrent requests return "Too many
  concurrent requests"), cached per location + window. Repro: `src/domain/reference-period.test.ts`.
- **Annualising.** With 4,675 m³ in hand for the quarter, 10 of 16 correct haiku answers went on to
  extrapolate to a full year (~10,600 m³, arithmetically the forbidden 4,200 × 2.53). The response
  says what the reference is for, but not what NOT to do with it. **Fixed 2026-09-24** with a
  "do not scale it to a full year" clause in the alert, the normalization line and the
  description. Q19b: 18/20 correct, annualising among correct answers 10/16 → 5/18. Reduced, not
  gone — several runs quote the caveat and annualise anyway.
- **Forecast window.** On a window ending in the future, haiku made no call at all in 8 of 10 runs
  and asked for the gas figure: the description's "never weather-correct against forecast days"
  was read, and the forecast tail was never shown. `best` 2/10, `rich` 4/10 (a gap under the
  noise bar).

## 10. Decisions confirmed

- 2026-09-23: `hdd` / `weightedHdd` names are NOT changed — Q11 measured no confusion
  (weightedHdd chosen 20/20). Only `gasNormalizationFactor` is renamed, to
  `fullYearGasNormalizationFactor`, because its validity is the trap.

## 11. Audits

### 2026-09-23 — `rich` → `best`, following `references/audit.md`

**Inventory.** Description 5,291 chars: INTERPRETATION at 3,172, the partial-period rule at
3,958, the `select` notes at 4,673, ALERTS at 5,100 — 61% past the cut. A full-year response
without projection is ~79k chars, over the host's ~25k-token replacement limit (Q9). The
`select` field list is in the input schema (delivered) — kept.

**Changes in `best`** (`src/tools/get-weather-context-best.ts`, rules in
`src/domain/best-weather-rules.ts`):

- Description 1,680 chars; the weather-correction rules (weighted HDD, full year vs shorter
  window, reference period, two-period ratio, no forecast days) all before char 1,000.
- `fullYearGasNormalizationFactor` is null unless the window is exactly 12 whole months with
  every day archived.
- Ships `referencePeriodWeightedHDD` for shorter windows: the same calendar window over the 10
  previous years, one archive call, windows crossing 31 December supported
  (`src/domain/reference-period.ts`). Degrades to null + reason on a fetch failure.
- `energyUse` → computed `summary.normalization`; `solarKwp` + `solarYieldKwh` → computed
  `summary.solarCheck`.
- Fighting-system days returned complete, in `summary.fightingSystemDays` and in the alert.
- Zero archive days → aggregates null, with a branch alert.
- Responses over 50,000 chars drop their records with an alert naming `select`.
- A `select` naming no valid field is reported as a naming error, with the valid names.

**Measure.** Registered as Q19 in `evals/open-questions.md`.
