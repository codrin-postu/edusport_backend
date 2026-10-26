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

/** The phase 3 filters: "Sportiv existent" and the school tab. */
export function phase3Clauses(query: Record<string, unknown>): Record<string, unknown>[] {
  return [existingClause(query.existing), schoolClause(query.school)].filter((c): c is Record<string, unknown> => c !== null);
}
