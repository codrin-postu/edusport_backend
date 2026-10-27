import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { inactiveShown, listQueryString, showInactive, withPage } from '../../../club/sportivi/list-view';
import { selectionOn, toggled, toggledAll, withoutIds } from '../../../club/sportivi/personal-data-view';
import { SPORTIVI_PATH, wantsInactiveList } from '../../../club/sportivi/routes';
import type { AthleteList } from './useAthleteList';

export type Selection = { ids: ReadonlySet<string>; toggle: (id: string) => void; toggleAll: (rowIds: string[]) => void; done: (doneIds: string[]) => void };

/** Ticked rows of the inactivity list (3C spec 5); null when no checkboxes show. Cleared whenever the list changes (not on "Încarcă încă 30"). */
export function useSelection(list: AthleteList, superAdmin: boolean): Selection | null {
  const [ids, setIds] = React.useState<ReadonlySet<string>>(new Set());
  const key = listQueryString(withPage(list.state, 1), 0);
  React.useEffect(() => setIds(new Set()), [key]);
  const { reload } = list;
  const done = React.useCallback((doneIds: string[]) => {
    setIds((s) => withoutIds(s, doneIds));
    reload();
  }, [reload]);
  if (!selectionOn(inactiveShown(list.state), superAdmin)) return null;
  return { ids, toggle: (id) => setIds((s) => toggled(s, id)), toggleAll: (rowIds) => setIds((s) => toggledAll(s, rowIds)), done };
}

/** The dashboard's "Vezi lista" (`?inactivi=1`): only "Inactivi de peste N ani", then the plain address. */
export function useInactiveLink(list: AthleteList, search: string): void {
  const navigate = useNavigate();
  const { state, setState } = list;
  React.useEffect(() => {
    if (!wantsInactiveList(search)) return;
    setState(showInactive(state));
    navigate(SPORTIVI_PATH, { replace: true });
  }, [search, state, setState, navigate]);
}
