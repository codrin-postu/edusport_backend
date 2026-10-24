import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AdminPrices } from '../../../club/price-admin';

/** Admin API of this page: src/api/club/routes/03-admin-prices-seasons.ts. */
export const PRICES_API = '/api/club/prices';
export const LISTS_API = '/api/club/price-lists';
export const SECTIONS_API = '/api/club/sections';

export type PricesClient = ReturnType<typeof useFetchClient>;
/** Every Prețuri action answers with the whole page data. */
export type PricesAnswer = Promise<{ data: { data: AdminPrices } }>;

export interface PricesState {
  data: AdminPrices | null;
  error: boolean;
  /** Runs one request and replaces the page data with its answer. Throws the server's message. */
  mutate: (run: (client: PricesClient) => PricesAnswer) => Promise<void>;
}

/** Loads the Prețuri page data once; every action answers with fresh data. */
export function usePrices(): PricesState {
  const client = useFetchClient();
  const clientRef = React.useRef(client);
  clientRef.current = client;
  const [data, setData] = React.useState<AdminPrices | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let off = false;
    clientRef.current
      .get<{ data: AdminPrices }>(PRICES_API)
      .then((r) => !off && setData(r.data.data))
      .catch(() => !off && setError(true));
    return () => {
      off = true;
    };
  }, []);

  const mutate = React.useCallback(async (run: (c: PricesClient) => PricesAnswer) => {
    const r = await run(clientRef.current);
    setData(r.data.data);
  }, []);

  return { data, error, mutate };
}
