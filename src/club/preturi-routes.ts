import type { AdminPriceList } from './price-admin';

/** Admin route of Prețuri; `PRETURI_TO` (admin/pages/routes.ts) is this same value. */
export const PRETURI_PATH = '/plugins/edusport-preturi';

/** Prețuri address that scrolls to one price list (`?lista=<documentId>`). Pure: the admin bundle and the tests import it. */
export const preturiTo = (listId: string): string => `${PRETURI_PATH}?lista=${encodeURIComponent(listId)}`;

export function readPreturiQuery(search: string): { lista: string | null } {
  return { lista: new URLSearchParams(search).get('lista')?.trim() || null };
}

/** The section tab holding the list; null for no list or an unknown one. */
export const sectionOfList = (lists: AdminPriceList[], listId: string | null): string | null =>
  (listId ? lists.find((l) => l.documentId === listId)?.sectionId : null) ?? null;
