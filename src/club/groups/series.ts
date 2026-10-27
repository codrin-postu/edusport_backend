import { clampDate, hhmm, minutesBetween } from './dates';
import type { SeriesText } from './program-text';
import type { DayKey, EventRecord, WeekOfMonth } from './types';

/** A group's weekly series and one-off classes, read off calendar events (spec 3.3). Pure. */
export type RepeatFreq = 'weekly' | 'biweekly' | 'monthly';
export type SeriesView = {
  eventId: string; freq: RepeatFreq; days: DayKey[]; weekOfMonth: WeekOfMonth | null; startTime: string; endTime: string; durationMin: number; from: string; to: string;
};
export type ClassView = { eventId: string; date: string; startTime: string; endTime: string; durationMin: number; note: string | null };
type SeasonDates = { startMonth: string; endMonth: string };

const isRepeat = (f: string): f is RepeatFreq => f === 'weekly' || f === 'biweekly' || f === 'monthly';

export function seriesView(e: EventRecord): SeriesView | null {
  const r = e.recurrence;
  const start = hhmm(r.startTime);
  const end = hhmm(r.endTime);
  if (!isRepeat(r.freq) || !start || !end || !r.seasonStart || !r.seasonEnd) return null;
  return {
    eventId: e.id, freq: r.freq, days: r.days, weekOfMonth: r.weekOfMonth, startTime: start, endTime: end,
    durationMin: minutesBetween(start, end), from: r.seasonStart, to: r.seasonEnd,
  };
}

export function classView(e: EventRecord): ClassView | null {
  const r = e.recurrence;
  const start = hhmm(r.startTime);
  const end = hhmm(r.endTime);
  if (r.freq !== 'none' || !r.singleDate || !start || !end) return null;
  return { eventId: e.id, date: r.singleDate, startTime: start, endTime: end, durationMin: minutesBetween(start, end), note: e.description };
}

export const seasonBounds = (s: SeasonDates): { start: string; end: string } => ({ start: s.startMonth.slice(0, 10), end: s.endMonth.slice(0, 10) });

export function overlapsSeason(x: { from: string; to: string }, season: SeasonDates): boolean {
  const b = seasonBounds(season);
  return x.from <= b.end && x.to >= b.start;
}

export const runningOn = (s: SeriesView, date: string): boolean => s.from <= date && s.to >= date;
const byStart = (a: SeriesView, b: SeriesView): number => a.from.localeCompare(b.from) || a.startTime.localeCompare(b.startTime);

/** Every series of the group that touches the season, oldest first. */
export function groupSeries(events: EventRecord[], groupId: string, season: SeasonDates): SeriesView[] {
  return events
    .filter((e) => e.groupId === groupId)
    .map(seriesView)
    .filter((s): s is SeriesView => s !== null && overlapsSeason(s, season))
    .sort(byStart);
}

/** One-off classes of the group inside the season, by date. */
export function groupClasses(events: EventRecord[], groupId: string, season: SeasonDates): ClassView[] {
  const b = seasonBounds(season);
  return events
    .filter((e) => e.groupId === groupId)
    .map(classView)
    .filter((c): c is ClassView => c !== null && c.date >= b.start && c.date <= b.end)
    .sort((a, b2) => a.date.localeCompare(b2.date));
}

/** "Program obișnuit" (6.3) and the Grupe "Program" column (5.2): the season's series still running today or later; a past season, on its last day. */
export function currentSeries(events: EventRecord[], groupId: string, season: SeasonDates, today: string): SeriesView[] {
  const b = seasonBounds(season);
  const cutoff = clampDate(today, b.start, b.end);
  return groupSeries(events, groupId, season).filter((s) => s.to >= cutoff);
}

export const seriesText = (s: SeriesView): SeriesText => ({ freq: s.freq, days: s.days, startTime: s.startTime, durationMin: s.durationMin, from: s.from });
