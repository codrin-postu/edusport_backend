import type { AcsRow } from '../athletes/store';
import type { AcsState } from '../acs';
import type { CalendarWindow } from '../groups/occurrences';
import type { GroupStore } from '../groups/types';
import type {
  AttendanceRow, AttendanceWrite, Billing, LessonRow, LessonWrite, PaymentEmailJob, PaymentRow, PaymentWrite, PriceListRecord, SessionRow, SessionWrite,
  SubscriptionRow, SubscriptionWrite,
} from './types';

export type PresenceGroupReads = Pick<GroupStore, 'transaction' | 'lockSeason' | 'lockAthlete' | 'lockGroup' | 'lockEvent' | 'lockHistoryEntry' | 'seasons' | 'sections' | 'groups' | 'group'
  | 'teamMembers' | 'athletes' | 'athlete' | 'memberships' | 'history' | 'historyEntry' | 'historyAfter' | 'adminNames' | 'setAthleteStatus'
  | 'recordAction' | 'record' | 'setHistoryChanges'>;
export type Range = { from?: string; to?: string };
export type SessionWhere = Range & { ids?: string[]; groupId?: string };
export type AttendanceWhere = Range & { ids?: string[]; sessionIds?: string[]; athleteId?: string; subscriptionIds?: string[]; billing?: Billing[] }; // from/to on the session date
export type LessonWhere = Range & { ids?: string[]; athleteId?: string };
export type SubscriptionWhere = { ids?: string[]; athleteId?: string };
export type PaymentWhere = Range & { ids?: string[]; athleteId?: string; subscriptionId?: string; lessonId?: string }; // from/to on paidOn
export class UniqueKeyError extends Error {}

export interface PresenceStore extends PresenceGroupReads {
  lockSession(id: string): Promise<void>;
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
  /** Throws UniqueKeyError on a second uniqueKey. */
  createAttendance(data: AttendanceWrite): Promise<string>;
  updateAttendance(id: string, data: Partial<AttendanceWrite>): Promise<void>;
  deleteAttendance(id: string): Promise<void>;
  lessons(where?: LessonWhere): Promise<LessonRow[]>;
  lesson(id: string): Promise<LessonRow | null>;
  createLesson(data: LessonWrite): Promise<string>;
  updateLesson(id: string, data: Partial<LessonWrite>): Promise<void>;
  deleteLesson(id: string): Promise<void>;
  subscriptions(where?: SubscriptionWhere): Promise<SubscriptionRow[]>;
  subscription(id: string): Promise<SubscriptionRow | null>;
  createSubscription(data: SubscriptionWrite): Promise<string>;
  updateSubscription(id: string, data: Partial<SubscriptionWrite>): Promise<void>;
  deleteSubscription(id: string): Promise<void>;
  payments(where?: PaymentWhere): Promise<PaymentRow[]>;
  payment(id: string): Promise<PaymentRow | null>;
  createPayment(data: PaymentWrite): Promise<string>;
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
