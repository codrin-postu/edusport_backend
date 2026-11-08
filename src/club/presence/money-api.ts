import type { PaymentFor } from './payments/rules';
import type { SchoolDue } from './due/settlement';
import type { PaymentMethod, PaymentPurpose, SubscriptionState } from './types';

export type SubscriptionStateFilter = 'toate' | 'active' | 'epuizate' | 'expirate' | 'anulate';
export type SubscriptionQuery = { state: SubscriptionStateFilter; groupId: string | null };
export type SubscriptionListRow = {
  subscriptionId: string; athleteId: string; athleteName: string; groupName: string | null; slots: number; used: number;
  validUntil: string; expired: boolean; state: SubscriptionState; canCancel: boolean;
};
export type SubscriptionListPage = { rows: SubscriptionListRow[]; groups: { value: string; label: string }[] };
export type SubscriptionUse = { unit: number; sessionId: string; date: string; startTime: string; groupName: string };
export type SubscriptionCard = {
  id: string; code: string | null; label: string; startsOn: string; validUntil: string; state: SubscriptionState; used: number; slots: number; uses: SubscriptionUse[];
};
export type AthleteSubscriptionCards = { groups: { name: string; main: boolean }[]; current: SubscriptionCard[]; others: SubscriptionCard[] };
export type MonthRow = { month: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number; lines: string[] };
export type PaymentRowView = {
  paymentId: string; athleteId: string; athleteName: string; paidOn: string; purpose: PaymentPurpose; purposeText: string; method: PaymentMethod;
  collectedAtRink: boolean; amount: number; recordedBy: string; cancelled: boolean; for: PaymentFor; note: string | null;
};
export type AthletePayments = { months: MonthRow[]; payments: PaymentRowView[]; hasEmail: boolean; readOnly: boolean };
export type PaymentQuery = { month: string; method: PaymentMethod | null; purpose: PaymentPurpose | null };
export type PaymentList = { rows: PaymentRowView[]; total: number };
export type SchoolDueRow = SchoolDue & { athleteName: string; groupName: string | null };
export type ClubDueRow = { athleteId: string; athleteName: string; groupNames: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number };
export type DuePage = { month: string; school: SchoolDueRow[]; club: ClubDueRow[]; groupsWithoutList: number };
