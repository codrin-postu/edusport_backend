import type { AdminResult } from '../../admin-result';
import { loadRowContext } from '../attendance/day';
import { periodRows } from '../attendance/period';
import type { CoachDay, CoachPage, CoachSessionRow, PeriodLessonRow, PeriodRow } from '../attendance/api-types';
import { PRESENCE_ERRORS } from '../copy/core';
import { byDateTime, lessonListRow } from '../lessons/read';
import type { Period } from '../period';
import type { PresenceStore } from '../store';
import { hoursText } from './hours';

type Now = { date: string; time: string };
type Counted = { date: string; kind: 'sessions' | 'lessons'; minutes: number };

const newestFirst = (a: PeriodRow, b: PeriodRow): number => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime);

/** Days with hours, ascending: each counted session or lesson adds its minutes to its date. */
function daysOf(counted: Counted[]): CoachDay[] {
  const byDate = new Map<string, { sessions: number; lessons: number; minutes: number }>();
  for (const c of counted) {
    const d = byDate.get(c.date) ?? { sessions: 0, lessons: 0, minutes: 0 };
    byDate.set(c.date, { ...d, [c.kind]: d[c.kind] + 1, minutes: d.minutes + c.minutes });
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, sessions: d.sessions, lessons: d.lessons, hours: hoursText(d.minutes) }));
}

const sum = (counted: Counted[], kind: Counted['kind']): number => counted.filter((c) => c.kind === kind).length;

/** One coach over a period (spec 5.2, 5.3): the sessions he is on, his lessons, and the hours counted as 4.3 (saved sessions with someone present, present lessons). */
export async function readCoachPage(store: PresenceStore, coachId: string, period: Period, now: Now): Promise<AdminResult<CoachPage>> {
  const ctx = await loadRowContext(store, now.date);
  const name = ctx.teamNames.get(coachId);
  if (name === undefined) return { ok: false, status: 404, error: PRESENCE_ERRORS.coachNotFound };
  const [rows, lessons, athletes, savedSessions] = await Promise.all([
    periodRows(store, ctx, period.from, period.to, now), store.lessons(period), store.athletes(), store.sessions(period),
  ]);
  const minutesOf = new Map(savedSessions.map((s) => [s.id, s.durationMin]));
  const sessions: CoachSessionRow[] = rows.filter((r) => r.coachIds.includes(coachId)).sort(newestFirst)
    .map((r) => ({ ...r, durationMin: r.sessionId === null ? null : minutesOf.get(r.sessionId) ?? null }));
  const mine = lessons.filter((l) => l.coachIds.includes(coachId));
  const counted: Counted[] = [
    ...sessions.flatMap((r) => (r.sessionId !== null && r.present > 0 ? [{ date: r.date, kind: 'sessions' as const, minutes: r.durationMin ?? 0 }] : [])),
    ...mine.filter((l) => l.present === true).map((l) => ({ date: l.date, kind: 'lessons' as const, minutes: l.durationMin })),
  ];
  const names = { athletes: new Map(athletes.map((a) => [a.id, a.name])), coaches: ctx.teamNames, now };
  const lessonRows: PeriodLessonRow[] = byDateTime(mine).reverse().map((l) => lessonListRow(l, names));
  const total = counted.reduce((n, c) => n + c.minutes, 0);
  return {
    ok: true,
    data: { name, totals: { sessions: sum(counted, 'sessions'), lessons: sum(counted, 'lessons'), hours: hoursText(total) }, days: daysOf(counted), sessions, lessons: lessonRows },
  };
}
