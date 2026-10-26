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
