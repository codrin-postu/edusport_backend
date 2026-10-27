import type { AcsState } from '../acs';
import { isRecord } from '../narrow';
import type { Subject } from '../groups/types';
import type { AttendanceRow, LessonRow, LessonWrite, PaymentRow, PaymentWrite, SubscriptionRow, SubscriptionWrite } from './types';

/**
 * What a phase 5 action wrote, stored as `undo` on its first Istoric line (spec 7.3). `POST /club/undo` applies the steps in
 * reverse order, in one transaction, and only while every guarded row still has the stamp it had right after the action.
 */
export type PresenceUndoStep =
  | { op: 'deleteSubscription'; id: string }
  | { op: 'setSubscription'; id: string; values: Partial<Pick<SubscriptionWrite, 'extendedWeeks' | 'validUntil' | 'cancelled' | 'cancelledAt' | 'cancelledBy' | 'validIn'>> }
  | { op: 'setAttendanceSlot'; id: string; subscriptionId: string | null; billing: 'slot' | 'fara_abonament' }
  | { op: 'deletePayment'; id: string }
  | { op: 'setPayment'; id: string; values: Partial<PaymentWrite> }
  | { op: 'setAcs'; athleteId: string; seasonId: string; state: AcsState | null }
  | { op: 'cancelPaymentEmail'; paymentId: string }
  | { op: 'deleteLesson'; id: string }
  | { op: 'createLesson'; row: LessonWrite };
export type GuardType = 'subscription' | 'payment' | 'lesson' | 'attendance';
export type PresenceGuard = { type: GuardType; id: string; stamp: string | null };
export type PresenceUndoRecord = { kind: 'presence'; steps: PresenceUndoStep[]; subjects: Subject[]; athletes: string[]; guards: PresenceGuard[] };

/** A missing row has no stamp (null): the guard then holds only while the row is still missing. */
const stamp = <T>(row: T | null, fields: (r: T) => unknown[]): string | null => (row ? JSON.stringify(fields(row)) : null);
const sortedCopy = (ids: readonly string[]): string[] => [...ids].sort();

export const subscriptionStamp = (row: SubscriptionRow | null, used: number): string | null =>
  stamp(row, (r) => [r.extendedWeeks, r.validUntil, r.cancelled, sortedCopy(r.validIn), used]);

export const paymentStamp = (row: PaymentRow | null): string | null =>
  stamp(row, (r) => [r.amount, r.method, r.paidOn, r.purpose, r.subscriptionId, r.lessonId, r.clubMonth, r.seasonId, r.collectedAtRink, r.note, r.cancelled]);

export const lessonStamp = (row: LessonRow | null, paid: number): string | null =>
  stamp(row, (r) => [r.state, r.present, r.date, r.startTime, r.durationMin, sortedCopy(r.coachIds), paid]);

export const attendanceStamp = (row: Pick<AttendanceRow, 'subscriptionId' | 'billing' | 'grup' | 'uscat'> | null): string | null =>
  stamp(row, (r) => [r.subscriptionId, r.billing, r.grup, r.uscat]);

const GUARD_TYPES: readonly string[] = ['subscription', 'payment', 'lesson', 'attendance'];
const isGuard = (g: unknown): boolean => isRecord(g) && GUARD_TYPES.includes(String(g.type)) && typeof g.id === 'string' && (g.stamp === null || typeof g.stamp === 'string');

export function readPresenceRecord(v: unknown): PresenceUndoRecord | null {
  if (!isRecord(v) || v.kind !== 'presence') return null;
  const ok = Array.isArray(v.steps) && v.steps.every(isRecord) && Array.isArray(v.subjects) && Array.isArray(v.athletes) && Array.isArray(v.guards) && v.guards.every(isGuard);
  return ok ? (v as unknown as PresenceUndoRecord) : null;
}

type Targets = { athletes: string[]; lessons: string[]; subscriptions: string[]; payments: string[] };
const sorted = (ids: string[]): string[] => [...new Set(ids)].sort();

function stepTargets(step: PresenceUndoStep): Partial<Targets> {
  switch (step.op) {
    case 'deleteSubscription': case 'setSubscription': return { subscriptions: [step.id] };
    case 'deletePayment': case 'setPayment': return { payments: [step.id] };
    case 'cancelPaymentEmail': return { payments: [step.paymentId] };
    case 'deleteLesson': return { lessons: [step.id] };
    case 'createLesson': return { athletes: [step.row.athleteId] };
    case 'setAcs': return { athletes: [step.athleteId] };
    case 'setAttendanceSlot': return {};
  }
}

const guardKey: Partial<Record<GuardType, keyof Targets>> = { subscription: 'subscriptions', payment: 'payments', lesson: 'lessons' };

/** Lock order of 7.1: athletes, lessons, subscriptions, payments; each sorted and unique. */
export function presenceLockTargets(r: PresenceUndoRecord): Targets {
  const all = r.steps.map(stepTargets);
  const pick = (k: keyof Targets, extra: string[] = []): string[] => sorted([...all.flatMap((t) => t[k] ?? []), ...extra]);
  const guarded = (k: keyof Targets): string[] => r.guards.filter((g) => guardKey[g.type] === k).map((g) => g.id);
  return { athletes: pick('athletes', r.athletes), lessons: pick('lessons', guarded('lessons')), subscriptions: pick('subscriptions', guarded('subscriptions')), payments: pick('payments', guarded('payments')) };
}
