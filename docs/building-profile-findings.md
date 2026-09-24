# get_building_profile — findings

BAG (PDOK Locatieserver + BAG OGC v2) and EP-Online V5, via `src/clients/`. Frozen reference
records: `evals/addresses.json` (captured 2026-09-20 from the live `rich` server; values drift,
re-capture with `npx tsx scripts/smoke.ts <postcode> <huisnummer>`).

This file follows the skill's findings-doc structure
(`.claude/skills/rich-domain-mcp-server/references/recording.md`). Sections without new
findings are omitted.

## 5. Row shape

Populated vs null depends on the label's `berekeningstype`, not on the building (2026-04-13,
confirmed on the frozen records):

| method | populated | null |
|---|---|---|
| NTA 8800 (after Dec 2021) | ep1, ep2, aandeel_hernieuwbaar, warmtebehoefte, temperatuuroverschrijding, gebruiksoppervlakte_thermische_zone | energie_index, sbi_code; compactheid on some records |
| NEN 7120 / ISSO 75.3 | energie_index, berekend_energieverbruik (inflated 200–1200+), co2, sbi_code (text) | ep1, ep2, warmtebehoefte, temperatuuroverschrijding, compactheid, thermal zone |
| Nader Voorschrift | energie_index; co2 and berekend_energieverbruik as WHOLE-BUILDING TOTALS (kg/yr, MJ) | per-m² NTA fields |

Repro: `npx tsx scripts/smoke.ts 3543AR 1` (NEN 7120), `1082PP 10` (NTA 8800 office),
`3039WB 1` (NTA 8800 residential).

- `oppervlakte_m2` is the BAG area of ONE verblijfsobject. For a unit of a large pand the
  thermal-zone area can be far higher (Gustav Mahlerlaan 10: 118,174 vs 66,581 m², 1.77×) or
  lower (Rijnlaan 28: 64.04 vs 105). Never a fixed ratio. `[CONFIDENCE: HIGH — 10 frozen
  records.]`
- `co2_emissie_kg_m2` under NEN 7120 is assumed per m² like NTA 8800 (Middenwetering 1: 28.12
  on 6,356 m²). `[CONFIDENCE: LOW — one record, no thermal zone to cross-check. TODO: DOMAIN
  EXPERT — is the NEN 7120 CO₂ figure kg/m²/year or a total?]`
- `sbi_code` is a full-text sector description, never a numeric SBI code.

## 7. Known defects (in this repo's own `rich` arm)

- **EP-1 vs Paris Proof alert** — `src/domain/generate-alerts.ts:102-115` compares
  `ep1_energiebehoefte_kwh_m2` (NTA 8800, calculated net demand) with "Paris Proof 2040 target
  70 kWh/m² offices / 100 residential", a target defined on MEASURED final energy. It fires on
  the `benchmark-trap` record itself (Mahlerlaan, 81.68 > 70), and on Troelstralaan (132.74) and
  Van Beuningenstraat (110.74). The `> 150 … well above benchmark` branch compares with an
  unsourced value (fires on Rijnlaan 28 / 28A). The same claim appears in `interpretationBlock`,
  the ep1 output-schema describe, `alertsParagraph`, and the `rich` instructions' alerts bullet.
  This is the defect class that produced 0/60 on `benchmark-trap` (skill evidence [BT]), made
  worse by being a computed verdict. **Fixed in `rich` on 2026-09-24, after Q19** (commit after
  `33d24fc`). Removed: the alert, the Paris Proof promise in `alertsParagraph` and in the
  instructions' alerts bullet; the rich-only output-schema describe for ep1 now says CALCULATED.
  **Kept, deliberately:** the `ep1 … Paris Proof 2040 targets` line in the shared
  `interpretationBlock`. Six eval arms carry that block, and that line is what benchmark-trap
  measured (0/60 → 59/60). In `rich` it sits past char 2,048, so it is not delivered.
  Measured as Q20: the removal did NOT fix `rich` on benchmark-trap (haiku 0/10, sonnet 1/10),
  because the correcting CALCULATED vs MEASURED line is past its cut; it did end the "Paris
  Proof target" misnaming on heat-pump-triage (0/10, was 8/20). The production Duurzaam server
  has the same defect (MCPSER-81) — fix there needs both halves: remove the alert AND deliver the
  fact.
- **BAG-area fallback for totals** — `benchmarkArea()` falls back to the BAG area when there is
  no thermal zone, mixing scopes by up to 1.8×.
- **Large-pand alert threshold** — fires only above 10 verblijfsobjecten; the scope problem
  exists from 2.

## 8. Re-check when the registers change

- Re-capture `evals/addresses.json` before every scoring run.
- Bouwjaar-era alerts (`< 1992`, `< 2003`, `< 2015`) are dropped in `best`: they are judgment,
  not a determinate computation. `[CONFIDENCE: LOW — the cut-off years look off (EPC dates
  from 1995, BENG from 2021). TODO: DOMAIN EXPERT — which construction-era boundaries are
  meaningful for insulation, and should the tool say anything at all?]`

## 10. Decisions confirmed

- 2026-09-23 (user): field renames are TARGETED and stay Dutch. Register terms are kept; only
  misleading, unit-less or scope-less names change. Mapping with reasons:
  `src/domain/best-field-names.ts`.

## 11. Audits

### 2026-09-23 — `rich` → `best`, following `references/audit.md`

**Step 1 — inventory** (repro: connect `createServer({ variant: 'rich' })` over
`InMemoryTransport`, measure `listTools()` descriptions and `getInstructions()`):

| surface | length | past the 2,048 cut |
|---|---|---|
| `get_building_profile` description | 7,360 | everything from INTERPRETATION (char 1,759): Paris Proof line (3,240), CALCULATED vs MEASURED (3,379), overheating threshold (6,183), ALERTS paragraph (6,781) — 72% |
| server instructions | 2,861 | the tail, including part of the weather section |
| output schema | 7,375 chars | all of it is undelivered (Q11); the ep1 describe repeats the Paris Proof target |
| largest response | ~5k chars | — |

**Step 2 — name audit.** Renamed (reason + provenance per row in `best-field-names.ts`):
`oppervlakte_m2` (scope), `aantal_verblijfsobjecten` (scope), ep1/ep2/warmtebehoefte/co2/
energie_index/aandeel_hernieuwbaar/EMG variants (calculated), `berekend_energieverbruik_kwh_m2`
(reads as metered), `temperatuuroverschrijding` and `compactheid` (unitless), `sbi_code`
(not a code). Under Nader Voorschrift, co2 and berekend_energieverbruik get `_totaal_` names,
because the upstream name states the wrong unit for that method. Kept: bouwjaar, gebruiksdoel,
energielabel, berekeningstype, eis_* (legal limits, already unit-bearing), matchStatus.

**Step 3 — delivery.** New description 1,719 chars: what it is and is NOT (no metered data),
"read `interpretation` first", four record-independent rules as fact + instruction, input
conventions. Everything record-specific moved to the response rule registry
(`src/domain/best-building-rules.ts`). Instructions 744 chars.

**Step 4 — wrongness.** Paris Proof comparison removed everywhere (see §7); BAG-area fallback
replaced by `null` + reason; one-unit-of-many fires from 2 units; BENG stays because both sides
are calculated (stated in the alert). New computed values: space-heating gas, total CO₂,
heat-pump band with the margin to the nearest boundary, overheating verdict, area ratio —
each with unit, basis and provenance, pinned to the eval ground truth in
`src/tools/best-arm.test.ts`.

**Step 5 — provenance.** Every rule and rename carries a dated provenance line; where the
original reason was never recorded, the line says so ("reason not recorded").

**Step 6 — measure.** Registered as Q19 in `evals/open-questions.md`.
