import type { AthleteValues } from '../athlete-data';
import { isoDate, parseBirthDate } from '../birth-date';
import { sameNameExact } from '../matching';
import { collapseSpaces } from '../person-match';

/**
 * Deploy step 9 (spec 2.3, d17, Open #1): one athlete per child from the registrations of the seasons before the
 * current one, archived included, "Respins" skipped. Exact same name (Sigur rule, no typo) + same birth date across
 * seasons; a typo-only pair stays two athletes for step 11 to flag. An unreadable date forms its own athlete.
 * The registrations stay unlinked. `covered`: registrations already used.
 */
export type PastRegistration = {
  id: string; number: string | null; childName: string; childBirthDate: string; parentName: string; phone: string; email: string;
  status: string; seasonLabel: string | null; submittedAt: string | null;
};
export type PastAthlete = { values: AthleteValues; registrations: { documentId: string; season: string; number: string | null }[] };
type Skipped = { covered: number; respins: number; noSeason: number; currentOrLater: number };
export type PastPlan = { create: PastAthlete[]; skipped: Skipped };
type Eligible = PastRegistration & { season: string; birth: string | null };

function skipReason(r: PastRegistration, currentLabel: string, covered: ReadonlySet<string>): keyof Skipped | null {
  if (covered.has(r.id)) return 'covered';
  if (r.status === 'Respins') return 'respins';
  if (!r.seasonLabel) return 'noSeason';
  return r.seasonLabel >= currentLabel ? 'currentOrLater' : null;
}

function eligible(rows: PastRegistration[], currentLabel: string, covered: ReadonlySet<string>): { rows: Eligible[]; skipped: Skipped } {
  const skipped: Skipped = { covered: 0, respins: 0, noSeason: 0, currentOrLater: 0 };
  const out: Eligible[] = [];
  for (const r of rows) {
    const reason = skipReason(r, currentLabel, covered);
    const birth = parseBirthDate(r.childBirthDate);
    if (reason) skipped[reason] += 1;
    else out.push({ ...r, season: r.seasonLabel ?? '', birth: birth ? isoDate(birth) : null });
  }
  return { rows: out, skipped };
}

function groupChildren(rows: Eligible[]): Eligible[][] {
  const groups: Eligible[][] = [];
  for (const r of rows) {
    const home = r.birth ? groups.find((g) => g[0].birth === r.birth && g.some((m) => sameNameExact(m.childName, r.childName))) : undefined;
    if (home) home.push(r);
    else groups.push([r]);
  }
  return groups;
}

const newestFirst = (a: Eligible, b: Eligible) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '') || b.season.localeCompare(a.season);
const orNull = (v: string) => collapseSpaces(v) || null;

function toAthlete(group: Eligible[]): PastAthlete {
  const [newest] = [...group].sort(newestFirst);
  return {
    values: { name: orNull(newest.childName), birthDate: newest.birth, contactName: orNull(newest.parentName), phone: orNull(newest.phone), email: orNull(newest.email) },
    registrations: group.map((r) => ({ documentId: r.id, season: r.season, number: r.number })),
  };
}

export function planPastRegistrationAthletes(rows: PastRegistration[], currentLabel: string, covered: ReadonlySet<string>): PastPlan {
  const { rows: usable, skipped } = eligible(rows, currentLabel, covered);
  const create = groupChildren(usable).map(toAthlete).sort((a, b) => (a.values.name ?? '').localeCompare(b.values.name ?? '', 'ro') || (a.values.birthDate ?? '').localeCompare(b.values.birthDate ?? ''));
  return { create, skipped };
}
