import * as React from 'react';
import type { HistoryLine, RegistrationMatchView } from '../../../club/athletes/api-types';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { dataOf, useStableClient } from './useClient';

/** `failed`: the Istoric lines could not load; `matchFailed`: the match card could not load (both leave their value null). */
export type PanelData = { match: RegistrationMatchView | null; history: HistoryLine[] | null; failed: boolean; matchFailed: boolean };

type Loaded<T> = { value: T | null; failed: boolean };

const isMatch = (v: unknown): v is RegistrationMatchView => typeof v === 'object' && v !== null;
const isHistory = (v: unknown): v is HistoryLine[] => Array.isArray(v);

/** One GET of the panel, reloaded when `version` changes; an error or an answer of the wrong shape is `failed`. */
function useLoad<T>(url: string, version: string, valid: (v: unknown) => v is T): Loaded<T> {
  const { get } = useStableClient();
  const [state, setState] = React.useState<Loaded<T>>({ value: null, failed: false });
  React.useEffect(() => {
    let off = false;
    get(url)
      .then((res) => {
        const value = dataOf<unknown>(res);
        if (!off) setState(valid(value) ? { value, failed: false } : { value: null, failed: true });
      })
      .catch(() => {
        if (!off) setState({ value: null, failed: true });
      });
    return () => {
      off = true;
    };
  }, [get, url, version, valid]);
  return state;
}

/** The match card and window start (plan 3-2 GET .../match) and the Istoric lines, loaded independently. */
export function usePanelData(documentId: string, version: string): PanelData {
  const match = useLoad(CLUB_URLS.match(documentId), version, isMatch);
  const history = useLoad(CLUB_URLS.history(documentId), version, isHistory);
  return { match: match.value, history: history.value, failed: history.failed, matchFailed: match.failed };
}
