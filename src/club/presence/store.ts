import type { AcsRow } from '../athletes/store';
import type { AcsState } from '../acs';
import type { CalendarWindow } from '../groups/occurrences';
import type { GroupStore } from '../groups/types';
import type {
  AttendanceRow, AttendanceWrite, Billing, LessonRow, LessonCancel, LessonSeriesRow, LessonSeriesWrite, LessonWrite, PaymentEmailJob, PaymentRow, PaymentWrite, PriceListRecord, SessionRow, SessionWrite,
  SubscriptionRow, SubscriptionWrite,
} from './types';

export type PresenceGroupReads = Pick<GroupStore, 'transaction' | 'lockSeason' | 'lockAthlete' | 'lockGroup' | 'lockEvent' | 'lockHistoryEntry' | 'seasons' | 'sections' | 'groups' | 'group'
  | 'teamMembers' | 'events' | 'athletes' | 'athlete' | 'memberships' | 'history' | 'historyEntry' | 'historyAfter' | 'adminNames' | 'setAthleteStatus'
  | 'recordAction' | 'record' | 'setHistoryChanges'>;
export type Range = { from?: string; to?: string };
export type SessionWhere = Range & { ids?: string[]; groupId?: string };
export type AttendanceWhere = Range & { ids?: string[]; sessionIds?: string[]; athleteId?: string; subscriptionIds?: string[]; billing?: Billing[] }; // from/to on the session date
export type LessonWhere = Range & { ids?: string[]; athleteId?: string; seriesId?: string };
export type SubscriptionWhere = { ids?: string[]; athleteId?: string };
export type PaymentWhere = Range & { ids?: string[]; athleteId?: string; subscriptionId?: string; lessonId?: string }; // from/to on paidOn
/** Rows of the athlete history, newest first by session or lesson date, start time, then id; `total` counts every row in range, `rows` holds the first `take`. */
export type AttendancePage = { total: number; rows: (AttendanceRow & { startTime: string })[] };
export type LessonPage = { total: number; rows: LessonRow[] };
export class UniqueKeyError extends Error {}

/** Lock order: seasons, athletes, groups, events, then (per athlete) lesson series, then lessons, attendances, subscriptions, payments. */
export interface PresenceStore extends PresenceGroupReads {
  lockSession(id: string): Promise<void>;
  lockLessonSeries(id: string): Promise<void>;
  lockLesson(id: string): Promise<void>;
  lockAttendance(id: string): Promise<void>;
  lockSubscription(id: string): Promise<void>;
  lockPayment(id: string): Promise<void>;
  priceListRecords(): Promise<PriceListRecord[]>;
  acsRows(where: { athleteId?: string; seasonId?: string }): Promise<AcsRow[]>;
  /** null deletes the row; one row per athlete and season. */
  setAcs(athleteId: string, seasonId: string, state: AcsState | null): Promise<void>;
  calendarWindow(): Promise<CalendarWindow>;
  attendanceStartDate(): Promise<string | null>;
  sessions(where?: SessionWhere): Promise<SessionRow[]>;
  session(id: string): Promise<SessionRow | null>;
  sessionByKey(key: string): Promise<SessionRow | null>;
  /** Throws UniqueKeyError on a second occurrenceKey. */
  createSession(data: SessionWrite): Promise<string>;
  updateSession(id: string, data: Partial<SessionWrite>): Promise<void>;
  attendances(where?: AttendanceWhere): Promise<AttendanceRow[]>;
  /** Session date in range, newest first (session date, start time, id desc), `take` rows. */
  athleteAttendancePage(athleteId: string, from: string, to: string, take: number): Promise<AttendancePage>;
  /** Present lessons in range, newest first (date, start time, id desc), `take` rows. */
  athleteLessonPage(athleteId: string, from: string, to: string, take: number): Promise<LessonPage>;
  /** Throws UniqueKeyError on a second uniqueKey. */
  createAttendance(data: AttendanceWrite): Promise<string>;
  updateAttendance(id: string, data: Partial<AttendanceWrite>): Promise<void>;
  deleteAttendance(id: string): Promise<void>;
  lessons(where?: LessonWhere): Promise<LessonRow[]>;
  lesson(id: string): Promise<LessonRow | null>;
  createLesson(data: LessonWrite): Promise<string>;
  updateLesson(id: string, data: Partial<LessonWrite>): Promise<void>;
  deleteLesson(id: string): Promise<void>;
  lessonSeries(id: string): Promise<LessonSeriesRow | null>;
  /** By `from`, then id. */
  lessonSeriesOf(athleteId: string): Promise<LessonSeriesRow[]>;
  createLessonSeries(data: LessonSeriesWrite): Promise<string>;
  updateLessonSeries(id: string, data: Partial<Pick<LessonSeriesWrite, 'to' | 'coachIds' | 'athleteId'>>): Promise<void>;
  deleteLessonSeries(id: string): Promise<void>;
  /** A planned lesson deleted from today on; one row per athlete, date and start time (a repeat changes nothing). */
  recordLessonCancel(row: LessonCancel): Promise<void>;
  /** Removes the row of that athlete, date and start time (the undo of a delete). */
  removeLessonCancel(row: LessonCancel): Promise<void>;
  /** The athlete's cancelled lessons dated in range, by date and start time. */
  lessonCancels(q: { athleteId: string; from: string; to: string }): Promise<Omit<LessonCancel, 'athleteId'>[]>;
  /** Deletes the cancellations dated before `before`; answers how many. */
  pruneLessonCancels(before: string): Promise<number>;
  subscriptions(where?: SubscriptionWhere): Promise<SubscriptionRow[]>;
  subscription(id: string): Promise<SubscriptionRow | null>;
  /** The code is taken from the counter right before; it is never written again (an update cannot hold it). */
  createSubscription(data: SubscriptionWrite, code: string): Promise<string>;
  updateSubscription(id: string, data: Partial<SubscriptionWrite>): Promise<void>;
  deleteSubscription(id: string): Promise<void>;
  payments(where?: PaymentWhere): Promise<PaymentRow[]>;
  payment(id: string): Promise<PaymentRow | null>;
  /** The receipt number is taken from the counter right before; it is never written again. */
  createPayment(data: PaymentWrite, receiptNo: string): Promise<string>;
  updatePayment(id: string, data: Partial<PaymentWrite>): Promise<void>;
  deletePayment(id: string): Promise<void>;
  /** Queued, kind `payment`, linked to the payment. */
  createPaymentEmailJob(job: PaymentEmailJob): Promise<string>;
  /** Queued jobs of the payment become `cancelled`; answers how many. */
  cancelPaymentEmailJob(paymentId: string): Promise<number>;
  sentPaymentEmailJobs(paymentId: string): Promise<number>;
  /** Inside a transaction only; the value after `+ 1` (1 for a new key). The row lock holds until the transaction ends, so no two creates share a number. */
  nextCounter(key: string): Promise<number>;
  /** Inside a transaction only; the value becomes the greater of itself and `atLeast`, the row is created when missing. */
  raiseCounter(key: string, atLeast: number): Promise<void>;
  /** 0 when the key has no row. */
  counterValue(key: string): Promise<number>;
}
