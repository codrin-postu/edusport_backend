import type { AdminArea } from '../admin-area';
import { SPORTIVI_PATH } from '../sportivi/routes';

/** The Sportivi "Tabele" tab belongs to the money area (personal data and amounts leave only through the money routes). */
export const TABLES_AREA: AdminArea = 'money';

export type TablesQuery = { tab: 'lista' | 'tabele'; viewId: string | null };

/** `?vedere=tabele&v=<id>` (S50): the Tabele tab, optionally on one view. Anything else is the list. */
export function readTablesQuery(search: string): TablesQuery {
  const params = new URLSearchParams(search);
  if (params.get('vedere') !== 'tabele') return { tab: 'lista', viewId: null };
  const id = (params.get('v') ?? '').trim();
  return { tab: 'tabele', viewId: id || null };
}

/** The Tabele tab, on a view when given. */
export const tablesTo = (viewId: string | null): string => `${SPORTIVI_PATH}?vedere=tabele${viewId ? `&v=${encodeURIComponent(viewId)}` : ''}`;
