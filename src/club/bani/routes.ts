import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH } from '../prezenta/routes';
import { SPORTIVI_PATH } from '../sportivi/routes';

export { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH };

export type AthleteTab = 'abonament' | 'plati';
export type MoneyQuery = { month: string | null; state: string | null; group: string | null; method: string | null; purpose: string | null };

/** The athlete record opened on its "Grupe și abonament" or "Plăți" tab (spec 5.1). */
export const athleteTabTo = (athleteId: string, tab: AthleteTab): string => `${SPORTIVI_PATH}/${encodeURIComponent(athleteId)}?tab=${tab}`;

/** The filters of the money screens, as the address carries them; absent means null. */
export function readMoneyQuery(search: string): MoneyQuery {
  const params = new URLSearchParams(search);
  const get = (key: string): string | null => params.get(key) || null;
  return { month: get('month'), state: get('state'), group: get('group'), method: get('method'), purpose: get('purpose') };
}
