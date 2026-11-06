import { refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import type { MembershipRow } from '../../athletes/store';
import { addDays } from '../../groups/dates';
import { groupListRow, type ListFacts } from '../../groups/list';
import { readGroupPage } from '../../groups/group-page';
import { currentSeason } from '../../groups/season-pick';
import { byGroupOrder, orderedSections } from '../../groups/sections';
import type { GroupRecord, SectionRecord } from '../../groups/types';
import { loadRowContext, rowsBetween } from '../../presence/attendance/day';
import { PORTAL_ERRORS } from '../copy';
import type { CoachGroupPage, CoachGroupRow, CoachGroups, CoachMember, OtherGroupRow, SectionKind, StandInSlot } from './api-types';
import type { CoachContexts } from './context';
import { groupAccess } from './ownership';
import { toCoachMember } from './views';

async function listFacts(c: CoachContexts): Promise<ListFacts & { memberships: MembershipRow[] }> {
  const store = c.presence.store;
  const [seasons, sections, groups, events, team] = await Promise.all([store.seasons(), store.sections(), store.groups(), c.groups.store.events(), store.teamMembers()]);
  const season = currentSeason(seasons);
  const memberships = season ? await store.memberships({ seasonId: season.id }) : [];
  return { season, sections, groups, current: memberships.filter(isCurrentMembership), events, team, today: c.today, memberships };
}

const kindOf = (sections: SectionRecord[], g: GroupRecord): SectionKind => sections.find((s) => s.id === g.sectionId)?.kind ?? 'school';

/** School first, then Club, each in the group order (as the admin list). */
function ordered(f: ListFacts): GroupRecord[] {
  const rank = new Map(orderedSections(f.sections).map((s, i) => [s.id, i]));
  return f.groups.filter((g) => g.active).sort((a, b) => (rank.get(a.sectionId ?? '') ?? 99) - (rank.get(b.sectionId ?? '') ?? 99) || byGroupOrder(a, b));
}

/** Grupe (spec 9.4): the coach's own groups with program and child count; the other active groups with their coaches only. */
export async function readGroups(c: CoachContexts): Promise<AdminResult<CoachGroups>> {
  const f = await listFacts(c);
  const mine: CoachGroupRow[] = [];
  const others: OtherGroupRow[] = [];
  for (const g of ordered(f)) {
    if (groupAccess(g, c.coach.teamMemberId) === 'own') {
      const row = groupListRow(g, f);
      mine.push({ groupId: g.id, name: g.name, kind: kindOf(f.sections, g), program: row.program, children: row.members });
    } else {
      others.push({ groupId: g.id, name: g.name, coaches: f.team.filter((t) => g.coachIds.includes(t.id)).map((t) => t.name) });
    }
  }
  return { ok: true, data: { mine, others } };
}

async function members(c: CoachContexts, groupId: string): Promise<CoachMember[]> {
  const page = await readGroupPage(c.groups.store, groupId, null, c.today);
  const statuses = new Map((await c.presence.store.athletes()).map((a) => [a.id, a.status]));
  return (page?.members ?? []).map((m) => toCoachMember(m, statuses.get(m.athleteId) ?? 'activ'));
}

const slotOf = (r: { occurrenceKey: string | null; date: string; startTime: string }): StandInSlot[] =>
  r.occurrenceKey ? [{ occurrenceKey: r.occurrenceKey, date: r.date, startTime: r.startTime }] : [];

/** The group's classes nobody saved yet from today - 7 to today, newest first (a saved class is its owner's), and today's one a stand-in may still take. */
async function slots(c: CoachContexts, groupId: string, own: boolean): Promise<{ standIn: StandInSlot[]; todayKey: string | null }> {
  const ctx = await loadRowContext(c.presence.store, c.today);
  const rows = (await rowsBetween(c.presence.store, ctx, addDays(c.today, -7), c.today, groupId)).filter((r) => !r.outsideSchedule && r.occurrenceKey !== null);
  const standIn = own ? [] : rows.filter((r) => r.sessionId === null).flatMap(slotOf).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  const today = rows.find((r) => r.date === c.today);
  const session = today?.sessionId ? await c.presence.store.session(today.sessionId) : null;
  const takeable = own || !session || session.coachIds.includes(c.coach.teamMemberId);
  return { standIn, todayKey: today && takeable ? today.occurrenceKey : null };
}

/** Group page (spec 9.5): roster only of an own group; another group shows its coaches and the classes a stand-in may take. */
export async function readCoachGroupPage(c: CoachContexts, groupId: string): Promise<AdminResult<CoachGroupPage>> {
  const f = await listFacts(c);
  const group = f.groups.find((g) => g.id === groupId) ?? null;
  const access = groupAccess(group, c.coach.teamMemberId);
  if (!group || access === 'none') return refuse(404, PORTAL_ERRORS.notFound);
  const own = access === 'own';
  const kind = kindOf(f.sections, group);
  const { standIn, todayKey } = await slots(c, groupId, own);
  return {
    ok: true,
    data: {
      groupId, name: group.name, kind, own, coaches: f.team.filter((t) => group.coachIds.includes(t.id)).map((t) => t.name), program: groupListRow(group, f).program,
      members: own ? await members(c, groupId) : null, standIn, todayKey, programPublic: own && kind === 'club' ? group.programPublic : null,
    },
  };
}
