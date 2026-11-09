import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { createSecurityApi, type SecurityApi } from './client';

/** The Securitate API over Strapi's fetch client. Same identity on every render (useFetchClient returns new functions each time). */
export function useSecurityApi(): SecurityApi {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(
    () =>
      createSecurityApi({
        get: (url) => ref.current.get(url),
        post: (url, data) => ref.current.post(url, data),
        del: (url) => ref.current.del(url),
      }),
    [],
  );
}
