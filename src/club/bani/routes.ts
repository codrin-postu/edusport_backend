import { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH } from '../prezenta/routes';
import { SPORTIVI_PATH } from '../sportivi/routes';

export { ABONAMENTE_PATH, DE_INCASAT_PATH, PLATI_PATH };

export type AthleteTab = 'abonament' | 'plati';

/** The athlete record opened on its "Grupe și abonament" or "Plăți" tab (spec 5.1). */
export const athleteTabTo = (athleteId: string, tab: AthleteTab): string => `${SPORTIVI_PATH}/${encodeURIComponent(athleteId)}?tab=${tab}`;

export const BANI_PATH = '/plugins/edusport-bani';
