import * as React from 'react';
import type { AthleteListPage, AthleteListRow } from '../../../club/athletes/api-types';
import { INITIAL_LIST_STATE, PAGE_SIZE, listQueryString, type ListState } from '../../../club/sportivi/list-view';
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

export function useAthleteList(api: SportiviApi, phone: boolean): AthleteList {
  const [state, setRaw] = React.useState<ListState>(remembered);
  const [page, setPage] = React.useState<AthleteListPage | null>(null);
  const [rows, setRows] = React.useState<AthleteListRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const q = useDebounced(state.q, 300);
  const query = listQueryString({ ...state, q }, phone ? PAGE_SIZE.phone : PAGE_SIZE.desktop);
  const append = phone && state.page > 1;
  React.useEffect(() => {
    let off = false;
    setLoading(true);
    api.list(query)
      .then((p) => {
        if (off) return;
        setPage(p);
        setRows((prev) => (append ? [...prev, ...p.data] : p.data));
        setFailed(false);
      })
      .catch(() => { if (!off) setFailed(true); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [api, query, append]);
  const setState = React.useCallback((next: ListState) => {
    remembered = next;
    setRaw(next);
  }, []);
  return { state, setState, page, rows, loading, failed };
}
