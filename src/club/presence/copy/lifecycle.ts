import { longDate } from '../dates';
import { ron } from '../money';
import type { PaymentMethod, SubscriptionState } from '../types';
import { METHOD_WORDS, PRESENCE_WORDS, SUBSCRIPTION_STATE_WORDS } from './core';

/** Section titles of "rezumat.pdf" for phase 5 (spec 4.21a). */
export const LIFECYCLE_PDF = { attendance: 'Prezență', lessons: 'Lecții individuale', subscriptions: 'Abonamente', payments: 'Plăți' } as const;

const WORDS = {
  grup: 'Grup', uscat: 'Uscat', visitor: 'doar la ședința asta', coach: 'antrenor', coaches: 'antrenori', and: 'și', present: 'prezent', absent: 'absent',
  from: 'din', expires: 'expiră pe', atRink: 'la patinoar', note: 'Notă',
} as const;

export type AttendanceLine = { date: string; groupName: string; startTime: string; grup: boolean; uscat: boolean; visitor: boolean };
export type LessonLine = { date: string; startTime: string; durationMin: number; coachNames: string[]; present: boolean | null; price: number | null };
export type SubscriptionLine = { itemName: string; startsOn: string; validUntil: string; used: number; slots: number; state: SubscriptionState; price: number | null };
export type PaymentLine = { paidOn: string; amount: number; method: PaymentMethod; purposeText: string; collectedAtRink: boolean; note: string | null; cancelled: boolean };

const joined = (parts: (string | false | null)[]): string => parts.filter((p): p is string => typeof p === 'string').join(', ');

export const attendanceLine = (r: AttendanceLine): string =>
  joined([longDate(r.date), r.groupName, r.startTime, r.grup && WORDS.grup, r.uscat && WORDS.uscat, r.visitor && WORDS.visitor]);

function coachText(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${WORDS.coach} ${names[0]}`;
  return `${WORDS.coaches} ${names.slice(0, -1).join(', ')} ${WORDS.and} ${names[names.length - 1]}`;
}

export const lessonLine = (r: LessonLine): string =>
  joined([
    longDate(r.date), r.startTime, `${r.durationMin} min`, coachText(r.coachNames),
    r.present === true && WORDS.present, r.present === true && r.price !== null && ron(r.price), r.present === false && WORDS.absent,
  ]);

export const subscriptionLine = (r: SubscriptionLine): string =>
  joined([
    r.itemName, `${WORDS.from} ${longDate(r.startsOn)}`, `${WORDS.expires} ${longDate(r.validUntil)}`, `${r.used}/${r.slots}`,
    SUBSCRIPTION_STATE_WORDS[r.state], r.price !== null && ron(r.price),
  ]);

export const paymentLine = (r: PaymentLine): string =>
  joined([
    longDate(r.paidOn), ron(r.amount), METHOD_WORDS[r.method], r.purposeText, r.collectedAtRink && WORDS.atRink,
    r.note !== null && `${WORDS.note}: ${r.note}`, r.cancelled && PRESENCE_WORDS.cancelledPayment,
  ]);
