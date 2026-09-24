/**
 * Rule registry — record-conditional interpretation, with provenance (reference implementation).
 *
 * Each rule is one line of guidance that the tool RESPONSE carries under `interpretation`,
 * emitted only when `applies(ctx)` is true for the returned record.
 *
 * Why this shape (the evidence behind each point: .claude/skills/rich-domain-mcp-server/references/evidence.md):
 * - In the response, not the description: a host may deliver only the first 2,048 description
 *   characters, and a response line arrives whole.
 * - Record-conditional: a line about a field this record does not have is noise. But a note about
 *   a NULL decision field is gated on the field BEING null, never pruned: without it the model
 *   fills the gap with an invented figure.
 * - One line, fact + instruction: an instruction without the fact that says when it applies is
 *   ignored.
 * - `provenance` is for whoever improves the server: date · reason · source. It stays in source
 *   and is never serialized; every response byte is paid for on every call.
 */

export type RuleKind =
  /** A computed verdict about this record (a threshold crossed, a band, a total). */
  | 'verdict'
  /** Which branch the response is in (not found, no label, one unit of many). */
  | 'branch'
  /** A reading rule that applies because a field is populated. */
  | 'fact'
  /** A reading rule that applies because a DECISION field is null. Never pruned. */
  | 'null-note';

export interface Rule<Ctx> {
  /** Stable id, `<tool prefix>.<topic>`, e.g. 'bp.calc_vs_measured'. */
  id: string;
  kind: RuleKind;
  /** Response field names (post-rename) the rule reads or explains. Source only — never serialized;
   *  it drives the coverage and orphan tests, not selection (that is `applies`). */
  relates_to_fields: string[];
  /** Pure gate on the finished record. Source only. */
  applies: (ctx: Ctx) => boolean;
  /** One line, no newline. May interpolate computed values. The ONLY part of a rule the model sees. */
  render: (ctx: Ctx) => string;
  /** `YYYY-MM-DD · why the rule exists · source` (an eval result, incident, doc or expert). Source only. */
  provenance: string;
}

/** Verdicts and branches go to `alerts` (decision-relevant first); facts and null-notes to `notes`. */
const ORDER: RuleKind[] = ['branch', 'verdict', 'null-note', 'fact'];

export function selectRules<Ctx>(rules: readonly Rule<Ctx>[], ctx: Ctx): { alerts: string[]; notes: string[] } {
  const fired = rules
    .filter((rule) => rule.applies(ctx))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const alerts: string[] = [];
  const notes: string[] = [];
  for (const rule of fired) {
    const line = rule.render(ctx);
    if (rule.kind === 'branch' || rule.kind === 'verdict') alerts.push(line);
    else notes.push(line);
  }
  return { alerts, notes };
}

/** A computed value that explains itself, or says why it could not be computed. */
export type Derived<T = number> =
  | { value: T; unit: string; basis: string; provenance: 'calculated' | 'register' }
  | { value: null; reason: string };

/** The fixed response key every tool leads with, so the model always knows where the guidance is. */
export interface Interpretation {
  alerts: string[];
  notes: string[];
  constants: Record<string, number | number[] | string>;
}
