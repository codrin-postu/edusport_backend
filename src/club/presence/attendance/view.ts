import { expandOccurrences, type Occurrence } from '../../../api/calendar-event/services/expand';
import type { CalendarWindow } from '../../groups/occurrences';
import { isTime } from '../../groups/dates';
import { durationOf, isOutsideSchedule } from '../sessions';
import type { HeldOccurrence, SessionSource } from '../types';

export { isTime };
export { savedLine, shortDay } from '../copy/attendance';

const DEFAULT_DURATION_MIN = 50;

/** "Grup", "Uscat" or "Grup, Uscat". */
export const typesText = (t: { grup: boolean; uscat: boolean }): string => [t.grup && 'Grup', t.uscat && 'Uscat'].filter(Boolean).join(', ');

/** Whole minutes in steps of 5, from 5 to 600 (decided 14). */
export const isDuration = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 5 && v <= 600 && v % 5 === 0;

/** Minutes of the group's series that holds on the date (its weekday and season range); 50 when none does (C20). */
export function defaultDuration(window: CalendarWindow, groupId: string, date: string): number {
  for (const ev of window.events) {
    if (ev.group?.documentId !== groupId) continue;
    const [occ] = expandOccurrences([ev], [], date, date) as Occurrence[];
    if (occ) return durationOf(occ);
  }
  return DEFAULT_DURATION_MIN;
}

/** A session outside the schedule (decided 7): added sessions by group and date, schedule sessions by date and time. */
export function outsideFor(s: { source: SessionSource; groupId: string; date: string; startTime: string }, held: HeldOccurrence[]): boolean {
  if (s.source === 'added') return !held.some((h) => h.groupId === s.groupId && h.date === s.date);
  return isOutsideSchedule(s, held);
}

/** Present: rows of athletes on the list. Visitors: rows flagged as visitors (C42). */
export function presentCounts(rows: { athleteId: string; visitor: boolean }[], listed: string[]): { present: number; visitors: number } {
  return {
    present: rows.filter((r) => listed.includes(r.athleteId)).length,
    visitors: rows.filter((r) => r.visitor).length,
  };
}
