/**
 * Shared value-shape detection + locale formatting helpers.
 *
 * Used across render_table / render_chart / render_map so that all three tools
 * auto-detect emails, URLs, and ISO dates the same way, apply the same
 * scheme-allowlist on hrefs, and produce identical nl-NL formatting for
 * numbers / currency / percentages / dates.
 *
 * Rationale for extracting these into a shared module:
 * - Consistency. A date rendered in a chart axis label should look identical
 *   to the same date in a table cell.
 * - Strictness in one place. The regex patterns are intentionally conservative
 *   (whole-string anchors, no greedy match on free text) — having a single
 *   source of truth prevents one tool from gradually relaxing them and
 *   introducing false positives.
 * - Security. `isSafeHref` / `isSafeImageUrl` are the only places deciding
 *   which URL schemes are allowed to render as clickable links or `<img>`
 *   sources; keeping them in one place makes the threat model obvious.
 */

// ── Regex patterns ──────────────────────────────────────────────────────────
//
// All patterns MUST anchor to the whole string (`^` … `$`). A mid-string match
// would make this module a false-positive machine on any free-text column
// containing a URL-like substring.

/** Matches a plain email address. RFC 5321 is more permissive; this is pragmatic. */
export const EMAIL_RE = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;

/** Matches a full `http://` or `https://` URL (any non-whitespace tail). */
export const URL_RE = /^https?:\/\/\S+$/i;

/** Matches ISO 8601 — either date-only (`YYYY-MM-DD`) or with a time component. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Date-only with capture groups. Used by `parseIsoDate` for local-midnight parsing. */
export const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// ── Locale formatters (nl-NL) ───────────────────────────────────────────────
//
// Exported as singletons — `Intl.NumberFormat` / `DateTimeFormat` constructors
// are expensive, these get reused across thousands of cells per render.

export const NL_NUMBER = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const NL_CURRENCY = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
export const NL_PERCENT = new Intl.NumberFormat('nl-NL', { style: 'percent', minimumFractionDigits: 1 });
export const NL_DATE = new Intl.DateTimeFormat('nl-NL', { year: 'numeric', month: '2-digit', day: '2-digit' });

/** Days in a given 1-based month, accounting for Gregorian leap years. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  // 30-day months: Apr, Jun, Sep, Nov. The rest have 31.
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Parse an ISO-like string to a Date.
 *
 * For date-only strings (`"YYYY-MM-DD"`) we construct a Date at LOCAL midnight
 * rather than using `new Date(raw)` which treats the value as UTC midnight.
 * Without this, `Intl.DateTimeFormat('nl-NL')` shifts the day back 1-2 hours
 * in Europe/Amsterdam (UTC+1/+2), rendering "2025-03-14" as "13-03-2025".
 *
 * Validates the calendar day against the month (accounting for leap years) so
 * inputs like "2025-02-31" return an invalid Date instead of silently
 * overflowing to March 3. Callers that use `isNaN(d.getTime())` to gate
 * formatting will render the raw string instead.
 */
export function parseIsoDate(raw: string): Date {
  const m = DATE_ONLY_RE.exec(raw);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) return new Date(NaN);
    if (day < 1 || day > daysInMonth(year, month)) return new Date(NaN);
    return new Date(year, month - 1, day);
  }
  return new Date(raw);
}

/** Format an ISO date string as `DD-MM-YYYY`. Returns the raw string if not parseable. */
export function formatIsoDateNL(raw: string): string {
  const d = parseIsoDate(raw);
  return isNaN(d.getTime()) ? raw : NL_DATE.format(d);
}

// ── Href normalization + safety ─────────────────────────────────────────────

/**
 * Turn a plain string into a safe href:
 * - bare email (`"foo@bar.tld"`)  → `"mailto:foo@bar.tld"`
 * - `"www.foo.com"`               → `"https://www.foo.com"`
 * - already-prefixed URLs / mailto → returned as-is for the safety check
 * - anything else                 → returned as-is (will be rejected by `isSafeHref`)
 */
export function normalizeToHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (EMAIL_RE.test(trimmed)) return `mailto:${trimmed}`;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Scheme allowlist for hrefs rendered as clickable `<a>` elements.
 * Only `http:`, `https:`, and `mailto:` pass. All other schemes —
 * `javascript:`, `data:`, `file:`, etc. — return false and the caller
 * should render the value as plain text.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:');
}

/**
 * Scheme allowlist for URLs used as `<img src>`. Accepts `http(s)://` and
 * inline `data:image/*` (for SVG placeholders, etc.).
 * Narrowing predicate — callers can use the return value to type-narrow.
 */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/');
}

// ── Link-column value shape helpers ─────────────────────────────────────────

/**
 * Extract a display label from either a plain string or a `{ label }` object.
 * Returns empty string when neither shape is present.
 */
export function extractLinkLabel(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'label' in raw) {
    const label = (raw as { label?: unknown }).label;
    return typeof label === 'string' ? label : '';
  }
  return '';
}

/**
 * Extract a safe href from a plain string (with `normalizeToHref` shorthand
 * expansion) or a `{ href }` object. Returns null for unsafe schemes so the
 * caller renders as plain text.
 */
export function extractLinkHref(raw: unknown): string | null {
  let href: string | null = null;
  if (typeof raw === 'string') {
    href = normalizeToHref(raw);
  } else if (raw && typeof raw === 'object' && 'href' in raw) {
    const h = (raw as { href?: unknown }).href;
    if (typeof h === 'string') href = h;
  }
  if (!href) return null;
  return isSafeHref(href) ? href : null;
}

// ── Auto-text-shape detection ───────────────────────────────────────────────

export type AutoTextShape = { kind: 'email' | 'url' | 'date'; label: string; href?: string };

/**
 * Auto-detect email / URL / ISO-date shapes in a plain string so callers can
 * render them as clickable links (email/URL) or localized dates without
 * requiring agents to wrap values in `{label, href}` or set explicit column
 * types.
 *
 * Returns null for values that should render as plain text — the caller's
 * default fallback path.
 *
 * Used by:
 * - render_table: text columns
 * - render_chart: axis/legend labels, tooltip text
 * - render_map:  marker popup text
 */
export function detectAutoTextShape(value: unknown): AutoTextShape | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (EMAIL_RE.test(trimmed)) return { kind: 'email', label: trimmed, href: `mailto:${trimmed}` };
  if (URL_RE.test(trimmed)) return { kind: 'url', label: trimmed, href: trimmed };
  if (ISO_DATE_RE.test(trimmed)) {
    const formatted = formatIsoDateNL(trimmed);
    if (formatted !== trimmed) return { kind: 'date', label: formatted };
  }
  return null;
}
