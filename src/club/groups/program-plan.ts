import { expandOccurrences, type CalendarEventRow } from '../../api/calendar-event/services/expand';
import { isRecord } from '../narrow';
import { DURATION, GROUP_ERRORS, SCHEDULE_ERRORS } from './copy';
import { addDays, addMinutes, isIsoDate, isTime, minutesBetween, minutesOf } from './dates';
import { DAY_ORDER, type SeriesText } from './program-text';
import type { RepeatFreq } from './series';
import type { DayKey, EventRecord, EventWrite, ExceptionRow, GroupRecord, Recurrence, SeasonRecord, WeekOfMonth } from './types';

/** The group program rules (spec 3.3, 3.4, 6.3, W10, W12). Pure. */
export type SeriesInput = { freq: RepeatFreq; weekOfMonth: WeekOfMonth | null; days: DayKey[]; startTime: string; durationMin: number; from: string };
export type ClassInput = { date: string; startTime: string; durationMin: number; note: string | null };
export type ProgramInput = { repeat: true; series: SeriesInput } | { repeat: false; one: ClassInput };
export type DateMode = { mode: 'keep' } | { mode: 'cancel'; reason: string | null } | { mode: 'move'; newDate: string; newStartTime: string; reason: string | null };
export type EventChange = { op: 'end'; recurrence: Recurrence; exceptions: ExceptionRow[] } | { op: 'delete' };
type Read<T> = { ok: true; value: T } | { ok: false; error: string };
type Body = Record<string, unknown>;

const FREQS: readonly RepeatFreq[] = ['weekly', 'biweekly', 'monthly'];
const WEEKS: readonly WeekOfMonth[] = ['first', 'second', 'third', 'fourth', 'last'];
const LAST_MINUTE = 23 * 60 + 59;
const invalid = { ok: false as const, error: GROUP_ERRORS.invalid };
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const validDuration = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= DURATION.min && n <= DURATION.max && n % DURATION.step === 0;
/** No overnight group classes (3.3, decided 8). */
const fitsDay = (start: string, minutes: number): boolean => minutesOf(start) + minutes <= LAST_MINUTE;

function readTimes(b: Body): Read<{ startTime: string; durationMin: number }> {
  if (!isTime(b.startTime) || !validDuration(b.durationMin) || !fitsDay(b.startTime, b.durationMin)) return invalid;
  return { ok: true, value: { startTime: b.startTime, durationMin: b.durationMin } };
}

export function readSeriesInput(body: unknown): Read<SeriesInput> {
  const b = isRecord(body) ? body : {};
  const freq = FREQS.find((f) => f === b.freq);
  const days = Array.isArray(b.days) ? DAY_ORDER.filter((d) => (b.days as unknown[]).includes(d)) : [];
  const times = readTimes(b);
  if (!freq || !isIsoDate(b.from) || times.ok === false) return invalid;
  if (!days.length) return { ok: false, error: SCHEDULE_ERRORS.noDays };
  const weekOfMonth = freq === 'monthly' ? WEEKS.find((w) => w === b.weekOfMonth) ?? 'first' : null;
  return { ok: true, value: { freq, weekOfMonth, days, ...times.value, from: b.from } };
}

function readClassInput(b: Body): Read<ClassInput> {
  const times = readTimes(b);
  if (!isIsoDate(b.date) || times.ok === false) return invalid;
  return { ok: true, value: { date: b.date, ...times.value, note: text(b.note, 500) } };
}

/** "Program nou": "Se repetă" on (default) is a series; off is one class (6.3). */
export function readProgramInput(body: unknown): Read<ProgramInput> {
  const b = isRecord(body) ? body : {};
  if (b.repeat === false) {
    const one = readClassInput(b);
    if (one.ok === false) return one;
    return { ok: true, value: { repeat: false, one: one.value } };
  }
  const series = readSeriesInput(b);
  if (series.ok === false) return series;
  return { ok: true, value: { repeat: true, series: series.value } };
}

export function readDateMode(body: unknown): DateMode | null {
  const b = isRecord(body) ? body : {};
  const reason = text(b.reason, 120);
  if (b.mode === 'keep') return { mode: 'keep' };
  if (b.mode === 'cancel') return { mode: 'cancel', reason };
  if (b.mode === 'move' && isIsoDate(b.newDate) && isTime(b.newStartTime)) return { mode: 'move', newDate: b.newDate, newStartTime: b.newStartTime, reason };
  return null;
}

/** "Anunță părinții pe e-mail": only when ticked (W7). */
export const wantsEmail = (body: unknown): boolean => isRecord(body) && body.notifyParents === true;

export const seasonOf = (seasons: SeasonRecord[], date: string): SeasonRecord | null =>
  seasons.find((s) => s.startMonth.slice(0, 10) <= date && date <= s.endMonth.slice(0, 10)) ?? null;

/** W9: school groups write `scoala`, Club groups `curs`. */
export const eventType = (kind: 'school' | 'club'): string => (kind === 'school' ? 'scoala' : 'curs');

export const inputText = (s: SeriesInput): SeriesText => ({ freq: s.freq, days: s.days, startTime: s.startTime, durationMin: s.durationMin, from: s.from });

const seriesRecurrence = (s: SeriesInput, seasonEnd: string): Recurrence => ({
  freq: s.freq, days: s.days, weekOfMonth: s.weekOfMonth, startTime: s.startTime, endTime: addMinutes(s.startTime, s.durationMin), singleDate: null, seasonStart: s.from, seasonEnd,
});

/** A new series: from "Se aplică din" to the last day of that season (W10), titled with the group name (W9). */
export const seriesWrite = (group: GroupRecord, type: string, s: SeriesInput, seasonEnd: string): EventWrite => ({
  title: group.name, type, description: null, groupId: group.id, recurrence: seriesRecurrence(s, seasonEnd), exceptions: [],
});

/** One class: its note is the event description (6.3). */
export const classWrite = (group: GroupRecord, type: string, c: ClassInput): EventWrite => ({
  title: group.name, type, description: c.note, groupId: group.id, exceptions: [],
  recurrence: { freq: 'none', days: [], weekOfMonth: null, startTime: c.startTime, endTime: addMinutes(c.startTime, c.durationMin), singleDate: c.date, seasonStart: null, seasonEnd: null },
});

const strapiTime = (t: string | null): string | null => (t ? `${t}:00.000` : null);
const dayFlags = (days: DayKey[]) => ({
  mon: days.includes('mon'), tue: days.includes('tue'), wed: days.includes('wed'), thu: days.includes('thu'), fri: days.includes('fri'), sat: days.includes('sat'), sun: days.includes('sun'),
});

/** The expansion's row for one of our events; a group event gets its group, so breaks apply to it (3.5). */
export function asCalendarRow(e: Omit<EventRecord, 'id'> & { id?: string }, groupName = ''): CalendarEventRow {
  const r = e.recurrence;
  return {
    id: 0, documentId: e.id, title: e.title, type: e.type, description: e.description,
    recurrence: { freq: r.freq, ...dayFlags(r.days), weekOfMonth: r.weekOfMonth, startTime: strapiTime(r.startTime), endTime: strapiTime(r.endTime), singleDate: r.singleDate, seasonStart: r.seasonStart, seasonEnd: r.seasonEnd },
    exceptions: e.exceptions.map((x) => ({ ...x, newStartTime: strapiTime(x.newStartTime), newEndTime: strapiTime(x.newEndTime) })),
    group: e.groupId ? { documentId: e.groupId, name: groupName } : null,
  };
}

/** The dates the event holds a class between `from` and `to`, exceptions and breaks ignored. */
export function classDates(e: Omit<EventRecord, 'id'> & { id?: string }, from: string, to: string): string[] {
  if (from > to) return [];
  return expandOccurrences([asCalendarRow({ ...e, exceptions: [] })], [], from, to).map((o) => o.date);
}

export const isClassDate = (e: Omit<EventRecord, 'id'> & { id?: string }, date: string): boolean => classDates(e, date, date).includes(date);

/** "Șterge programul" from `from`: ends the day before; a series with no class before that day is deleted (W10). */
export function planEnd(e: EventRecord, from: string): EventChange {
  const start = e.recurrence.seasonStart ?? from;
  if (!classDates(e, start, addDays(from, -1)).length) return { op: 'delete' };
  return { op: 'end', recurrence: { ...e.recurrence, seasonEnd: addDays(from, -1) }, exceptions: e.exceptions.filter((x) => x.date < from) };
}

/** "Schimbă" from `input.from`: the old series ends (or goes), a new one starts; changed dates from that day on move when still class dates (W10). */
export function planChange(e: EventRecord, input: SeriesInput, title: string): { old: EventChange; created: EventWrite } {
  const created: EventWrite = {
    title, type: e.type, description: e.description, groupId: e.groupId, exceptions: [], recurrence: seriesRecurrence(input, e.recurrence.seasonEnd ?? input.from),
  };
  const carried = e.exceptions.filter((x) => x.date >= input.from && isClassDate(created, x.date));
  return { old: planEnd(e, input.from), created: { ...created, exceptions: carried } };
}

const blank = (date: string): ExceptionRow => ({ date, kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null });

/** "Ține" removes the date's exception, "Anulează" writes `anulat`, "Mută" writes `override` with the series duration (W12). */
export function planDateMode(e: EventRecord, date: string, m: DateMode): ExceptionRow[] | null {
  const rest = e.exceptions.filter((x) => x.date !== date);
  if (m.mode === 'keep') return rest;
  if (m.mode === 'cancel') return [...rest, { ...blank(date), reason: m.reason }];
  const minutes = minutesBetween(e.recurrence.startTime ?? '00:00', e.recurrence.endTime ?? '00:00');
  if (!fitsDay(m.newStartTime, minutes)) return null;
  return [...rest, { ...blank(date), kind: 'override', newDate: m.newDate === date ? null : m.newDate, newStartTime: m.newStartTime, newEndTime: addMinutes(m.newStartTime, minutes), reason: m.reason }];
}
