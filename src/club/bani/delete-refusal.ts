import type { AthletePayments, AthleteSubscriptionCards } from '../presence/money-api';

export type RefusalCounts = { payments: number; subscriptions: number };

/** What blocks "Șterge sportivul" (5.14, C37): every payment, cancelled ones too, and every abonament, current or earlier. */
export const refusalCounts = (payments: AthletePayments | null, subs: AthleteSubscriptionCards | null): RefusalCounts => ({
  payments: payments?.payments.length ?? 0,
  subscriptions: subs ? (subs.current ? 1 : 0) + subs.others.length : 0,
});

export const isBlocked = (c: RefusalCounts): boolean => c.payments > 0 || c.subscriptions > 0;

/** Only a Super Admin may anonymize (route guard, C67): others see neither the button nor the hint about it. */
export const anonymizeOffered = (isSuperAdmin: boolean): boolean => isSuperAdmin;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The counts of a 409 from DELETE (the Strapi admin FetchError: status at `err.status`, body at `err.response.data`), or null for any other failure. */
export function readRefusal(err: unknown): RefusalCounts | null {
  if (!isRecord(err) || err.status !== 409) return null;
  const data = isRecord(err.response) && isRecord(err.response.data) && isRecord(err.response.data.data) ? err.response.data.data : null;
  if (!data || typeof data.payments !== 'number' || typeof data.subscriptions !== 'number') return null;
  return { payments: data.payments, subscriptions: data.subscriptions };
}
