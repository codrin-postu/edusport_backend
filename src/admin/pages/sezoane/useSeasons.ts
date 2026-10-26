import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AdminSeason, SeasonFields } from '../../../club/season-admin';

/** Admin API of this page: src/api/club/routes/03-admin-prices-seasons.ts. */
export const SEASONS_API = '/api/club/seasons';

export interface SeasonsState {
  seasons: AdminSeason[] | null;
  error: boolean;
  /** Creates (no documentId) or updates a season; the answer replaces the table. Throws the server's message. */
  save: (documentId: string | null, fields: SeasonFields) => Promise<void>;
}

export function useSeasons(): SeasonsState {
  const client = useFetchClient();
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const [seasons, setSeasons] = React.useState<AdminSeason[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    clientRef.current
      .get<{ data: AdminSeason[] }>(SEASONS_API)
      .then((r) => !off && setSeasons(r.data.data))
      .catch(() => !off && setError(true));
    return () => {
      off = true;
    };
  }, []);

  const save = React.useCallback(async (documentId: string | null, fields: SeasonFields) => {
    const c = clientRef.current;
    const r = documentId
      ? await c.put<{ data: AdminSeason[] }>(`${SEASONS_API}/${documentId}`, fields)
      : await c.post<{ data: AdminSeason[] }>(SEASONS_API, fields);
    setSeasons(r.data.data);
  }, []);

  return { seasons, error, save };
}
