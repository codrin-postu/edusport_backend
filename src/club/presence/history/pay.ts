import type { HistoryPay, HistoryRow } from '../attendance/api-types';
import { HISTORY_DETAIL } from '../copy/prezenta-ui';
import { monthOf } from '../dates';
import type { ClubMonth } from '../due/settlement';
import { sumMoney } from '../money';
import type { AttendanceRow, LessonRow, PaymentRow } from '../types';

export type HistorySource = { kind: 'grup'; attendance: AttendanceRow } | { kind: 'individual'; lesson: LessonRow };
export type PayInput = {
  row: HistorySource;
  /** Place of a session in its abonament's use order, by session id (an athlete has one row per session). */
  subscriptionUnits: Map<string, number>;
  slots: Map<string, { slots: number; code: string | null }>;
  clubMonths: ClubMonth[];
  /** Sum of the non-cancelled `lectie` payments of each lesson. */
  lessonPaid: Map<string, number>;
};

/** What the non-cancelled `lectie` payments of each lesson add up to. */
export function lessonPaidMap(payments: readonly PaymentRow[]): Map<string, number> {
  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.cancelled || p.purpose !== 'lectie' || p.lessonId === null) continue;
    paid.set(p.lessonId, sumMoney([paid.get(p.lessonId) ?? 0, p.amount]));
  }
  return paid;
}

const lessonLeft = (lesson: LessonRow, i: PayInput): number => sumMoney([lesson.amount, -(i.lessonPaid.get(lesson.id) ?? 0)]);
const monthOfRow = (a: AttendanceRow, i: PayInput): ClubMonth | undefined => i.clubMonths.find((m) => m.month === monthOf(a.sessionDate));

function attendancePay(a: AttendanceRow, i: PayInput): HistoryPay {
  const sub = a.subscriptionId === null ? undefined : i.slots.get(a.subscriptionId);
  const unit = i.subscriptionUnits.get(a.sessionId);
  if (a.billing === 'slot' && sub !== undefined && unit !== undefined) return { kind: 'unit', unit, slots: sub.slots, code: sub.code };
  if (a.billing === 'club' || a.billing === 'inclus' || a.billing === 'fara_pret') return { kind: (monthOfRow(a, i)?.left ?? 1) <= 0 ? 'paid' : 'unpaid' };
  return { kind: 'unpaid' };
}

/** The "Plată" of one history row (4.3a). */
export function payOf(i: PayInput): HistoryRow['pay'] {
  return i.row.kind === 'individual' ? { kind: lessonLeft(i.row.lesson, i) <= 0 ? 'paid' : 'unpaid' } : attendancePay(i.row.attendance, i);
}

/** The one-line text under a "Plătit" / "Neplătit" row; null under a unit row. */
export function detailOf(i: PayInput): string | null {
  if (payOf(i).kind === 'unit') return null;
  if (i.row.kind === 'individual') return HISTORY_DETAIL.lesson(i.row.lesson.price, i.lessonPaid.get(i.row.lesson.id) ?? 0);
  const a = i.row.attendance;
  if (a.billing === 'fara_abonament' || a.billing === 'slot') return HISTORY_DETAIL.noSubscription;
  const m = monthOfRow(a, i);
  return m ? HISTORY_DETAIL.club(m.month, m.due, m.paid, m.left) : HISTORY_DETAIL.club(monthOf(a.sessionDate), 0, 0, 0);
}

export function payLabel(pay: HistoryRow['pay']): string {
  if (pay.kind === 'unit') return HISTORY_DETAIL.unit(pay.unit, pay.slots, pay.code);
  return pay.kind === 'paid' ? HISTORY_DETAIL.paid : HISTORY_DETAIL.unpaid;
}
