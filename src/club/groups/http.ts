/** A query value as trimmed text; null when it is missing, not a string or blank (differs from the P3 `queryText` in athletes/http.ts, which gives ''). */
export const queryText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
