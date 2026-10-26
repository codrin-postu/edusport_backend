/** Web address of a public profile (spec 1.2): made once from the name, never changed afterwards. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'sportiv';
}

/** `base`, else `base-2`, `base-3` ... skipping every address in use (current and merged-away ones). */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The website's lookup of a merged-away address: `filters[previousSlugs][$contains]=<slug>` (plan 3-3 Task 6). */
export function previousSlugQuery(query: Record<string, unknown>): { slug: string; rest: Record<string, unknown> } | null {
  const filters = isRecord(query.filters) ? query.filters : null;
  const condition = filters && isRecord(filters.previousSlugs) ? filters.previousSlugs : null;
  const slug = condition && typeof condition.$contains === 'string' ? condition.$contains.trim() : '';
  if (!slug) return null;
  const rest = { ...query };
  delete rest.filters;
  return { slug, rest };
}

/** Exact match on one remembered address (never a substring of another). */
export function previousSlugOwner(rows: { documentId?: unknown; previousSlugs?: unknown }[], slug: string): string | null {
  const hit = rows.find((r) => Array.isArray(r.previousSlugs) && r.previousSlugs.includes(slug));
  return hit && typeof hit.documentId === 'string' ? hit.documentId : null;
}
