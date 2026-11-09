import { refuse, type AdminResult } from '../../admin-result';
import { readDay } from '../../presence/attendance/day';
import type { DayRow } from '../../presence/attendance/api-types';
import type { SessionRow } from '../../presence/types';
import { PORTAL_ERRORS } from '../copy';
import type { CoachClassRow, CoachLessonRow, CoachToday } from './api-types';
import type { CoachContexts } from './context';
import { locationsOf } from './calendar';
import { ownGroupIds } from './ownership';

type Located = (groupId: string) => string | null;

const classRow = (r: DayRow, standIn: boolean, location: Located): CoachClassRow => ({
  sessionId: r.sessionId, occurrenceKey: r.occurrenceKey, groupId: r.groupId, groupName: r.groupName, date: r.date, startTime: r.startTime,
  children: r.listed, done: r.state === 'salvata', standIn, location: location(r.groupId),
});

/** Saved sessions of other groups that list the coach (S31). */
async function standInRows(c: CoachContexts, rows: DayRow[]): Promise<DayRow[]> {
  const ids = rows.flatMap((r) => (r.sessionId ? [r.sessionId] : []));
  if (ids.length === 0) return [];
  const mine = new Set((await c.presence.store.sessions({ ids })).filter((s: SessionRow) => s.coachIds.includes(c.coach.teamMemberId)).map((s) => s.id));
  return rows.filter((r) => r.sessionId !== null && mine.has(r.sessionId));
}

async function lessonsOf(c: CoachContexts, date: string): Promise<CoachLessonRow[]> {
  const [lessons, athletes] = await Promise.all([c.presence.store.lessons({ from: date, to: date }), c.presence.store.athletes()]);
  const names = new Map(athletes.map((a) => [a.id, a.name ?? '']));
  return lessons.filter((l) => l.coachIds.includes(c.coach.teamMemberId)).sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((l) => ({ lessonId: l.id, athleteName: names.get(l.athleteId) ?? '', date: l.date, startTime: l.startTime, durationMin: l.durationMin, done: l.present !== null }));
}

/** Azi (spec 9.3): the coach's classes, stand-in classes already saved, lessons, and the past classes still to do. */
export async function readToday(c: CoachContexts, date: unknown): Promise<AdminResult<CoachToday>> {
  const wanted = date === undefined || date === '' ? c.today : date;
  const day = await readDay(c.presence.store, wanted, c.today);
  if (!day.ok) return refuse(400, PORTAL_ERRORS.invalid);
  const groups = await c.presence.store.groups();
  const own = ownGroupIds(groups, c.coach.teamMemberId);
  const places = await locationsOf(c, groups);
  const where: Located = (id) => places.get(id) ?? null;
  const ownRows = day.data.day.filter((r) => own.has(r.groupId));
  const standIn = await standInRows(c, day.data.day.filter((r) => !own.has(r.groupId)));
  return {
    ok: true,
    data: {
      date: day.data.date, today: c.today,
      groups: [...ownRows.map((r) => classRow(r, false, where)), ...standIn.map((r) => classRow(r, true, where))].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      lessons: await lessonsOf(c, day.data.date),
      todo: day.data.undone.filter((r) => own.has(r.groupId)).map((r) => classRow(r, false, where)),
    },
  };
}
