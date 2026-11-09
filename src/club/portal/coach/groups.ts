import { refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import type { MembershipRow } from '../../athletes/store';
import { addDays, hhmm } from '../../groups/dates';
import { groupListRow, type ListFacts } from '../../groups/list';
import { readGroupPage } from '../../groups/group-page';
import { ageOnIso, currentSeason } from '../../groups/season-pick';
import { byGroupOrder, orderedSections } from '../../groups/sections';
import type { GroupRecord, SectionRecord } from '../../groups/types';
import { loadRowContext, rowsBetween } from '../../presence/attendance/day';
import { heldOccurrences } from '../../presence/sessions';
import { PORTAL_ERRORS } from '../copy';
import type { CoachGroupPage, CoachGroupRow, CoachGroups, CoachMember, NextClass, OtherGroupRow, SectionKind, StandInSlot } from './api-types';
import { locationOfGroup } from './calendar';
import { clockOf } from './context';
import type { CoachContexts } from './context';
import { groupAccess } from './ownership';
import { toCoachMember } from './views';

export async function listFacts(c: CoachContexts): Promise<ListFacts & { memberships: MembershipRow[] }> {
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
  const next = await nextClasses(c);
  for (const g of ordered(f)) {
    const row = groupListRow(g, f);
    if (groupAccess(g, c.coach.teamMemberId) === 'own') {
      mine.push({ groupId: g.id, name: g.name, kind: kindOf(f.sections, g), program: row.program, children: row.members, next: next(g.id) });
    } else {
      others.push({ groupId: g.id, name: g.name, coaches: f.team.filter((t) => g.coachIds.includes(t.id)).map((t) => t.name), program: row.program, children: row.members, next: next(g.id) });
    }
  }
  return { ok: true, data: { mine, others } };
}

const AHEAD_DAYS = 60;


/** The first scheduled, not cancelled class of a group from now on (today counts while its start time is later than now), up to 60 days ahead. */
async function nextClasses(c: CoachContexts): Promise<(groupId: string) => NextClass | null> {
  const store = c.presence.store;
  const held = heldOccurrences(await store.calendarWindow(), await store.groups(), c.today, addDays(c.today, AHEAD_DAYS));
  const clock = clockOf(c.presence.now());
  return (groupId) => {
    const h = held.find((x) => x.groupId === groupId && (x.date > c.today || (hhmm(x.startTime) ?? x.startTime) > clock));
    return h ? { date: h.date, startTime: hhmm(h.startTime) ?? h.startTime } : null;
  };
}

/** The current members, plus those with a scheduled end (`to` on or after today), who stay listed with `leavesOn`. */
async function members(c: CoachContexts, groupId: string): Promise<CoachMember[]> {
  const store = c.presence.store;
  const page = await readGroupPage(c.groups.store, groupId, null, c.today);
  const statuses = new Map((await store.athletes()).map((a) => [a.id, a]));
  const listed = (page?.members ?? []).map((m) => toCoachMember(m, statuses.get(m.athleteId)?.status ?? 'activ'));
  const season = currentSeason(await store.seasons());
  if (!season) return listed;
  const rows = await store.memberships({ seasonId: season.id });
  const groupNames = new Map((await store.groups()).map((g) => [g.id, g.name]));
  const leaving = rows.filter((m) => m.groupId === groupId && m.to && m.to >= c.today);
  const shown = new Set(listed.map((m) => m.athleteId));
  const extra = leaving.filter((m) => !shown.has(m.athleteId)).flatMap((m): CoachMember[] => {
    const a = statuses.get(m.athleteId);
    if (!a || a.status === 'anonimizat') return [];
    const alsoIn = rows.filter((r) => r.athleteId === a.id && r.groupId !== groupId && !r.to).map((r) => groupNames.get(r.groupId) ?? '').filter(Boolean);
    return [{ athleteId: a.id, name: a.name ?? '', age: ageOnIso(a.birthDate, c.today), isNew: a.status === 'nou', alsoIn, leavesOn: addDays(m.to as string, 1) }];
  });
  const ends = new Map(leaving.map((m) => [m.athleteId, addDays(m.to as string, 1)]));
  return [...listed.map((m) => ({ ...m, leavesOn: ends.get(m.athleteId) ?? null })), ...extra].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

const slotOf = (r: { occurrenceKey: string | null; date: string; startTime: string }): StandInSlot[] =>
  r.occurrenceKey ? [{ occurrenceKey: r.occurrenceKey, date: r.date, startTime: r.startTime }] : [];

/** The group's classes nobody saved yet from today - 7 to today, newest first (a saved class is its owner's), and today's one a stand-in may still take. */
async function slots(c: CoachContexts, groupId: string, own: boolean): Promise<{ standIn: StandInSlot[]; todayKey: string | null }> {
  const ctx = await loadRowContext(c.presence.store, c.today);
  const rows = (await rowsBetween(c.presence.store, ctx, addDays(c.today, -7), c.today, groupId)).filter((r) => !r.outsideSchedule && r.occurrenceKey !== null);
  const standIn = own ? [] : rows.filter((r) => r.sessionId === null).flatMap(slotOf).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  let todayKey: string | null = null;
  for (const row of rows.filter((r) => r.date === c.today)) {
    const session = row.sessionId ? await c.presence.store.session(row.sessionId) : null;
    if (own || !session || session.coachIds.includes(c.coach.teamMemberId)) { todayKey = row.occurrenceKey; break; }
  }
  return { standIn, todayKey };
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
      location: await locationOfGroup(c, group),
    },
  };
}
