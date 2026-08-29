/**
 * The "Select" mechanism: opt-in field projection for record-heavy tool output.
 *
 * A long date range (or any large result set) can carry more fields per record than a
 * given question needs. `summaryOnly` drops all records; `select` keeps the records but
 * projects each one down to only the requested fields — a token saver for "give me the
 * full daily detail, but only these columns" queries.
 *
 * Safety rails (do not weaken these — they are the point of the mechanism, not incidental):
 * - Never silently fall back to full records. If none of the requested fields are valid,
 *   return zero records plus an alert — a silent fallback would defeat the reason `select`
 *   was used in the first place (token budget).
 * - Unknown field names are ignored with an alert naming them, never a hard error — an
 *   agent guessing a plausible-but-wrong field name should not lose the whole call.
 *   Also list the discovered set of valid fields, so it can recover on its next call.
 * - Always tell the agent which fields were excluded and that they are NOT null, just
 *   omitted — otherwise a projected record silently looks like a record with lots of
 *   nulls, which is a different (and wrong) conclusion.
 */

export interface SelectResult<T extends object> {
  records: Array<Partial<T>>;
  alerts: string[];
}

export function applySelect<T extends object>(records: T[], requested: string[] | undefined): SelectResult<T> {
  if (!requested || requested.length === 0) {
    return { records, alerts: [] };
  }

  // Allowed names = keys actually present on the returned rows, not a separate metadata
  // list — this stays correct even if the row shape changes without this function changing.
  const allowed = new Set<string>();
  for (const row of records) {
    for (const key of Object.keys(row)) allowed.add(key);
  }

  const validList = [...new Set(requested.filter((name) => allowed.has(name)))];
  const unknown = requested.filter((name) => !allowed.has(name));
  const alerts: string[] = [];

  if (validList.length === 0) {
    alerts.push(
      `select: none of the requested field(s) [${requested.join(', ')}] exist on this tool — no records returned. Valid fields: ${[...allowed].join(', ')}.`
    );
    return { records: [], alerts };
  }

  const projected = records.map((row) => {
    const source = row as Record<string, unknown>;
    const picked: Partial<T> = {};
    for (const name of validList) (picked as Record<string, unknown>)[name] = source[name];
    return picked;
  });

  if (unknown.length > 0) {
    alerts.push(`select: ignored unknown field(s) [${unknown.join(', ')}]. Returned only: ${validList.join(', ')}.`);
  }
  alerts.push(
    `Records projected to ${validList.length} field(s) via select — omitted fields are NOT null, just excluded. Re-query without select to see them.`
  );

  return { records: projected, alerts };
}
