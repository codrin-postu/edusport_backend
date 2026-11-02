import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import type { AthleteMonthRow } from '../presence/attendance/api-types';
import { monthTitle } from '../presence/dates';
import type { AthletePayments, AthleteSubscriptions, MonthRow } from '../presence/money-api';
import { ron } from '../presence/money';
import { stateWord } from './format';

const copy = MONEY_UI_COPY.athlete;
const UNCOVERED = ', Fără abonament';

/** "<grupă>, principală" for the main group, the name alone for the others. */
export const groupLines = (s: AthleteSubscriptions): string[] => s.groups.map((g) => (g.main ? copy.mainGroup(g.name) : g.name));

export const earlierLines = (s: AthleteSubscriptions): string[] =>
  s.earlier.map((e) => copy.earlierRow(e.itemName, e.startsOn, e.validUntil, e.used, e.slots, stateWord(e.state)));

/** The ", Fără abonament" part is separate so it renders orange. */
export function attendanceLine(row: AthleteMonthRow): { text: string; uncovered: string | null } {
  const text = copy.attendanceRow(row.date, row.groupName, row.types, false);
  return { text, uncovered: row.noSubscription ? UNCOVERED : null };
}

export const monthCells = (m: MonthRow): { month: string; sessions: string; due: string; paid: string; left: string } => ({
  month: monthTitle(m.month), sessions: PAYMENT_COPY.sessionsText(m.grup, m.uscat, m.lessons), due: ron(m.due), paid: ron(m.paid), left: ron(m.left),
});

/** An anonymized athlete's payments stay visible but cannot change. */
export const paymentsReadOnly = (p: AthletePayments): boolean => p.readOnly;
