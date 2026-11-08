import { parseReceiptNo } from '../codes';
import { listPurposeText } from '../presence/payments/rules';
import { monthRange } from '../presence/dates';
import { sumMoney } from '../presence/money';
import type { PaymentMethod, PaymentRow } from '../presence/types';
import type { MoneySources } from './sources';

/** What the accounting list reads: the month's payments (by `paidOn`), athlete names, abonamente and seasons for the purpose text (F4). */
export type AccountingSources = Pick<MoneySources, 'payments' | 'athletes' | 'subscriptions' | 'seasons'>;

export type AccountingPayment = {
  paymentId: string; athleteId: string; paidOn: string; receiptNo: string | null; athleteName: string; purposeText: string; method: PaymentMethod; amount: number; cancelled: boolean;
};
/** Sums of the non-cancelled payments by method; `cancelled` is the sum of the cancelled ones. */
export type Accounting = { byMethod: Record<PaymentMethod | 'cancelled', number>; payments: AccountingPayment[] };

/** Same day: payments without a number first (by `recordedAt`), then by year and sequence, never as text ("2026-9999" before "2026-10000"). */
function byDayThenNumber(a: PaymentRow, b: PaymentRow): number {
  const day = a.paidOn.localeCompare(b.paidOn);
  if (day !== 0) return day;
  const x = parseReceiptNo(a.receiptNo);
  const y = parseReceiptNo(b.receiptNo);
  if (x === null && y !== null) return -1;
  if (x !== null && y === null) return 1;
  const number = x !== null && y !== null ? x.year - y.year || x.seq - y.seq : 0;
  return number || a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id);
}

/** The payments with `paidOn` in the month, cancelled ones included and marked (5.6.3). */
export function accounting(src: AccountingSources, month: string): Accounting {
  const { from, to } = monthRange(month);
  const names = new Map(src.athletes.map((a) => [a.id, a.name ?? ''] as const));
  const subs = new Map(src.subscriptions.map((s) => [s.id, s] as const));
  const seasons = new Map(src.seasons.map((s) => [s.id, s.label] as const));
  const rows = src.payments.filter((p) => from <= p.paidOn && p.paidOn <= to).sort(byDayThenNumber);
  const sumOf = (pick: (p: PaymentRow) => boolean): number => sumMoney(rows.filter(pick).map((p) => p.amount));
  return {
    byMethod: {
      numerar: sumOf((p) => !p.cancelled && p.method === 'numerar'), card: sumOf((p) => !p.cancelled && p.method === 'card'),
      transfer: sumOf((p) => !p.cancelled && p.method === 'transfer'), cancelled: sumOf((p) => p.cancelled),
    },
    payments: rows.map((p) => {
      const sub = p.subscriptionId === null ? undefined : subs.get(p.subscriptionId);
      return {
        paymentId: p.id, athleteId: p.athleteId, paidOn: p.paidOn, receiptNo: p.receiptNo, athleteName: names.get(p.athleteId) ?? '', method: p.method, amount: p.amount, cancelled: p.cancelled,
        purposeText: listPurposeText(p, { itemName: sub?.itemName ?? null, startsOn: sub?.startsOn ?? null, code: sub?.code ?? null, seasonLabel: seasons.get(p.seasonId) ?? null }),
      };
    }),
  };
}
