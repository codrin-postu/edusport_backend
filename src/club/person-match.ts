/** Normalising for matching and search (spec 2.1): phone digits, e-mail, name words. Pure. */

export function collapseSpaces(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

/** Digits only; a leading +40 or 0040 becomes 0, including a redundant 0 right after it. */
export function normalizePhone(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const digits = text.replace(/\D/g, '');
  let national = digits;
  let hasCountryCode = false;
  if (text.startsWith('+40')) {
    national = digits.slice(2);
    hasCountryCode = true;
  } else if (digits.startsWith('0040')) {
    national = digits.slice(4);
    hasCountryCode = true;
  }
  if (!hasCountryCode) return national;
  national = national.replace(/^0/, '');
  return national ? `0${national}` : '';
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Lower case, no diacritics (cedilla forms too), split on spaces and hyphens. */
export function nameWords(raw: unknown): string[] {
  return collapseSpaces(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

/** Augmenting-path search (Kuhn's algorithm): can leftIndex be matched to an unvisited right word? */
function tryPair(leftIndex: number, left: string[], right: string[], matchedRight: number[], visited: boolean[]): boolean {
  for (let j = 0; j < right.length; j += 1) {
    if (visited[j] || !withinOneEdit(left[leftIndex], right[j])) continue;
    visited[j] = true;
    if (matchedRight[j] === -1 || tryPair(matchedRight[j], left, right, matchedRight, visited)) {
      matchedRight[j] = leftIndex;
      return true;
    }
  }
  return false;
}

/** Bipartite perfect matching in O(words^3): each left word paired to a distinct right word. */
function hasPerfectPairing(left: string[], right: string[]): boolean {
  const matchedRight = new Array<number>(right.length).fill(-1);
  for (let i = 0; i < left.length; i += 1) {
    const visited = new Array<boolean>(right.length).fill(false);
    if (!tryPair(i, left, right, matchedRight, visited)) return false;
  }
  return true;
}

/** Same name: same number of words, any order, one wrong letter per word. */
export function sameName(a: unknown, b: unknown): boolean {
  const left = nameWords(a);
  const right = nameWords(b);
  return left.length > 0 && left.length === right.length && hasPerfectPairing(left, right);
}

export function shareNameWord(a: unknown, b: unknown): boolean {
  const right = new Set(nameWords(b));
  return nameWords(a).some((word) => right.has(word));
}
