import { shortDate } from './dates';
import type { DayKey, Freq } from './types';

/** Program texts (5.2 list column, 6.3 "Program obișnuit", 3.7 history). Pure. */
export const DAY_ORDER: readonly DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_SHORT: Readonly<Record<DayKey, string>> = { mon: 'Lu', tue: 'Ma', wed: 'Mi', thu: 'Jo', fri: 'Vi', sat: 'Sâ', sun: 'Du' };
/** `getUTCDay()` index to DayKey. */
export const DAY_OF_INDEX: readonly DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type SeriesText = { freq: Freq; days: readonly DayKey[]; startTime: string; durationMin: number; from: string; to?: string };

const ordered = (days: readonly DayKey[]): string[] => DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]);
const FREQ_SUFFIX: Readonly<Record<Freq, string>> = { none: '', weekly: '', biweekly: ', la 2 săptămâni', monthly: ', lunar' };

/** "Sâ, Du" */
export const daysList = (days: readonly DayKey[]): string => ordered(days).join(', ');

/** "Sâ și Du", "Lu, Mi și Vi" */
export function daysSpoken(days: readonly DayKey[]): string {
  const names = ordered(days);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} și ${names[names.length - 1]}`;
}

/** "Sâ, Du 10:00": start time only (5.2). */
export const listLine = (s: SeriesText): string => `${daysList(s.days)} ${s.startTime}`;
/** "Sâ și Du, 11:00, 50 min" and ", la 2 săptămâni" / ", lunar" (6.3). */
export const programLine = (s: SeriesText): string => `${daysSpoken(s.days)}, ${s.startTime}, ${s.durationMin} min${FREQ_SUFFIX[s.freq]}`;
/** "Sâ și Du, 11:00, 50 min, din 4 oct 2026" (3.7). */
export const programLineFrom = (s: SeriesText): string => `${programLine(s)}, din ${shortDate(s.from)}${s.to ? `, până pe ${shortDate(s.to)}` : ''}`;
