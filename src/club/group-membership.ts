export interface SeasonMembership {
  groupId: string;
  seasonId: string;
  isMain: boolean;
}

export function checkMainGroup(
  list: SeasonMembership[],
  seasonId: string,
): { ok: true } | { ok: false; reason: 'none' | 'many' } {
  const inSeason = list.filter((m) => m.seasonId === seasonId);
  if (inSeason.length === 0) return { ok: true };
  const mains = inSeason.filter((m) => m.isMain).length;
  if (mains === 1) return { ok: true };
  return { ok: false, reason: mains === 0 ? 'none' : 'many' };
}

export function setMainGroup(list: SeasonMembership[], seasonId: string, groupId: string): SeasonMembership[] {
  if (!list.some((m) => m.seasonId === seasonId && m.groupId === groupId)) {
    throw new Error(`Athlete is not on group ${groupId} in season ${seasonId}`);
  }
  return list.map((m) => (m.seasonId === seasonId ? { ...m, isMain: m.groupId === groupId } : m));
}

export function countDistinctAthletes(rows: { athleteId: string }[]): number {
  return new Set(rows.map((r) => r.athleteId)).size;
}
