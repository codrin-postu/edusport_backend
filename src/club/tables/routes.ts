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

export const TABELE_PATH = '/plugins/edusport-tabele';

/** The Tabele page, on a view when given. */
export const tablesTo = (viewId: string | null): string => `${TABELE_PATH}${viewId ? `?v=${encodeURIComponent(viewId)}` : ''}`;

/** `?v=<id>`: the view the Tabele page opens on. */
export function readTabeleQuery(search: string): { viewId: string | null } {
  const id = (new URLSearchParams(search).get('v') ?? '').trim();
  return { viewId: id || null };
}

/** The old Sportivi "Tabele" tab address (`vedere=tabele&v=x`) -> the Tabele page; null for anything else. */
export function oldTablesRedirect(search: string): string | null {
  const { tab, viewId } = readTablesQuery(search);
  return tab === 'tabele' ? tablesTo(viewId) : null;
}
