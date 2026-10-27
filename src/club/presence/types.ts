import type { AcsState } from '../acs';
import type { PriceListRow } from '../groups/types';
import type { Audience, PriceItemKind } from '../price-item';

export type PresenceType = 'grup' | 'uscat';
export type Billing = 'slot' | 'fara_abonament' | 'club' | 'inclus' | 'fara_pret';
export type Charge = { type: PresenceType; itemName: string; price: number | null; included: boolean };
export type SessionSource = 'schedule' | 'added';
export type SessionWrite = {
  groupId: string; seasonId: string; date: string; startTime: string; durationMin: number; source: SessionSource; eventId: string | null;
  occurrenceKey: string | null; outsideSchedule: boolean; coachIds: string[]; savedBy: string; savedAt: string; firstSavedAt: string;
};
export type SessionRow = SessionWrite & { id: string };
export type AttendanceWrite = {
  sessionId: string; athleteId: string; uniqueKey: string; grup: boolean; uscat: boolean; visitor: boolean; subscriptionId: string | null;
  billing: Billing; charges: Charge[]; amount: number; audience: Audience | null;
};
export type AttendanceRow = AttendanceWrite & { id: string; sessionDate: string; groupId: string };   // read-only joins (decided 3)
export type LessonState = 'planned' | 'saved';
export type LessonWrite = {
  athleteId: string; date: string; startTime: string; durationMin: number; coachIds: string[]; state: LessonState; present: boolean | null;
  priceListId: string | null; itemName: string | null; price: number | null; audience: Audience | null; amount: number;
  createdBy: string; savedBy: string | null; savedAt: string | null;
};
export type LessonRow = LessonWrite & { id: string };
export type SubscriptionWrite = {
  athleteId: string; seasonId: string; priceListId: string; validIn: string[]; itemName: string; price: number | null; audience: Audience; slots: number;
  startsOn: string; validUntil: string; extendedWeeks: number; cancelled: boolean; cancelledAt: string | null; cancelledBy: string | null;
  purchasedAt: string; recordedBy: string;
};
export type SubscriptionRow = SubscriptionWrite & { id: string };
export type SubscriptionState = 'activ' | 'epuizat' | 'expirat' | 'anulat';
export type PaymentMethod = 'numerar' | 'card' | 'transfer';
export type PaymentPurpose = 'abonament' | 'cotizatie' | 'club_luna' | 'lectie' | 'altceva';
export type PaymentWrite = {
  athleteId: string; amount: number; method: PaymentMethod; paidOn: string; purpose: PaymentPurpose; subscriptionId: string | null; lessonId: string | null;
  clubMonth: string | null; seasonId: string; collectedAtRink: boolean; note: string | null; sendEmail: boolean; emailJobId: string | null;
  acsBefore: AcsState | null; recordedBy: string; recordedAt: string; cancelled: boolean; cancelledAt: string | null; cancelledBy: string | null;
};
export type PaymentRow = PaymentWrite & { id: string };
export type PriceItemRow = { name: string; kind: PriceItemKind; sessions: number | null; memberPrice: number | null; nonMemberPrice: number | null; included: boolean };
export type PriceListRecord = PriceListRow & { items: PriceItemRow[] };
export type PaymentEmailPayload = { athleteName: string; amount: number; method: PaymentMethod; paidOn: string; purposeText: string };
export type PaymentEmailJob = { recipient: string; subject: string; paymentId: string; notBefore: string; payload: PaymentEmailPayload };
export type SessionState = 'salvata' | 'urmeaza' | 'nefacuta';
export type HeldOccurrence = { key: string; eventId: string; groupId: string; date: string; startTime: string; endTime: string | null; durationMin: number };
