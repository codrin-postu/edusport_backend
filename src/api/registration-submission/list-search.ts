/**
 * The Înscrieri quick search (`?q=` on GET /api/forms/inscrieri): child, parent, e-mail, phone and the
 * registration number. The number is what the Google Sheet's Document link searches for
 * (src/sheets/admin-link.ts).
 */
const QUICK_SEARCH_FIELDS = ['childName', 'parentName', 'email', 'phone', 'registrationNumber'] as const;

export type QuickSearchClause = { $or: Record<string, { $containsi: string }>[] };

export function quickSearchClause(q: string): QuickSearchClause | null {
  const term = q.trim();
  if (!term) return null;
  return { $or: QUICK_SEARCH_FIELDS.map((field) => ({ [field]: { $containsi: term } })) };
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "Vârstă" sorts on the parsed birth date (age ascending = birth date descending); unreadable dates have none. */
export function listSort(v: unknown): Record<string, 'asc' | 'desc'> {
  switch (text(v)) {
    case 'oldest':
      return { submittedAt: 'asc' };
    case 'name':
      return { childName: 'asc' };
    case 'age-asc':
      return { childBirthDateParsed: 'desc' };
    case 'age-desc':
      return { childBirthDateParsed: 'asc' };
    default:
      return { submittedAt: 'desc' };
  }
}

/** "Sportiv existent: Da / Nu" (spec 3.1): a saved match on a registration with no athlete linked. */
export function existingClause(v: unknown): Record<string, unknown> | null {
  if (text(v) === 'da') return { athlete: { id: { $null: true } }, matchLevel: { $notNull: true } };
  if (text(v) === 'nu') return { $or: [{ athlete: { id: { $notNull: true } } }, { matchLevel: { $null: true } }] };
  return null;
}

export function schoolClause(v: unknown): Record<string, unknown> | null {
  return text(v) ? { section: { documentId: text(v) } } : null;
}

/** `?open=<documentId>`: one registration, for the athlete record's "Înscrieri" links (plan 3-5). */
export function openClause(v: unknown): Record<string, unknown> | null {
  return text(v) ? { documentId: text(v) } : null;
}

/** The phase 3 filters: "Sportiv existent", the school tab and the opened registration. */
export function phase3Clauses(query: Record<string, unknown>): Record<string, unknown>[] {
  return [existingClause(query.existing), schoolClause(query.school), openClause(query.open)].filter((c): c is Record<string, unknown> => c !== null);
}

export const isAgeSort = (v: unknown): boolean => text(v) === 'age-asc' || text(v) === 'age-desc';

export type PageSlice = { start: number; limit: number };

/** Which part of the dated and of the undated rows one page holds, the undated after every dated row. */
export function agePageSlices(datedTotal: number, start: number, limit: number): { dated: PageSlice | null; undated: PageSlice | null } {
  const datedLimit = Math.max(0, Math.min(limit, datedTotal - start));
  const undatedLimit = limit - datedLimit;
  return {
    dated: datedLimit > 0 ? { start, limit: datedLimit } : null,
    undated: undatedLimit > 0 ? { start: Math.max(0, start - datedTotal), limit: undatedLimit } : null,
  };
}

type Filters = Record<string, unknown>;
export type PageQuery = { filters: Filters; sort: Record<string, 'asc' | 'desc'>; start: number; limit: number };
export type AgePageDeps<T> = { count: (filters: Filters) => Promise<number>; find: (q: PageQuery) => Promise<T[]> };

/** "Vârstă" in either direction: rows without a parsed birth date (no age) come last, newest first. */
export async function ageSortedPage<T>(deps: AgePageDeps<T>, q: PageQuery): Promise<T[]> {
  const dated = { $and: [q.filters, { childBirthDateParsed: { $notNull: true } }] };
  const undated = { $and: [q.filters, { childBirthDateParsed: { $null: true } }] };
  const slices = agePageSlices(await deps.count(dated), q.start, q.limit);
  const head = slices.dated ? await deps.find({ filters: dated, sort: q.sort, ...slices.dated }) : [];
  const tail = slices.undated ? await deps.find({ filters: undated, sort: { submittedAt: 'desc' }, ...slices.undated }) : [];
  return [...head, ...tail];
}
