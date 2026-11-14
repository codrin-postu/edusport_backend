import type { AcsState } from '../acs';
import { isRecord } from '../narrow';
import type { Subject } from '../groups/types';
import type { AttendanceRow, LessonCancel, LessonRow, LessonSeriesWrite, LessonWrite, PaymentRow, PaymentWrite, SubscriptionRow, SubscriptionWrite } from './types';

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
  /** `was` is the id the lesson had; a `createLessonSeries` later in the same undo relinks by it. */
  | { op: 'createLesson'; row: LessonWrite; was?: string }
  | { op: 'deleteLessonSeries'; id: string }
  /** Recreates the rule and links `lessonIds` to it; the ids are the ones the lessons had (`was` of the `createLesson` steps put back before) or still have. */
  | { op: 'createLessonSeries'; row: LessonSeriesWrite; lessonIds: string[] }
  | { op: 'setLessonSeries'; id: string; to: string }
  /** The cancellation a delete recorded, removed when the delete is undone. */
  | { op: 'removeLessonCancel'; row: LessonCancel }
  /** A plan edit of one lesson put back (guarded by the lesson stamp). */
  | { op: 'setLesson'; id: string; values: Partial<Pick<LessonWrite, 'date' | 'startTime' | 'durationMin' | 'coachIds' | 'seriesId' | 'movedFromDate' | 'movedFromTime'>> };
export type GuardType = 'subscription' | 'payment' | 'lesson' | 'attendance' | 'acs' | 'lessonSeries';
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

/** The rule's start and end and the ids of the lessons linked to it (null for a missing series). */
export const lessonSeriesStamp = (row: { from: string; to: string } | null, lessonIds: string[]): string | null =>
  stamp(row, (r) => [r.from, r.to, sortedCopy(lessonIds)]);

export const attendanceStamp = (row: Pick<AttendanceRow, 'subscriptionId' | 'billing' | 'grup' | 'uscat'> | null): string | null =>
  stamp(row, (r) => [r.subscriptionId, r.billing, r.grup, r.uscat]);

/** An A.C.S. row is identified by its athlete and season, not by a row id: the guard id is `<athleteId>:<seasonId>`. */
export const acsGuardId = (athleteId: string, seasonId: string): string => `${athleteId}:${seasonId}`;
const acsGuardAthlete = (id: string): string => id.split(':')[0];

/** null state = no row. */
export const acsStamp = (athleteId: string, seasonId: string, state: AcsState | null): string | null => stamp(state, (s) => [athleteId, seasonId, s]);

const GUARD_TYPES: readonly string[] = ['subscription', 'payment', 'lesson', 'attendance', 'acs', 'lessonSeries'];
const isGuard = (g: unknown): boolean => isRecord(g) && GUARD_TYPES.includes(String(g.type)) && typeof g.id === 'string' && (g.stamp === null || typeof g.stamp === 'string');

export function readPresenceRecord(v: unknown): PresenceUndoRecord | null {
  if (!isRecord(v) || v.kind !== 'presence') return null;
  const ok = Array.isArray(v.steps) && v.steps.every(isRecord) && Array.isArray(v.subjects) && Array.isArray(v.athletes) && Array.isArray(v.guards) && v.guards.every(isGuard);
  return ok ? (v as unknown as PresenceUndoRecord) : null;
}

type Targets = { athletes: string[]; series: string[]; lessons: string[]; attendances: string[]; subscriptions: string[]; payments: string[] };
const sorted = (ids: string[]): string[] => [...new Set(ids)].sort();

function stepTargets(step: PresenceUndoStep): Partial<Targets> {
  switch (step.op) {
    case 'deleteSubscription': case 'setSubscription': return { subscriptions: [step.id] };
    case 'deletePayment': case 'setPayment': return { payments: [step.id] };
    case 'cancelPaymentEmail': return { payments: [step.paymentId] };
    case 'deleteLesson': case 'setLesson': return { lessons: [step.id] };
    case 'createLesson': case 'removeLessonCancel': return { athletes: [step.row.athleteId] };
    case 'deleteLessonSeries': case 'setLessonSeries': return { series: [step.id] };
    case 'createLessonSeries': return { athletes: [step.row.athleteId] };
    case 'setAcs': return { athletes: [step.athleteId] };
    case 'setAttendanceSlot': return { attendances: [step.id] };
  }
}

const guardKey: Partial<Record<GuardType, keyof Targets>> = { subscription: 'subscriptions', payment: 'payments', lesson: 'lessons', attendance: 'attendances', lessonSeries: 'series' };

/** Lock order of 7.1: athletes (an A.C.S. row is guarded by its athlete's lock), lesson series, lessons, attendances, subscriptions, payments; each sorted and unique. */
export function presenceLockTargets(r: PresenceUndoRecord): Targets {
  const all = r.steps.map(stepTargets);
  const pick = (k: keyof Targets, extra: string[] = []): string[] => sorted([...all.flatMap((t) => t[k] ?? []), ...extra]);
  const guarded = (k: keyof Targets): string[] => r.guards.filter((g) => guardKey[g.type] === k).map((g) => g.id);
  const acsAthletes = r.guards.filter((g) => g.type === 'acs').map((g) => acsGuardAthlete(g.id));
  return { athletes: pick('athletes', [...r.athletes, ...acsAthletes]), series: pick('series', guarded('series')), lessons: pick('lessons', guarded('lessons')), attendances: pick('attendances', guarded('attendances')), subscriptions: pick('subscriptions', guarded('subscriptions')), payments: pick('payments', guarded('payments')) };
}
