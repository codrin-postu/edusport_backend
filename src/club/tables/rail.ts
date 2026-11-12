import { TABLES_COPY } from './copy';
import type { SavedViewRow } from './types';

export type RailGroup = { key: 'gata' | 'mele' | 'colegi'; title: string; views: SavedViewRow[] };

/**
 * The saved-tables rail: ready-made views (those not marked `listed: false`), the caller's own and the colleagues'.
 * `mine` is already per caller (the views API sets it from the current admin), so no admin id is needed here.
 * The colleagues' group is left out when empty.
 */
export function railGroups(views: SavedViewRow[]): RailGroup[] {
  const own = views.filter((v) => !v.readyMade);
  const groups: RailGroup[] = [
    { key: 'gata', title: TABLES_COPY.rail.gata, views: views.filter((v) => v.readyMade && v.listed !== false) },
    { key: 'mele', title: TABLES_COPY.rail.mele, views: own.filter((v) => v.mine) },
    { key: 'colegi', title: TABLES_COPY.rail.colegi, views: own.filter((v) => !v.mine) },
  ];
  return groups.filter((g) => g.key !== 'colegi' || g.views.length > 0);
}

export type RailMenuKey = 'rename' | 'duplicate' | 'remove';

/** The "..." menu of a rail row: system views have none; own views rename, duplicate and delete; a colleague's view only duplicates, and deletes when the server lets the caller (`canDelete`). */
export function railMenuKeys(view: SavedViewRow): RailMenuKey[] {
  if (view.readyMade) return [];
  if (view.broken) return view.canDelete ? ['remove'] : [];
  const keys: RailMenuKey[] = view.mine ? ['rename', 'duplicate'] : view.canDelete ? ['duplicate'] : [];
  if (view.canDelete) keys.push('remove');
  return keys;
}
