/**
 * Rule registry for the `best` arm — record-conditional interpretation, with provenance.
 *
 * Each rule is one line of guidance that the tool RESPONSE carries under
 * `interpretation`, emitted only when `applies(ctx)` is true for the returned record.
 *
 * Why this shape (see .claude/skills/rich-domain-mcp-server/references/evidence.md):
 * - In the response, not the description: only the first 2,048 description chars reach
 *   the model on Claude Code (Q7), and a delivered line is applied either way (Q15).
 * - Record-conditional: pruning irrelevant lines is free (Q2) — but notes about NULL
 *   decision fields are gated on the field BEING null, never pruned (absent-sizing:
 *   haiku 18/20 with the note vs 10/20 without).
 * - One line, fact + instruction: one line is enough (Q14); an instruction without its
 *   fact is inert (Q4: 10/30 vs 30/30).
 * - Form and volume do not matter at runtime (Q10, Q17), so the registry is optimised
 *   for correctness and maintenance, not size.
 * - `provenance` is for whoever improves the server — the one field that changed an
 *   improving agent's decisions (Q18: 16/16 vs 0/16). It stays in source and is never
 *   serialized: nothing shows it helps the answering model, and every response byte is
 *   paid for on every call (Q5).
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
  /** Response field names (post-rename) the rule reads or explains. Drives coverage tests. */
  relates_to_fields: string[];
  /** Pure gate on the finished record. */
  applies: (ctx: Ctx) => boolean;
  /** One line, no newline. May interpolate computed values. */
  render: (ctx: Ctx) => string;
  /** Date + the eval result, incident or observation behind the rule. Source only. */
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

/** The fixed response key every best-arm tool leads with (Q9: guidance under a named key). */
export interface Interpretation {
  alerts: string[];
  notes: string[];
  constants: Record<string, number | number[] | string>;
}
