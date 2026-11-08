import { isMonth, monthOf } from '../presence/dates';
import type { PresenceStore } from '../presence/store';
import { accounting, type Accounting } from './accounting';
import type { AccountingExtra } from './accounting-export';
import { moneyOverview } from './overview';
import { loadMoneySources } from './sources';
import type { MoneyOverview } from './types';

/** The `month` of a money request: YYYY-MM, not after the current month. Anything else is null (the route answers 400). */
export const readMoneyMonth = (value: unknown, today: string): string | null => (isMonth(value) && value <= monthOf(today) ? value : null);

export async function readOverview(store: PresenceStore, month: string, today: string): Promise<MoneyOverview> {
  return moneyOverview(await loadMoneySources(store, month), month, today);
}

/** The month's accounting list. */
export async function readAccounting(store: PresenceStore, month: string): Promise<Accounting> {
  return accounting(await loadMoneySources(store, month), month);
}

export type AccountingData = { accounting: Accounting; overview: MoneyOverview; extra: AccountingExtra };

/** The month's accounting list, the overview its sheets need, and per payment where it was collected and who recorded it (name, else e-mail). */
export async function readAccountingData(store: PresenceStore, month: string, today: string): Promise<AccountingData> {
  const src = await loadMoneySources(store, month);
  const list = accounting(src, month);
  const ids = new Set(list.payments.map((p) => p.paymentId));
  const inMonth = src.payments.filter((p) => ids.has(p.id));
  const names = await store.adminNames([...new Set(inMonth.map((p) => p.recordedBy))]);
  return {
    accounting: list,
    overview: moneyOverview(src, month, today),
    extra: {
      collectedAtRink: new Map(inMonth.map((p) => [p.id, p.collectedAtRink] as const)),
      recordedBy: new Map(inMonth.map((p) => [p.id, names[p.recordedBy] ?? p.recordedBy] as const)),
    },
  };
}
