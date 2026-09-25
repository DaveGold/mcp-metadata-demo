# Reference implementation: `best`, read in the source

The metadata layer is just code. This page walks through it by the moment the model needs it:
**WHY / WHY NOT** before the call, **HOW** when calling it, **WHAT** after the answer (the
three groups from the talk). Links go to the reference implementation, `best`
([`get-building-profile-best.ts`](../src/tools/get-building-profile-best.ts),
[`get-weather-context-best.ts`](../src/tools/get-weather-context-best.ts)), which is what the
[`rich-domain-mcp-server`](../.claude/skills/rich-domain-mcp-server/SKILL.md) skill produced when
its audit was run on this repo's own tools. Why it is built this way: [`design.md`](design.md).

To see what a tier actually sends, with the 2,048-character cut marked, read its wire view:
[`best`](wire/best.md) · [`rich`](wire/rich.md) · [`thin`](wire/minimal.md).

## 1 · WHEN — before the call

Does this tool fit the question, what is it not for, what does it join with? These must be in the
first 2,048 characters of the description, because the model decides before it has any response:

- building: [`WHEN TO USE` · `WHEN NOT TO USE` · `RELATED TOOLS`](../src/tools/get-building-profile-best.ts#L33-L37),
  including the refusal that must be possible without a call ("this server has NO metered energy
  consumption")
- weather: [the same three blocks](../src/tools/get-weather-context-best.ts#L58-L62)

## 2 · HOW — calling it

How to form the arguments, and what comes back:

- building: [`QUERY STRATEGY` · `RETURNS`](../src/tools/get-building-profile-best.ts#L39-L41) and
  [the input schema](../src/tools/get-building-profile-best.ts#L53-L66), a `.describe` on every
  parameter (the input schema is delivered)
- weather: [`QUERY STRATEGY` · `RETURNS`](../src/tools/get-weather-context-best.ts#L64-L66) and
  [the input schema](../src/tools/get-weather-context-best.ts#L77-L129), including `select` with its
  exact field names, and `energyUse` / `solarKwp` so the server computes the verdict

## 3 · WHAT — meaning and interpretation, after the answer

What a value is, and how to read it for this record. Most of it travels in the response, where
there is no 2,048 cut:

- **names first**, in [the rename table](../src/domain/best-field-names.ts#L31-L147): upstream name →
  name that says quantity, scope, provenance and unit, with a reason and provenance per row
  ([weather](../src/domain/best-field-names.ts#L179-L188)); the
  [output schema](../src/tools/get-building-profile-best.ts#L75-L138) lists the resulting names
  (shape only: the model never receives it)
- **rules that hold for every record**:
  [`INTERPRETATION` in the description head](../src/tools/get-building-profile-best.ts#L43-L49), each
  a fact plus an instruction (CALCULATED vs MEASURED, which area totals use, what null means)
- **rules for this record**: [the rule shape](../src/domain/best-rules.ts#L29-L42) (`applies`,
  `render`, `relates_to_fields`, `provenance`; only `render()` reaches the model) and the
  registries: [building](../src/domain/best-building-rules.ts#L235-L526),
  [weather](../src/domain/best-weather-rules.ts#L109-L244)
- **computed values**: [`computeBuildingDerived`](../src/domain/best-building-rules.ts#L104-L210):
  each with unit, basis and provenance, or `null` plus the reason; the server-computed
  [reference period](../src/domain/reference-period.ts) for a partial year
- **the response, `interpretation` first**:
  [building](../src/tools/get-building-profile-best.ts#L181-L195),
  [weather](../src/tools/get-weather-context-best.ts#L223-L373) (including the size guard that drops
  records rather than lose the interpretation to a file notice)
- **proof it holds**: [`best-arm.test.ts`](../src/tools/best-arm.test.ts) pins every computed value
  to the ground truth, and checks the description budget and rule coverage

The rule registry ([`best-rules.ts`](../src/domain/best-rules.ts)) is the part most worth copying:
each rule has a gate (`applies`), a rendered line, a `relates_to_fields` list and a `provenance`
line, and **only the rendered line is sent to the model**. The rest is for tests and for whoever
maintains the server: the one audience for which provenance measurably changed the outcome
([Q18](../.claude/skills/rich-domain-mcp-server/references/evidence.md#volume-form-and-cost)).

The app tools (`render_chart`, `render_table`, `render_map`) got the same audit in Q22; see
[`mcp-apps.md`](mcp-apps.md) and [`app-tools-findings.md`](app-tools-findings.md). The audit of the
data tools is written up in [`building-profile-findings.md`](building-profile-findings.md) and
[`weather-findings.md`](weather-findings.md).

## For contrast — the older tiers

- **`rich`** puts all three moments in one description of ~8,000 characters. Its
  [wire view](wire/rich.md) shows the cut: 74% of that description never reaches the model on
  Claude Code. It is the tier from the talk, with two fixes from the evals: the computed alert that
  ranked a calculated figure against a measured target is gone (Q20), and its CALCULATED vs
  MEASURED sentence now sits inside the cut (Q21). Its source,
  [`get-building-profile.ts`](../src/tools/get-building-profile.ts), is also the shared source of
  the eval arms, so it is built from named fragments. Its
  [`alerts[]`](../src/domain/generate-alerts.ts) are the first version of the response-side rules.
- **thin**: the whole ablated tool, ~60 lines, none of the above:
  [`get-building-profile-minimal.ts`](../src/tools/get-building-profile-minimal.ts) (variant
  `minimal`, endpoint `/mcpThin`, also `/mcpMinimal`), and its [wire view](wire/minimal.md)
- **Select**: field projection with its safety rails (never fall back silently to full records,
  alert on unknown fields): [`project-fields.ts`](../src/domain/project-fields.ts)
- **queryIntent + Iterate**: the persisted call log and the tool that reads it back:
  [`log-store.ts`](../src/shared/log-store.ts), [`get-tool-call-log.ts`](../src/tools/get-tool-call-log.ts)
