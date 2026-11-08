import { csvDate, toCsv } from '../../csv';
import { slugify } from '../../profile-slug';
import { hhmm } from '../../groups/dates';
import { durationText } from '../../prezenta/day-view';
import type { CoachPage } from '../attendance/api-types';
import { COACH_CSV_HEADER, COACH_CSV_TYPES } from '../copy/attendance';
import type { Period } from '../period';
import { hoursText } from './hours';

type Line = { date: string; time: string; cells: (string | number)[] };

const lineOf = (i: { date: string; time: string; type: string; name: string; min: number }): Line => ({
  date: i.date, time: i.time, cells: [csvDate(i.date), i.type, i.name, i.time, durationText(i.min), hoursText(i.min)],
});

/** One line per counted session or lesson, oldest first (4.2, 4.3): saved sessions with someone present, present lessons. */
export function coachCsv(page: CoachPage): string {
  const sessions = page.sessions.flatMap((r) => (r.sessionId !== null && r.present > 0 && r.durationMin !== null
    ? [lineOf({ date: r.date, time: r.startTime, type: COACH_CSV_TYPES.grup, name: r.groupName, min: r.durationMin })] : []));
  const lessons = page.lessons.filter((l) => l.present === true)
    .map((l) => lineOf({ date: l.date, time: hhmm(l.startTime) ?? l.startTime, type: COACH_CSV_TYPES.individual, name: l.athleteName, min: l.durationMin }));
  const lines = [...sessions, ...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return toCsv(COACH_CSV_HEADER, lines.map((l) => l.cells));
}

/** `antrenor-andrei-popa-2026-11-01-2026-11-30.csv` (ruling 13). */
export const coachCsvName = (name: string, period: Period): string => `antrenor-${slugify(name)}-${period.from}-${period.to}.csv`;
