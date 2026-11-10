import { refuse, type AdminResult } from '../../admin-result';
import { minutesOf, weekdayName } from '../../groups/dates';
import { LESSON_ERRORS, shortDay } from '../copy/attendance';
import type { LessonRow } from '../types';

const endOf = (startTime: string, durationMin: number): number => minutesOf(startTime) + durationMin;

/** The first lesson of the athlete (outside `ignore`) whose time range meets [startTime, startTime + durationMin) on `date`; touching ranges do not meet. */
export function conflictOf(lessons: LessonRow[], date: string, startTime: string, durationMin: number, ignore: Set<string>): LessonRow | null {
  const start = minutesOf(startTime);
  const end = endOf(startTime, durationMin);
  const hits = lessons.filter((l) => l.date === date && !ignore.has(l.id) && minutesOf(l.startTime) < end && start < endOf(l.startTime, l.durationMin));
  return hits.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))[0] ?? null;
}

/** "joi, 19 noi" (Istoric short months). */
const dayText = (date: string): string => `${weekdayName(date)}, ${shortDay(date)}`;

/** A refusal of 409 with the conflict copy for the first (earliest) date that meets a lesson outside `ignore`; null when none does. */
export function firstConflict(lessons: LessonRow[], dates: string[], startTime: string, durationMin: number, ignore: Set<string>): AdminResult<never> | null {
  for (const date of dates) {
    if (conflictOf(lessons, date, startTime, durationMin, ignore)) return refuse(409, LESSON_ERRORS.conflict(dayText(date), startTime));
  }
  return null;
}

