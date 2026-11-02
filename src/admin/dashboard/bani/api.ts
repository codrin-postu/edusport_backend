import * as React from 'react';
import { getFetchClient, useFetchClient } from '@strapi/admin/strapi-admin';
import type { ActionBody } from '../../../club/groups/api-types';
import type { AthleteMonthRow } from '../../../club/presence/attendance/api-types';
import type {
  AthletePayments, AthleteSubscriptions, DuePage, PaymentList, PaymentQuery, SubscriptionListPage, SubscriptionQuery,
} from '../../../club/presence/money-api';
import type { PaymentOption } from '../../../club/presence/payments/rules';
import type { AddSubscriptionResult, NewSubscriptionForm } from '../../../club/presence/subscriptions/add';
import type { PaymentResult } from '../../../club/presence/payments/record';

const BASE = '/api/club';
const enc = encodeURIComponent;
type Body = Record<string, unknown>;
type Wrapped<T> = { data: { data: T } };

function query(values: Record<string, string | null>): string {
  const s = new URLSearchParams(Object.entries(values).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
}

/** The plan 5-3 admin routes (Abonamente, Plăți, De încasat), the attendance tab of plan 5-2 and the P3 athlete delete. Same identity on every render. */
export function useMoneyApi() {
  const client = useFetchClient();
  const ref = React.useRef(client);
  ref.current = client;
  return React.useMemo(() => {
    const data = async <T>(p: Promise<unknown>): Promise<T> => ((await p) as Wrapped<T>).data.data;
    const action = async <T>(p: Promise<unknown>): Promise<ActionBody<T>> => ((await p) as { data: ActionBody<T> }).data;
    const get = <T>(url: string) => data<T>(ref.current.get(url));
    const athlete = (id: string) => `${BASE}/athletes/${enc(id)}`;
    const payment = (id: string) => `${BASE}/payments/${enc(id)}`;
    return {
      subscriptions: (q: SubscriptionQuery) => get<SubscriptionListPage>(`${BASE}/subscriptions${query({ state: q.state, group: q.groupId })}`),
      extendPreview: () => get<{ count: number; key: string }>(`${BASE}/subscriptions/extend/preview`),
      extend: (weeks: number, key: string) => action<{ count: number; weeks: number }>(ref.current.post(`${BASE}/subscriptions/extend`, { weeks, key })),
      cancelSubscription: (id: string) => action<{ cancelled: true }>(ref.current.post(`${BASE}/subscriptions/${enc(id)}/cancel`, {})),
      subscriptionForm: (athleteId: string, startsOn: string | null) => get<NewSubscriptionForm>(`${athlete(athleteId)}/subscriptions/new${query({ startsOn })}`),
      athleteSubscriptions: (athleteId: string, season: string | null) => get<AthleteSubscriptions>(`${athlete(athleteId)}/subscriptions${query({ season })}`),
      addSubscription: (athleteId: string, body: Body) => action<AddSubscriptionResult>(ref.current.post(`${athlete(athleteId)}/subscriptions`, body)),
      payments: (q: PaymentQuery) => get<PaymentList>(`${BASE}/payments${query({ month: q.month, method: q.method, purpose: q.purpose })}`),
      recordPayment: (body: Body) => action<PaymentResult>(ref.current.post(`${BASE}/payments`, body)),
      editPayment: (id: string, body: Body) => action<{ changed: boolean }>(ref.current.put(payment(id), body)),
      cancelPayment: (id: string) => action<{ cancelled: true }>(ref.current.post(`${payment(id)}/cancel`, {})),
      paymentOptions: (athleteId: string) => get<PaymentOption[]>(`${athlete(athleteId)}/payments/options`),
      athletePayments: (athleteId: string) => get<AthletePayments>(`${athlete(athleteId)}/payments`),
      due: (month: string) => get<DuePage>(`${BASE}/due${query({ month })}`),
      athleteAttendance: (athleteId: string, month: string) => get<AthleteMonthRow[]>(`${athlete(athleteId)}/attendance${query({ month })}`),
      remove: async (athleteId: string) => { await ref.current.del(athlete(athleteId)); },
      undo: (actionId: string) => data<{ undone: true }>(getFetchClient().post(`${BASE}/undo`, { actionId })),
    };
  }, []);
}

export type MoneyApi = ReturnType<typeof useMoneyApi>;
