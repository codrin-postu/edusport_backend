import type { MembershipRow } from '../../athletes/store';

/** Membership on a date: started on or before it (or no start) and not ended before it (or no end). Spec 3.9. */
export const onDate = (m: MembershipRow, date: string): boolean => (m.from === null || m.from <= date) && (!m.to || m.to >= date);

/** Athletes of a group in a season on a date, each once, in membership order. */
export function rosterOn(ms: MembershipRow[], groupId: string, seasonId: string, date: string): string[] {
  const ids = ms.filter((m) => m.groupId === groupId && m.seasonId === seasonId && onDate(m, date)).map((m) => m.athleteId);
  return [...new Set(ids)];
}

/** The group of the athlete's main membership in a season on a date, or null. */
export function mainGroupOn(ms: MembershipRow[], athleteId: string, seasonId: string, date: string): string | null {
  const main = ms.find((m) => m.athleteId === athleteId && m.seasonId === seasonId && m.isMain && onDate(m, date));
  return main?.groupId ?? null;
}
