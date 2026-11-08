import { isIsoDate } from '../groups/dates';
import { isMonth, monthRange } from '../presence/dates';
import type { PeriodView } from '../presence/period';

export const PREZENTA_PATH = '/plugins/edusport-prezenta';
export const ABONAMENTE_PATH = '/plugins/edusport-abonamente';
export const PLATI_PATH = '/plugins/edusport-plati';
export const DE_INCASAT_PATH = '/plugins/edusport-de-incasat';
export const COACH_SEGMENT = 'antrenor';

export type PrezentaShow = 'grupe' | 'lectii' | 'antrenori';
export type PrezentaLayout = 'lista' | 'grila';
export type PrezentaQuery = { view: PeriodView; date: string; show: PrezentaShow; layout: PrezentaLayout };

const VIEWS: readonly PeriodView[] = ['zi', 'saptamana', 'luna'];
const SHOWS: readonly PrezentaShow[] = ['grupe', 'lectii', 'antrenori'];
/** Old `tab` values (before phase 11) and the list they now open. */
const OLD_TABS: Record<string, PrezentaShow> = { sedinte: 'grupe', lectii: 'lectii', antrenori: 'antrenori' };

const validDate = (v: string | null): string | null => (v !== null && isIsoDate(v) ? v : null);

/** The address of the screen (S39): defaults Săptămână, today, Grupe, Listă. Old `tab`, `month` and `date` addresses still open (as Lună). */
export function readPrezentaQuery(search: string, today: string): PrezentaQuery {
  const params = new URLSearchParams(search);
  const oldTab = OLD_TABS[params.get('tab') ?? ''];
  const month = params.get('month');
  const monthStart = month !== null && isMonth(month) ? monthRange(month).from : null;
  if (oldTab && !params.get('view')) {
    return { view: 'luna', date: validDate(params.get('date')) ?? monthStart ?? today, show: oldTab, layout: 'lista' };
  }
  const view = VIEWS.find((v) => v === params.get('view')) ?? 'saptamana';
  const show = SHOWS.find((v) => v === params.get('show')) ?? 'grupe';
  const wantsGrid = params.get('layout') === 'grila';
  const layout: PrezentaLayout = wantsGrid && show === 'grupe' && view !== 'zi' ? 'grila' : 'lista';
  return { view, date: validDate(params.get('date')) ?? monthStart ?? today, show, layout };
}

export function prezentaTo(q: Partial<PrezentaQuery>): string {
  const pairs = (['view', 'date', 'show', 'layout'] as const).filter((k) => q[k] !== undefined).map((k) => `${k}=${q[k]}`);
  return pairs.length > 0 ? `${PREZENTA_PATH}?${pairs.join('&')}` : PREZENTA_PATH;
}

/** The coach page (11-2) for a team member, opened on a period. */
export const coachPageTo = (teamMemberId: string, view: PeriodView, date: string): string =>
  `${PREZENTA_PATH}/${COACH_SEGMENT}/${encodeURIComponent(teamMemberId)}?view=${view}&date=${date}`;

/** The team member id of `antrenor/<id>` in the Prezență route splat; null for the screen itself or an address that is not a coach page. */
export function coachIdFromSplat(splat: string | undefined): string | null {
  const [segment, id] = (splat ?? '').split('/');
  if (segment !== COACH_SEGMENT || !id?.trim()) return null;
  try {
    return decodeURIComponent(id);
  } catch {
    return null;
  }
}
