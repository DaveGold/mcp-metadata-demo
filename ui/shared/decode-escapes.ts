/**
 * Decode stray literal unicode escape sequences in user-facing text.
 *
 * Agents sometimes serialize a tool argument with a literal `²`
 * (six characters: backslash-u-0-0-b-2) instead of the real `²`
 * character. JSON.parse only decodes escapes that appear in the raw
 * JSON source — once such a value arrives as a plain string with the
 * backslash intact, it renders verbatim ("kWh/m²").
 *
 * This converts those leftover `\uXXXX` and `\u{XXXXXX}` sequences back
 * to their characters so titles and labels render cleanly. It only
 * touches well-formed escape sequences; any other backslash is left
 * untouched.
 */
export function decodeUnicodeEscapes(value: string): string {
  if (!value || value.indexOf('\\u') === -1) return value;
  return value
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_m, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => safeFromCodePoint(parseInt(hex, 16)));
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Decode escapes when the input is a string; pass through anything else. */
export function decodeMaybe<T>(value: T): T {
  return typeof value === 'string' ? (decodeUnicodeEscapes(value) as unknown as T) : value;
}
