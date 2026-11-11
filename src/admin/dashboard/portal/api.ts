import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { AccountAnswer, AccountBlock } from '../../../club/portal/accounts/api-types';
import { longDate } from '../../../club/presence/dates';
import { requestErrorText } from '../../../club/registration-panel';

const BASE = '/api/club';
const enc = encodeURIComponent;
type Wrapped<T> = { data: { data: T } };

/** The admin's short date, "6 nov 2026". */
export const accountDate = (since: string | null): string => (since ? longDate(since) : '');
export const accountErrorText = (err: unknown, fallback: string): string => requestErrorText(err, fallback);

/** The account admin routes (routes/12-portal-accounts.ts). Same identity on every render. */
export function usePortalAccountApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const data = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as Wrapped<T>).data.data;
    const account = (id: string) => `${BASE}/portal-accounts/${enc(id)}`;
    return {
      read: (teamMemberId: string) => data<AccountBlock>(ref.current.get(`${BASE}/team-members/${enc(teamMemberId)}/account`)),
      invite: (teamMemberId: string, email: string) => data<AccountAnswer>(ref.current.post(`${BASE}/team-members/${enc(teamMemberId)}/account/invite`, { email })),
      resend: (id: string) => data<AccountAnswer>(ref.current.post(`${account(id)}/resend`, {})),
      disable: (id: string) => data<AccountAnswer>(ref.current.post(`${account(id)}/disable`, {})),
      disableAll: (id: string) => data<AccountAnswer>(ref.current.post(`${account(id)}/disable-all`, {})),
      enable: (id: string) => data<AccountAnswer>(ref.current.post(`${account(id)}/enable`, {})),
      changeEmail: (id: string, email: string) => data<AccountAnswer>(ref.current.post(`${account(id)}/email`, { email })),
    };
  }, []);
}

export type PortalAccountApi = ReturnType<typeof usePortalAccountApi>;
