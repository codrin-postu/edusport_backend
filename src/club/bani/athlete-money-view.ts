import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import { monthTitle } from '../presence/dates';
import type { AthletePayments, AthleteSubscriptionCards, MonthRow } from '../presence/money-api';
import { ron } from '../presence/money';
import { leftCells } from './format';

/** "<grupă>, principală" for the main group, the name alone for the others. */
export const groupLines = (s: AthleteSubscriptionCards): string[] => s.groups.map((g) => (g.main ? MONEY_UI_COPY.athlete.mainGroup(g.name) : g.name));

export const monthCells = (m: MonthRow): { month: string; sessions: string; due: string; paid: string; left: string; advance: string | null } => ({
  month: monthTitle(m.month), sessions: PAYMENT_COPY.sessionsText(m.grup, m.uscat, m.lessons), due: ron(m.due), paid: ron(m.paid), ...leftCells(m.left),
});

/** An anonymized athlete's payments stay visible but cannot change. */
export const paymentsReadOnly = (p: AthletePayments): boolean => p.readOnly;
