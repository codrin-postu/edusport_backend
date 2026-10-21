/** Trimmed text, or '' for anything that is not a string. */
export function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Non-empty trimmed strings from a json list; anything else is dropped. */
export function asTextList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => asText(x)).filter((x) => x !== '') : [];
}
