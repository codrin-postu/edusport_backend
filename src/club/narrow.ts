/** A plain object (not null, not an array), its keys readable. */
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Trimmed text, or '' for anything that is not a string. */
export function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Non-empty trimmed strings from a json list; anything else is dropped. */
export function asTextList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => asText(x)).filter((x) => x !== '') : [];
}
