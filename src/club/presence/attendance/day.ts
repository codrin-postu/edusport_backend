import type { MembershipRow } from '../../athletes/store';
import type { AdminResult } from '../../admin-result';
import { addDays, hhmm, isIsoDate } from '../../groups/dates';
import type { GroupRecord, SeasonRecord } from '../../groups/types';
import { groupsWithoutPriceList } from '../billing';
import { seasonOfDate } from '../dates';
import { PRESENCE_ERRORS } from '../copy/core';
import { heldOccurrences, sessionState } from '../sessions';
import type { PresenceStore } from '../store';
import type { AttendanceRow, HeldOccurrence, SessionRow } from '../types';
import { rosterOn } from './roster';
import type { DayPage, DayRow } from './api-types';
import { outsideFor, presentCounts } from './view';

export type RowContext = {
  today: string; startDate: string | null; groups: GroupRecord[]; seasons: SeasonRecord[]; memberships: MembershipRow[]; teamNames: Map<string, string>;
};

export async function loadRowContext(store: PresenceStore, today: string): Promise<RowContext> {
  const [groups, seasons, memberships, team, startDate] = await Promise.all([
    store.groups(), store.seasons(), store.memberships(), store.teamMembers(), store.attendanceStartDate(),
  ]);
  return { today, startDate, groups, seasons, memberships, teamNames: new Map(team.map((t) => [t.id, t.name])) };
}

const coachNames = (ctx: RowContext, ids: string[]): string[] => ids.map((id) => ctx.teamNames.get(id)).filter((n): n is string => n !== undefined);
const groupOf = (ctx: RowContext, id: string): GroupRecord | undefined => ctx.groups.find((g) => g.id === id);

export type DayRowWithCoaches = DayRow & { coachIds: string[] };

function heldRow(h: HeldOccurrence, ctx: RowContext): DayRowWithCoaches {
  const group = groupOf(ctx, h.groupId);
  const season = seasonOfDate(ctx.seasons, h.date);
  const listed = season ? rosterOn(ctx.memberships, h.groupId, season.id, h.date).length : 0;
  return {
    sessionId: null, occurrenceKey: h.key, groupId: h.groupId, groupName: group?.name ?? '', date: h.date, startTime: hhmm(h.startTime) ?? h.startTime,
    coachNames: coachNames(ctx, group?.coachIds ?? []), coachIds: group?.coachIds ?? [], present: 0, listed, visitors: 0,
    state: sessionState({ saved: false, date: h.date, today: ctx.today, startDate: ctx.startDate }), outsideSchedule: false,
  };
}

function savedRow(s: SessionRow, atts: AttendanceRow[], ctx: RowContext, held: HeldOccurrence[]): DayRowWithCoaches {
  const listed = rosterOn(ctx.memberships, s.groupId, s.seasonId, s.date);
  const counts = presentCounts(atts, listed);
  return {
    sessionId: s.id, occurrenceKey: s.occurrenceKey, groupId: s.groupId, groupName: groupOf(ctx, s.groupId)?.name ?? '', date: s.date,
    startTime: hhmm(s.startTime) ?? s.startTime, coachNames: coachNames(ctx, s.coachIds), coachIds: s.coachIds, present: counts.present, listed: listed.length,
    visitors: counts.visitors, state: sessionState({ saved: true, date: s.date, today: ctx.today, startDate: ctx.startDate }),
    outsideSchedule: outsideFor({ source: s.source, groupId: s.groupId, date: s.date, startTime: s.startTime }, held),
  };
}

/** Rows of the held occurrences and saved sessions from `from` to `to`, optionally of one group, with the coach ids behind the names. `withAttendances: false` skips the attendance read (counts stay 0). */
export async function rowsWithCoachIds(
  store: PresenceStore, ctx: RowContext, from: string, to: string, groupId?: string, opts: { withAttendances?: boolean } = {},
): Promise<DayRowWithCoaches[]> {
  const held = heldOccurrences(await store.calendarWindow(), ctx.groups, from, to).filter((h) => !groupId || h.groupId === groupId);
  const sessions = await store.sessions({ from, to, ...(groupId ? { groupId } : {}) });
  const atts = sessions.length > 0 && opts.withAttendances !== false ? await store.attendances({ sessionIds: sessions.map((s) => s.id) }) : [];
  const attsOf = (id: string): AttendanceRow[] => atts.filter((a) => a.sessionId === id);
  const byKey = new Map(sessions.flatMap((s) => (s.occurrenceKey ? [[s.occurrenceKey, s] as const] : [])));
  const heldKeys = new Set(held.map((h) => h.key));
  const rows = held.map((h) => {
    const s = byKey.get(h.key);
    return s ? savedRow(s, attsOf(s.id), ctx, held) : heldRow(h, ctx);
  });
  for (const s of sessions) {
    if (!(s.occurrenceKey && heldKeys.has(s.occurrenceKey))) rows.push(savedRow(s, attsOf(s.id), ctx, held));
  }
  return rows;
}

/** Rows of the held occurrences and saved sessions from `from` to `to`, optionally of one group. Held rows without a state are kept. */
export async function rowsBetween(store: PresenceStore, ctx: RowContext, from: string, to: string, groupId?: string): Promise<DayRow[]> {
  return (await rowsWithCoachIds(store, ctx, from, to, groupId)).map(({ coachIds: _ids, ...row }) => row);
}

const orderOf = (ctx: RowContext, groupId: string): number => groupOf(ctx, groupId)?.order ?? 0;

/** Start time, then the group's order on the Program tab (decided 6). */
export const byStartThenOrder = (ctx: RowContext) => (a: DayRow, b: DayRow): number =>
  a.startTime.localeCompare(b.startTime) || orderOf(ctx, a.groupId) - orderOf(ctx, b.groupId);

export const byUndoneOrder = (a: DayRow, b: DayRow): number => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime);

/** The day list and the undone list (spec 5.2): the undone list is held occurrences with no session from the start date to yesterday. */
export async function readDay(store: PresenceStore, date: unknown, today: string): Promise<AdminResult<DayPage>> {
  if (!isIsoDate(date)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  const ctx = await loadRowContext(store, today);
  const day = (await rowsBetween(store, ctx, date, date)).filter((r) => r.state !== null).sort(byStartThenOrder(ctx));
  const yesterday = addDays(today, -1);
  const undone = ctx.startDate && ctx.startDate <= yesterday
    ? (await rowsBetween(store, ctx, ctx.startDate, yesterday)).filter((r) => r.sessionId === null).sort(byUndoneOrder)
    : [];
  return { ok: true, data: { date, today, startDate: ctx.startDate, groupsWithoutList: groupsWithoutPriceList(ctx.groups), undone, day } };
}
