/** "Școala de Patinaj - AFI" shown as "AFI" in the Înscrieri school tabs and school column. */
const SCHOOL_PREFIX = /^[ȘŞS]coala de Patinaj\s*[-‐-―]\s*/;

export function shortSchoolName(name: unknown): string {
  const full = typeof name === 'string' ? name.trim() : '';
  return full.replace(SCHOOL_PREFIX, '').trim() || full;
}
