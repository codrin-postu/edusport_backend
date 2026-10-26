import * as React from 'react';
import type { AthleteListPage, AthleteListRow } from '../../../club/athletes/api-types';
import { listRequest, type LoadedPages } from '../../../club/sportivi/list-pages';
import { INITIAL_LIST_STATE, listQueryString, withPage, type ListState } from '../../../club/sportivi/list-view';
import type { SportiviApi } from './api';

/** Kept while the admin moves between the list and a record, so "Sportivi" brings the same view back. */
let remembered: ListState = INITIAL_LIST_STATE;

export type AthleteList = {
  state: ListState;
  setState: (next: ListState) => void;
  page: AthleteListPage | null;
  /** Phone: every card loaded so far; desktop reads `page.data`. */
  rows: AthleteListRow[];
  loading: boolean;
  failed: boolean;
};

function useDebounced(value: string, ms: number): string {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Loaded = Pick<AthleteList, 'page' | 'rows' | 'loading' | 'failed'>;

/**
 * Loads `wanted`; on phones appends a next page or reloads pages 1..N in one request (`listRequest`).
 * When `listRequest` starts a reload again at page 1, the state moves there first (no request), so
 * "Încarcă încă 30" follows on from it.
 */
function useListLoad(api: SportiviApi, wanted: ListState, phone: boolean, restart: () => void): Loaded {
  const [page, setPage] = React.useState<AthleteListPage | null>(null);
  const [rows, setRows] = React.useState<AthleteListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const loaded = React.useRef<LoadedPages | null>(null);
  const key = listQueryString(wanted, 0);
  React.useEffect(() => {
    const req = listRequest(wanted, phone, loaded.current);
    if (req.loaded.page !== wanted.page) {
      restart();
      return;
    }
    let off = false;
    setLoading(true);
    api.list(req.query)
      .then((p) => {
        if (off) return;
        loaded.current = req.loaded;
        setPage(p);
        setRows((prev) => (req.append ? [...prev, ...p.data] : p.data));
        setFailed(false);
      })
      .catch(() => { if (!off) setFailed(true); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [api, phone, key, restart]); // `key` stands for `wanted`, a new object on every render
  return { page, rows, loading, failed };
}

export function useAthleteList(api: SportiviApi, phone: boolean): AthleteList {
  const [state, setRaw] = React.useState<ListState>(remembered);
  const q = useDebounced(state.q, 300);
  const setState = React.useCallback((next: ListState) => {
    remembered = next;
    setRaw(next);
  }, []);
  const restart = React.useCallback(() => setState(withPage(remembered, 1)), [setState]);
  const loadedList = useListLoad(api, { ...state, q }, phone, restart);
  return { state, setState, ...loadedList };
}
