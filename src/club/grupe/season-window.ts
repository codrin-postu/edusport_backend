import { clampDate } from '../groups/dates';

/** The dates a season label covers: 1 July of the first year to 30 June of the second (seasons never overlap, Oct-May inside). */
export type SeasonWindow = { start: string; end: string };

export function seasonWindow(label: string | null | undefined): SeasonWindow | null {
  const m = /^(\d{4})-(\d{4})$/.exec(label ?? '');
  return m ? { start: `${m[1]}-07-01`, end: `${m[2]}-06-30` } : null;
}

/** "2026-2027" for 2026-10-05 and for 2027-03-02. */
export function seasonLabelOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Past seasons are read-only (DECISIONS 504): the date belongs to a season older than the current one. */
export const isPastSeasonDate = (date: string, currentLabel: string | null): boolean => currentLabel !== null && seasonLabelOf(date) < currentLabel;

/** The group calendar opens today when the season is running, else on the nearest end of the season. */
export const calendarOpenDate = (today: string, win: SeasonWindow | null): string => (win ? clampDate(today, win.start, win.end) : today);

export const inSeasonWindow = (date: string, win: SeasonWindow | null): boolean => !win || (date >= win.start && date <= win.end);
