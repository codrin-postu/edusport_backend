import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH } from '../prezenta/routes';
import { contabTo } from '../contabilitate/routes';
import { isMonth, monthOf } from '../presence/dates';
import { SPORTIVI_PATH } from '../sportivi/routes';

export { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH };

export type AthleteTab = 'abonament' | 'plati';

/** The athlete record opened on its "Grupe și abonament" or "Plăți" tab (spec 5.1). */
export const athleteTabTo = (athleteId: string, tab: AthleteTab): string => `${SPORTIVI_PATH}/${encodeURIComponent(athleteId)}?tab=${tab}`;

export const BANI_PATH = '/plugins/edusport-bani';
export type BaniView = 'prezentare' | 'contabilitate';
export type BaniQuery = { view: BaniView; month: string };

/** The address of the Bani page: default Prezentare and the current month; a month after today's is the current one. */
export function readBaniQuery(search: string, today: string): BaniQuery {
  const params = new URLSearchParams(search);
  const current = monthOf(today);
  const month = params.get('month');
  return {
    view: params.get('view') === 'contabilitate' ? 'contabilitate' : 'prezentare',
    month: isMonth(month) && month <= current ? month : current,
  };
}

export function baniTo(q: Partial<BaniQuery>): string {
  const pairs = (['view', 'month'] as const).filter((k) => q[k] !== undefined).map((k) => `${k}=${q[k]}`);
  return pairs.length > 0 ? `${BANI_PATH}?${pairs.join('&')}` : BANI_PATH;
}

/** The card links: the page they open shows the same numbers. */
export const platiMonthTo = (month: string): string => contabTo({ tab: 'plati', month });
export const deIncasatMonthTo = (month: string): string => contabTo({ tab: 'restante', month });
export const abonamenteStateTo = (state: 'active' | 'expira14'): string => contabTo({ tab: 'abonamente', params: { state } });
