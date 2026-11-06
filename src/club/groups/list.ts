import type { MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { GroupListPage, GroupListRow, SectionTab } from './api-types';
import { queryText } from './http';
import { listLine } from './program-text';
import { pickSeason, seasonChoices, seasonRef } from './season-pick';
import { byGroupOrder, orderedSections, sectionLabel } from './sections';
import { currentSeries, seriesText } from './series';
import { unassignedFor } from './unassigned';
import type { EventRecord, GroupRecord, GroupStore, NamedRow, SeasonRecord, SectionRecord } from './types';

export type ListQuery = { season: string | null; section: string | null };
export const readListQuery = (q: Record<string, unknown>): ListQuery => ({ season: queryText(q.season), section: queryText(q.section) });

export type ListFacts = { season: SeasonRecord | null; sections: SectionRecord[]; groups: GroupRecord[]; current: MembershipRow[]; events: EventRecord[]; team: NamedRow[]; today: string };

const tabsOf = (sections: SectionRecord[], groups: GroupRecord[]): SectionTab[] =>
  orderedSections(sections).map((s) => ({ documentId: s.id, slug: s.slug, label: sectionLabel(s, sections), count: groups.filter((g) => g.active && g.sectionId === s.id).length }));

export function groupListRow(g: GroupRecord, f: ListFacts): GroupListRow {
  const program = f.season ? currentSeries(f.events, g.id, f.season, f.today).map((s) => listLine(seriesText(s))) : [];
  const coaches = f.team.filter((t) => g.coachIds.includes(t.id)).map((t) => t.name);
  return { documentId: g.id, name: g.name, program, coaches, members: f.current.filter((m) => m.groupId === g.id).length };
}

function tabRows(f: ListFacts, sectionId: string | undefined): { rows: GroupListRow[]; athletes: number } {
  const groups = f.groups.filter((g) => g.active && g.sectionId === sectionId).sort(byGroupOrder);
  const ids = new Set(groups.map((g) => g.id));
  return { rows: groups.map((g) => groupListRow(g, f)), athletes: new Set(f.current.filter((m) => ids.has(m.groupId)).map((m) => m.athleteId)).size };
}

/** Grupe (5.2): tabs, the open tab's groups (inactive left out) and the distinct-athletes line, for one season. */
export async function readGroupList(store: GroupStore, q: ListQuery, today: string): Promise<GroupListPage> {
  const [seasons, sections, groups, events, team] = await Promise.all([store.seasons(), store.sections(), store.groups(), store.events(), store.teamMembers()]);
  const season = pickSeason(seasons, q.season);
  const current = season ? (await store.memberships({ seasonId: season.id })).filter(isCurrentMembership) : [];
  const tabs = tabsOf(sections, groups);
  const section = sections.find((s) => s.slug === q.section) ?? orderedSections(sections)[0];
  const { rows, athletes } = tabRows({ season, sections, groups, current, events, team, today }, section?.id);
  return {
    season: season ? seasonRef(season, seasons) : null, seasons: seasonChoices(seasons), tabs, section: section?.slug ?? null,
    athletes, groups: rows.length, rows, unassigned: season ? (await unassignedFor(store, season, seasons, today)).length : 0,
  };
}
