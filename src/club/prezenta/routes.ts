import { isMonth, monthOf } from '../presence/dates';
import { isIsoDate } from '../groups/dates';

export const PREZENTA_PATH = '/plugins/edusport-prezenta';
export const ABONAMENTE_PATH = '/plugins/edusport-abonamente';
export const PLATI_PATH = '/plugins/edusport-plati';
export const DE_INCASAT_PATH = '/plugins/edusport-de-incasat';

export type PrezentaTab = 'sedinte' | 'lectii' | 'antrenori';
export type PrezentaQuery = { tab: PrezentaTab; date: string; month: string };

const TABS: readonly PrezentaTab[] = ['sedinte', 'lectii', 'antrenori'];

export function readPrezentaQuery(search: string, today: string): PrezentaQuery {
  const params = new URLSearchParams(search);
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'sedinte';
  const rawDate = params.get('date');
  const date = rawDate !== null && isIsoDate(rawDate) ? rawDate : today;
  const rawMonth = params.get('month');
  const month = rawMonth !== null && isMonth(rawMonth) ? rawMonth : monthOf(date);
  return { tab, date, month };
}

export function prezentaTo(q: Partial<PrezentaQuery>): string {
  const pairs = (['tab', 'date', 'month'] as const).filter((k) => q[k] !== undefined).map((k) => `${k}=${q[k]}`);
  return pairs.length > 0 ? `${PREZENTA_PATH}?${pairs.join('&')}` : PREZENTA_PATH;
}
