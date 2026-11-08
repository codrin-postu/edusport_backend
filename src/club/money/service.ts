import { isMonth, monthOf, monthRange } from '../presence/dates';
import type { PresenceStore } from '../presence/store';
import { accounting, type Accounting, type AccountingSources } from './accounting';
import type { AccountingExtra } from './accounting-export';
import { moneyOverview } from './overview';
import { loadMoneySources } from './sources';
import type { MoneyOverview } from './types';

/** The `month` of a money request: YYYY-MM, not after the current month. Anything else is null (the route answers 400). */
export const readMoneyMonth = (value: unknown, today: string): string | null => (isMonth(value) && value <= monthOf(today) ? value : null);

export async function readOverview(store: PresenceStore, month: string, today: string): Promise<MoneyOverview> {
  return moneyOverview(await loadMoneySources(store, month), month, today);
}

/** The month's payments with what the list needs, nothing else (F4). */
async function loadAccountingSources(store: PresenceStore, month: string): Promise<AccountingSources> {
  const [payments, athletes, subscriptions, seasons] = await Promise.all([store.payments(monthRange(month)), store.athletes(), store.subscriptions(), store.seasons()]);
  return { payments, athletes, subscriptions, seasons };
}

/** The month's accounting list. */
export async function readAccounting(store: PresenceStore, month: string): Promise<Accounting> {
  return accounting(await loadAccountingSources(store, month), month);
}

/** `overview` is read for the xlsx only (its sheets "Pe metodă" and "Pe grupă"); the CSV is the payments sheet alone. */
export type AccountingData = { accounting: Accounting; overview: MoneyOverview | null; extra: AccountingExtra };

/** The month's accounting list, per payment where it was collected and who recorded it (name, else e-mail), and for the xlsx the overview. */
export async function readAccountingData(store: PresenceStore, month: string, today: string, format: 'xlsx' | 'csv'): Promise<AccountingData> {
  const src = await loadAccountingSources(store, month);
  const list = accounting(src, month);
  const ids = new Set(list.payments.map((p) => p.paymentId));
  const inMonth = src.payments.filter((p) => ids.has(p.id));
  const names = await store.adminNames([...new Set(inMonth.map((p) => p.recordedBy))]);
  return {
    accounting: list,
    overview: format === 'xlsx' ? await readOverview(store, month, today) : null,
    extra: {
      collectedAtRink: new Map(inMonth.map((p) => [p.id, p.collectedAtRink] as const)),
      recordedBy: new Map(inMonth.map((p) => [p.id, names[p.recordedBy] ?? p.recordedBy] as const)),
    },
  };
}
