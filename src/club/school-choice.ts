export type SchoolRow = { documentId?: unknown; slug?: unknown; kind?: unknown; publicPage?: unknown };
export type SchoolChoiceCode = 'closed' | 'unknown-school' | 'choose-school';
export type SchoolChoice = { ok: true; documentId: string; slug: string } | { ok: false; code: SchoolChoiceCode };

type School = { documentId: string; slug: string };

/** Registration targets: school sections with a public page. Club never; `registrationsOpen` is not used yet. */
function targetSchools(rows: SchoolRow[]): School[] {
  const schools: School[] = [];
  for (const r of rows) {
    if (r.kind !== 'school' || r.publicPage !== true) continue;
    if (typeof r.documentId !== 'string' || typeof r.slug !== 'string') continue;
    schools.push({ documentId: r.documentId, slug: r.slug });
  }
  return schools;
}

/** The school for a registration: the one named by `?scoala=<slug>`, or the only target school. */
export function pickSchool(rows: SchoolRow[], slug: string | null): SchoolChoice {
  const schools = targetSchools(rows);
  const wanted = (slug ?? '').trim().toLowerCase();
  if (wanted) {
    const hit = schools.find((s) => s.slug === wanted);
    return hit ? { ok: true, ...hit } : { ok: false, code: 'unknown-school' };
  }
  if (schools.length === 1) return { ok: true, ...schools[0] };
  return { ok: false, code: schools.length === 0 ? 'closed' : 'choose-school' };
}
