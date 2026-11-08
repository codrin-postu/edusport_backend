import { isCurrentMembership } from '../group-membership';
import type { GroupRecord, SectionRecord } from '../groups/types';
import type { TableRow } from './types';
import type { TableSources } from './sources';

export type GroupInfo = {
  /** Current groups of the season, the main one first. */
  groups: GroupRecord[];
  main: GroupRecord | null;
  section: SectionRecord | null;
  coaches: { id: string; name: string }[];
};

const none: GroupInfo = { groups: [], main: null, section: null, coaches: [] };

/** Per athlete: the groups of the scope season, the main group's section and coaches. */
export function groupInfoMap(src: TableSources): Map<string, GroupInfo> {
  const groups = new Map(src.groups.map((g) => [g.id, g] as const));
  const sections = new Map(src.sections.map((s) => [s.id, s] as const));
  const byAthlete = new Map<string, { group: GroupRecord; isMain: boolean }[]>();
  for (const m of src.memberships) {
    const group = groups.get(m.groupId);
    if (!group || !isCurrentMembership(m)) continue;
    byAthlete.set(m.athleteId, [...(byAthlete.get(m.athleteId) ?? []), { group, isMain: m.isMain }]);
  }
  const info = new Map<string, GroupInfo>();
  for (const [athleteId, list] of byAthlete) {
    list.sort((a, b) => Number(b.isMain) - Number(a.isMain) || (a.group.order ?? 0) - (b.group.order ?? 0) || a.group.name.localeCompare(b.group.name));
    const main = list.find((x) => x.isMain)?.group ?? null;
    const coaches = (main?.coachIds ?? []).flatMap((id) => (src.teamNames.has(id) ? [{ id, name: src.teamNames.get(id) as string }] : []));
    info.set(athleteId, { groups: list.map((x) => x.group), main, section: main?.sectionId ? sections.get(main.sectionId) ?? null : null, coaches });
  }
  return info;
}

export const infoOf = (info: Map<string, GroupInfo>, athleteId: string | null): GroupInfo => (athleteId === null ? none : info.get(athleteId) ?? none);

/** Group-by keys of an athlete's main group: group, section and the main group's first coach. */
export function mainKeys(i: GroupInfo): TableRow['groupKeys'] {
  const keys: TableRow['groupKeys'] = {};
  if (i.main) keys.grupa = [{ key: i.main.id, label: i.main.name }];
  if (i.section) keys.sectiune = [{ key: i.section.id, label: i.section.name }];
  if (i.coaches[0]) keys.antrenor = [{ key: i.coaches[0].id, label: i.coaches[0].name }];
  return keys;
}

export const coachText = (i: GroupInfo): string => i.coaches.map((c) => c.name).join(', ');

export function groupBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

export const nameOf = (src: TableSources): Map<string, string> => new Map(src.athletes.map((a) => [a.id, a.name ?? ''] as const));

export const byName = (a: TableRow, b: TableRow): number => String(a.cells.sportiv ?? '').localeCompare(String(b.cells.sportiv ?? ''), 'ro');
