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
