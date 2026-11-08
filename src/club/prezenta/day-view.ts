import { SESSION_STATE_WORDS } from '../presence/copy/core';
import { EXISTING_SESSION, shortDay } from '../presence/copy/attendance';
import { longDate } from '../presence/dates';
import { capitalized, weekdayName, addDays as addGroupDays } from '../groups/dates';
import type { DayRow, LessonListRow, SavedOnDay } from '../presence/attendance/api-types';
import type { SessionState } from '../presence/types';

export const addDays = (date: string, n: number): string => addGroupDays(date, n);

/** "Marți, 27 oct 2026" */
export const dayLine = (date: string): string => `${capitalized(weekdayName(date))}, ${longDate(date)}`;

/** "Azi, marți 27 oct" or "Luni, 26 oct" */
export const dayTitle = (date: string, today: string): string =>
  date === today ? `Azi, ${weekdayName(date)} ${shortDay(date)}` : `${capitalized(weekdayName(date))}, ${shortDay(date)}`;

/** "Marți 27 oct 2026" */
export const longDayTitle = (date: string): string => `${capitalized(weekdayName(date))} ${longDate(date)}`;

export const countText = (x: number, y: number): string => `${x} din ${y}`;

export const footerText = (x: number, y: number): string => `${countText(x, y)} prezenți`;

export const undoneTitle = (n: number): string => `Nefăcute din zilele trecute (${n})`;

export const visitorsText = (n: number): string => `Din alte grupe: ${n}`;

export const durationText = (min: number): string => `${min} min`;

export const panelTitleSuffix = (time: string): string => `, ${time}`;

export const panelTitle = (groupName: string, time: string): string => `${groupName}${panelTitleSuffix(time)}`;

export const lessonTitle = (time: string): string => `Lecție individuală, ${time}`;

export const stateWord = (s: SessionState | null): string => (s === null ? '' : SESSION_STATE_WORDS[s]);

const joinParts = (parts: string[]): string => parts.filter((p) => p !== '').join(', ');

/** The count is shown for every session, an unsaved one reads "0 din N" (approved mockup, option A). */
export function sessionCard(r: DayRow): { title: string; line: string } {
  return { title: `${r.startTime} ${r.groupName}`, line: joinParts([r.coachNames.join(', '), countText(r.present, r.listed), stateWord(r.state)]) };
}

export function lessonCard(r: LessonListRow): { title: string; line: string } {
  return { title: `${r.startTime} ${r.athleteName}`, line: joinParts([r.coachNames.join(', '), durationText(r.durationMin), stateWord(r.state)]) };
}

export const existingLine = (s: SavedOnDay): string =>
  `${s.startTime}, ${countText(s.present, s.listed)}, ${EXISTING_SESSION.savedBy(s.savedBy)}`;
