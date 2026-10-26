import * as React from 'react';
import { getFetchClient, useFetchClient } from '@strapi/admin/strapi-admin';

type Client = ReturnType<typeof useFetchClient>;
type Answer = Promise<{ data: unknown }>;

export type StableClient = {
  get: (url: string, config?: Parameters<Client['get']>[1]) => Answer;
  post: (url: string, data?: unknown, config?: Parameters<Client['post']>[2]) => Answer;
  put: (url: string, data?: unknown, config?: Parameters<Client['put']>[2]) => Answer;
  del: (url: string, config?: Parameters<Client['del']>[1]) => Answer;
};

/**
 * The admin fetch client with stable function identities (useFetchClient returns new ones on every render,
 * which would re-run every effect that depends on them; SubmissionTable.tsx does the same with refs).
 */
export function useStableClient(): StableClient {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo<StableClient>(
    () => ({
      get: (url, config) => ref.current.get(url, config),
      post: (url, data, config) => ref.current.post(url, data, config),
      put: (url, data, config) => ref.current.put(url, data, config),
      del: (url, config) => ref.current.del(url, config),
    }),
    [],
  );
}

/**
 * Writes not tied to a component's life: Strapi's useFetchClient aborts its requests on unmount, so a row
 * switch or a closed window would report a write the server made as failed and skip the list reload.
 */
export const detachedClient: Pick<StableClient, 'post' | 'put'> = {
  post: (url, data, config) => getFetchClient().post(url, data, config),
  put: (url, data, config) => getFetchClient().put(url, data, config),
};

/** `data` of a `{ data }` answer (plan 3-2 conventions). */
export const dataOf = <T>(res: { data: unknown }): T => (res.data as { data: T }).data;
