/** Normalising for matching and search (spec 2.1): phone digits, e-mail, name words. Pure. */

export function collapseSpaces(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

/** Digits only; a leading +40 or 0040 becomes 0. */
export function normalizePhone(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const digits = text.replace(/\D/g, '');
  if (text.startsWith('+40')) return `0${digits.slice(2)}`;
  return digits.startsWith('0040') ? `0${digits.slice(4)}` : digits;
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Lower case, no diacritics (cedilla forms too), split on spaces and hyphens. */
export function nameWords(raw: unknown): string[] {
  return collapseSpaces(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** At most one letter added, removed or replaced. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i += 1;
  const rest = short.length === long.length ? short.slice(i + 1) : short.slice(i);
  return rest === long.slice(i + 1);
}

function pairAll(left: string[], right: string[]): boolean {
  if (left.length === 0) return true;
  const [first, ...others] = left;
  return right.some((word, i) => withinOneEdit(first, word) && pairAll(others, [...right.slice(0, i), ...right.slice(i + 1)]));
}

/** Same name: same number of words, any order, one wrong letter per word. */
export function sameName(a: unknown, b: unknown): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  return left.length > 0 && left.length === right.length && pairAll(left, right);
}

export function shareNameWord(a: unknown, b: unknown): boolean {
  const right = new Set(nameWords(b));
  return nameWords(a).some((word) => right.has(word));
}
