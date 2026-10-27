import type { AthleteRow, MembershipRow } from '../athletes/store';
import { isCurrentMembership } from '../group-membership';
import type { GroupOptions, GroupPage, MemberRow } from './api-types';
import { neverUsed, readGroupHistory } from './group-history';
import { GROUP_SUBJECT } from './history-lines';
import { copyFromFor } from './new-season/copy-group';
import { ageOnIso, pickSeason, seasonRef } from './season-pick';
import { groupChoices, sectionLabel } from './sections';
import type { GroupRecord, GroupStore } from './types';

type Roster = { group: GroupRecord; current: MembershipRow[]; athletes: AthleteRow[]; groups: GroupRecord[]; today: string };

function memberRow(m: MembershipRow, r: Roster, people: Map<string, AthleteRow>, groupName: Map<string, string>): MemberRow {
  const a = people.get(m.athleteId);
  const others = r.current.filter((o) => o.athleteId === m.athleteId && o.groupId !== r.group.id).map((o) => ({ name: groupName.get(o.groupId) ?? '', isMain: o.isMain }));
  return { membershipId: m.id, athleteId: m.athleteId, name: a?.name ?? '', age: ageOnIso(a?.birthDate ?? null, r.today), isMain: m.isMain, others };
}

/** Sportivi tab (6.2): the group's current members of the season, by name, with their other current groups. */
function memberRows(r: Roster): MemberRow[] {
  const people = new Map(r.athletes.map((a) => [a.id, a]));
  const groupName = new Map(r.groups.map((g) => [g.id, g.name]));
  return r.current.filter((m) => m.groupId === r.group.id).map((m) => memberRow(m, r, people, groupName)).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

const pageReads = (store: GroupStore, id: string) => Promise.all([store.memberships({ groupId: id }), store.events({ groupId: id })]);

/** The group page header and roster (6.1, 6.2) for the season in the URL, else the current one; null for an unknown group. */
export async function readGroupPage(store: GroupStore, id: string, label: string | null, today: string): Promise<GroupPage | null> {
  const group = await store.group(id);
  if (!group) return null;
  const [seasons, sections, team, priceLists, athletes, groups, history, [allRows, groupEvents], rawHistory] = await Promise.all([
    store.seasons(), store.sections(), store.teamMembers(), store.priceLists(), store.athletes(), store.groups(), readGroupHistory(store, id), pageReads(store, id), store.history(GROUP_SUBJECT, id),
  ]);
  const season = pickSeason(seasons, label);
  const current = season ? (await store.memberships({ seasonId: season.id })).filter(isCurrentMembership) : [];
  const deletable = neverUsed(allRows, groupEvents, rawHistory);
  const copyFrom = season ? copyFromFor({ group, season, seasons, memberships: allRows, athletes, events: groupEvents, today }) : null;
  const section = sections.find((s) => s.id === group.sectionId);
  const priceList = priceLists.find((p) => p.id === group.priceListId);
  return {
    documentId: group.id, name: group.name, section: section ? { documentId: section.id, name: sectionLabel(section, sections), kind: section.kind } : null,
    priceList: priceList ? { documentId: priceList.id, name: priceList.name } : null,
    coaches: team.filter((t) => group.coachIds.includes(t.id)).map((t) => ({ documentId: t.id, name: t.name })),
    programPublic: group.programPublic, season: season ? seasonRef(season, seasons) : null,
    members: memberRows({ group, current, athletes, groups, today }), historyCount: history.length, deletable, copyFrom,
  };
}

export async function readGroupOptions(store: GroupStore): Promise<GroupOptions> {
  const [groups, sections, team, priceLists] = await Promise.all([store.groups(), store.sections(), store.teamMembers(), store.priceLists()]);
  return {
    groups: groupChoices(groups, sections),
    coaches: team.map((t) => ({ documentId: t.id, name: t.name })),
    priceLists: priceLists.map((p) => ({ documentId: p.id, name: p.name, sectionId: p.sectionId })),
  };
}
