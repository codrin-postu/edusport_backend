import * as React from 'react';
import type { HistoryLine, RegistrationMatchView } from '../../../club/athletes/api-types';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { dataOf, useStableClient } from './useClient';

export type PanelData = { match: RegistrationMatchView | null; history: HistoryLine[] | null; failed: boolean };

const EMPTY: PanelData = { match: null, history: null, failed: false };

/** The match card and window start (plan 3-2 GET .../match) and the Istoric lines; reloaded when `version` changes. */
export function usePanelData(documentId: string, version: string): PanelData {
  const { get } = useStableClient();
  const [data, setData] = React.useState<PanelData>(EMPTY);
  React.useEffect(() => {
    let off = false;
    Promise.all([get(CLUB_URLS.match(documentId)), get(CLUB_URLS.history(documentId))])
      .then(([match, history]) => {
        if (!off) setData({ match: dataOf<RegistrationMatchView>(match), history: dataOf<HistoryLine[]>(history), failed: false });
      })
      .catch(() => {
        if (!off) setData({ ...EMPTY, failed: true });
      });
    return () => {
      off = true;
    };
  }, [get, documentId, version]);
  return data;
}
