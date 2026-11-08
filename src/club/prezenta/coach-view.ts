import { capitalized, isIsoDate, weekdayName } from '../groups/dates';
import { shortDay } from '../presence/copy/attendance';
import type { PeriodView } from '../presence/period';
import { COACH_SEGMENT, PREZENTA_PATH, prezentaTo } from './routes';

export { durationText } from './day-view';

export type CoachShow = 'ore' | 'sedinte' | 'lectii';
const VIEWS: readonly PeriodView[] = ['zi', 'saptamana', 'luna'];
const SHOWS: readonly CoachShow[] = ['ore', 'sedinte', 'lectii'];
const APP_PATH = '/plugins/edusport-';

/** The coach page address (S45, S46): view Lună, list Ședințe unless the address says otherwise. */
export function readCoachQuery(search: string, today: string): { view: PeriodView; date: string; show: CoachShow } {
  const params = new URLSearchParams(search);
  const date = params.get('date');
  return {
    view: VIEWS.find((v) => v === params.get('view')) ?? 'luna',
    date: date !== null && isIsoDate(date) ? date : today,
    show: SHOWS.find((s) => s === params.get('show')) ?? 'sedinte',
  };
}

/** "Mie 4 noi"; "Lun 29 dec 2025" outside the current year. */
export function coachRowDate(date: string, today: string): string {
  const year = date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${date.slice(0, 4)}`;
  return `${capitalized(weekdayName(date)).slice(0, 3)} ${shortDay(date)}${year}`;
}

/** Back goes to the page the admin came from when it is one of ours, else Prezență with Antrenori. */
export function backTarget(state: unknown): string {
  const from = typeof state === 'object' && state !== null ? (state as { from?: unknown }).from : undefined;
  return typeof from === 'string' && from.startsWith(APP_PATH) ? from : prezentaTo({ show: 'antrenori' });
}

/** The coach page with its whole address: `?view=&date=&show=`. */
export const coachPageAddress = (coachId: string, q: { view: PeriodView; date: string; show: CoachShow }): string =>
  `${PREZENTA_PATH}/${COACH_SEGMENT}/${encodeURIComponent(coachId)}?view=${q.view}&date=${q.date}&show=${q.show}`;
