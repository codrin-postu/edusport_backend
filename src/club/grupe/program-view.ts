import type { Occurrence } from '../../api/calendar-event/services/expand';
import { DURATION, FREQ_LABELS, GRUPE_COPY, SCHEDULE_ERRORS, SCHEDULE_TOASTS, WEEK_OF_MONTH_LABELS, durationLabel } from '../groups/copy';
import { MONTHS_LONG, MONTHS_SHORT, capitalized, dayMonth, weekdayName } from '../groups/dates';
import type { ProgramRow } from '../groups/program-read';
import { DAY_ORDER, DAY_SHORT } from '../groups/program-text';
import type { DayKey, WeekOfMonth } from '../groups/types';

/** The group Program tab (spec 6.3). Pure: the admin bundle and the tests import it. */
export type ChipView = { cat: 'scoala' | 'antrenament' | 'anulat' | 'liber'; time: string; text: string; struck: boolean; title: string };
/** What the chips and the panel read of an occurrence: the API's `Occurrence` and the calendar components' one both fit. */
export type ChipSource = Pick<Occurrence, 'type' | 'status' | 'cancelReason' | 'startTime' | 'date'> & { note?: string | null; originalDate?: string | null; originalStartTime?: string | null };
export type Freq = keyof typeof FREQ_LABELS;
export type ProgramForm = { repeat: boolean; freq: Freq; weekOfMonth: WeekOfMonth; days: DayKey[]; startTime: string; durationMin: number; from: string; date: string; note: string };
export type DateMode = 'keep' | 'cancel' | 'move';
export type DateForm = { mode: DateMode; newDate: string; newStartTime: string; reason: string; notify: boolean };

export const isBreak = (o: ChipSource): boolean => o.status === 'cancelled' && o.cancelReason === 'blackout';
/** The server addresses a moved date by the series date it came from. */
export const dateKey = (o: ChipSource): string => o.originalDate ?? o.date;

function chipText(o: ChipSource): string {
  if (isBreak(o)) return o.note ?? '';
  if (o.status === 'cancelled') return o.note ? `${GRUPE_COPY.cancelled}: ${o.note}` : GRUPE_COPY.cancelled;
  if (o.status !== 'override') return '';
  const sameDay = !o.originalDate || o.originalDate === o.date;
  return GRUPE_COPY.movedFrom(sameDay ? o.originalStartTime ?? '' : dayMonth(o.originalDate as string));
}

export function groupChip(o: ChipSource): ChipView {
  const base = o.type === 'scoala' ? 'scoala' : 'antrenament';
  const cat = isBreak(o) ? 'liber' : o.status === 'cancelled' ? 'anulat' : base;
  const text = chipText(o);
  const time = o.startTime ?? '';
  return { cat, time, text, struck: o.status === 'cancelled', title: [time, text].filter(Boolean).join(' ') };
}

/** "9 - 15 noiembrie", "26 oct - 1 noiembrie" (mockup grupa-a A4). */
export function weekTitle(monday: Date): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const first = monday.getMonth() === sunday.getMonth() ? `${monday.getDate()}` : `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]}`;
  return `${first} - ${sunday.getDate()} ${MONTHS_LONG[sunday.getMonth()]}`;
}

/** "Sâmbătă, 14 noiembrie, 11:00" */
export const panelTitle = (date: string, time: string | null): string => [capitalized(weekdayName(date)), dayMonth(date), time].filter(Boolean).join(', ');

export function durationOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = DURATION.min; m <= DURATION.max; m += DURATION.step) out.push({ value: String(m), label: durationLabel(m) });
  return out;
}
export const freqOptions = (): { value: Freq; label: string }[] => (Object.keys(FREQ_LABELS) as Freq[]).map((value) => ({ value, label: FREQ_LABELS[value] }));
export const weekOfMonthOptions = (): { value: WeekOfMonth; label: string }[] =>
  (Object.keys(WEEK_OF_MONTH_LABELS) as WeekOfMonth[]).map((value) => ({ value, label: WEEK_OF_MONTH_LABELS[value] }));
export const DAY_TOGGLES: readonly { key: DayKey; label: string }[] = DAY_ORDER.map((key) => ({ key, label: DAY_SHORT[key] }));

export const newProgramForm = (today: string): ProgramForm => ({
  repeat: true, freq: 'weekly', weekOfMonth: 'first', days: [], startTime: '', durationMin: DURATION.initial, from: today, date: today, note: '',
});

/** Decided 5: the series as it is, from its next class date (today without one). */
export const formFromRow = (row: ProgramRow, today: string): ProgramForm => ({
  ...newProgramForm(today), freq: row.freq, weekOfMonth: row.weekOfMonth ?? 'first', days: [...row.days], startTime: row.startTime, durationMin: row.durationMin, from: row.nextDate ?? today,
});

export const programFormError = (f: ProgramForm): string | null => (f.repeat && f.days.length === 0 ? SCHEDULE_ERRORS.noDays : null);
const ordered = (days: DayKey[]): DayKey[] => DAY_ORDER.filter((d) => days.includes(d));

export const changeBody = (f: ProgramForm) => ({
  freq: f.freq, weekOfMonth: f.freq === 'monthly' ? f.weekOfMonth : null, days: ordered(f.days), startTime: f.startTime, durationMin: f.durationMin, from: f.from,
});

export function programBody(f: ProgramForm): Record<string, unknown> {
  if (f.repeat) return { repeat: true, ...changeBody(f) };
  return { repeat: false, date: f.date, startTime: f.startTime, durationMin: f.durationMin, note: f.note.trim() || null };
}

export const programToast = (answer: { date: string | null }): string => (answer.date ? SCHEDULE_TOASTS.classAdded(answer.date) : SCHEDULE_TOASTS.programAdded);

/** Decided 4: the panel opens on the date's state; the e-mail box is always unticked (W7). */
export function dateFormOf(o: ChipSource): DateForm {
  const blank: DateForm = { mode: 'keep', newDate: o.date, newStartTime: o.startTime ?? '', reason: '', notify: false };
  if (o.status === 'override') return { ...blank, mode: 'move', reason: o.note ?? '' };
  if (o.status === 'cancelled' && !isBreak(o)) return { ...blank, mode: 'cancel', reason: o.note ?? '' };
  return blank;
}

export function dateBody(f: DateForm): Record<string, unknown> {
  const move = f.mode === 'move';
  const changes = f.mode !== 'keep';
  return { mode: f.mode, newDate: move ? f.newDate : null, newStartTime: move ? f.newStartTime : null, reason: changes ? f.reason.trim() || null : null, notifyParents: changes && f.notify };
}

export function dateToast(mode: DateMode, date: string): string {
  if (mode === 'cancel') return SCHEDULE_TOASTS.dateCancelled(date);
  return mode === 'move' ? SCHEDULE_TOASTS.dateMoved(date) : SCHEDULE_TOASTS.dateKept(date);
}
