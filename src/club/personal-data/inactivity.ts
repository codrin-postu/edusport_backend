/**
 * "Inactivi de peste N ani" (spec 5): not anonymized, and the last active season at least N seasons before the current
 * one; the last active season is the latest of the group seasons and the linked registration seasons (phase 5 adds
 * attendance and payment seasons in `lastActiveYears`, the one place to extend). No activity at all: the record is at
 * least N years old. Pure.
 */
export type InactivityInput = {
  athletes: { id: string; status: string; createdAt: string }[];
  memberships: { athleteId: string; seasonId: string }[];
  registrations: { athleteId: string | null; seasonId: string | null; season: string | null }[];
  seasons: { id: string; label: string; isCurrent: boolean }[];
  retentionYears: number;
  now: Date;
};

/** "2026-2027" -> 2026; a label that does not start with a year is no season (decided while planning, item 7). */
export function seasonStartYear(label: string | null): number | null {
  const m = /^(\d{4})/.exec(label ?? '');
  return m ? Number(m[1]) : null;
}

export function lastActiveYears(input: Pick<InactivityInput, 'memberships' | 'registrations' | 'seasons'>): Map<string, number> {
  const labels = new Map(input.seasons.map((s) => [s.id, s.label]));
  const years = new Map<string, number>();
  const note = (athleteId: string | null, label: string | null | undefined) => {
    const year = seasonStartYear(label ?? null);
    if (athleteId && year !== null) years.set(athleteId, Math.max(years.get(athleteId) ?? year, year));
  };
  for (const m of input.memberships) note(m.athleteId, labels.get(m.seasonId));
  for (const r of input.registrations) note(r.athleteId, (r.seasonId && labels.get(r.seasonId)) || r.season);
  return years;
}

/** Today minus N years, as a time stamp (UTC calendar date). */
const yearsBefore = (now: Date, n: number): number => Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59);

function qualifies(createdAt: string, lastYear: number | undefined, current: number, input: InactivityInput): boolean {
  if (lastYear !== undefined) return current - lastYear >= input.retentionYears;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= yearsBefore(input.now, input.retentionYears);
}

export function inactiveAthleteIds(input: InactivityInput): Set<string> {
  const current = seasonStartYear(input.seasons.find((s) => s.isCurrent)?.label ?? null);
  if (current === null) return new Set();
  const last = lastActiveYears(input);
  const listed = input.athletes.filter((a) => a.status !== 'anonimizat' && qualifies(a.createdAt, last.get(a.id), current, input));
  return new Set(listed.map((a) => a.id));
}
