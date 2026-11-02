import type { AthleteRow } from '../../athletes/store';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import type { SeasonRecord } from '../../groups/types';
import { METHOD_WORDS, PURPOSE_WORDS } from '../copy/core';
import { PAYMENT_COPY } from '../copy/payments';
import { listDate, isMonth, monthOf, monthRange } from '../dates';
import { byId, groupNameMap } from '../due/reads';
import { clubMonths, type ClubLine, type ClubMonth } from '../due/settlement';
import { sumMoney } from '../money';
import type { PaymentList, PaymentQuery, PaymentRowView, AthletePayments, MonthRow } from '../money-api';
import type { PresenceStore } from '../store';
import type { PaymentMethod, PaymentPurpose, PaymentRow, SubscriptionRow } from '../types';
import { listPurposeText, paymentOptions, type PaymentFor, type PaymentOption } from './rules';

const METHODS = Object.keys(METHOD_WORDS) as PaymentMethod[];
const PURPOSES = Object.keys(PURPOSE_WORDS) as PaymentPurpose[];

/** Plăți query: month defaults to the current one; "Toate" is null (5.10). */
export function readPaymentQuery(q: Record<string, unknown>, today: string): PaymentQuery {
  return {
    month: isMonth(q.month) ? q.month : monthOf(today),
    method: METHODS.find((m) => m === q.method) ?? null,
    purpose: PURPOSES.find((p) => p === q.purpose) ?? null,
  };
}

type Names = { athletes: Map<string, AthleteRow>; subs: Map<string, SubscriptionRow>; seasons: Map<string, SeasonRecord> };

function forOf(p: PaymentRow): PaymentFor {
  switch (p.purpose) {
    case 'abonament': return { kind: 'abonament', subscriptionId: p.subscriptionId ?? '' };
    case 'cotizatie': return { kind: 'cotizatie', seasonId: p.seasonId };
    case 'club_luna': return { kind: 'club_luna', month: p.clubMonth ?? '' };
    case 'lectie': return { kind: 'lectie', lessonId: p.lessonId ?? '' };
    default: return { kind: 'altceva' };
  }
}

/** One row of a Plăți list or athlete tab; "Pentru" as the list shows it (5.10, C61). */
function viewOf(p: PaymentRow, names: Names): PaymentRowView {
  const sub = p.subscriptionId === null ? undefined : names.subs.get(p.subscriptionId);
  return {
    paymentId: p.id, athleteId: p.athleteId, athleteName: names.athletes.get(p.athleteId)?.name ?? '', paidOn: p.paidOn, purpose: p.purpose,
    purposeText: listPurposeText(p, { itemName: sub?.itemName ?? null, startsOn: sub?.startsOn ?? null, seasonLabel: names.seasons.get(p.seasonId)?.label ?? null }),
    method: p.method, collectedAtRink: p.collectedAtRink, amount: p.amount, recordedBy: p.recordedBy, cancelled: p.cancelled, for: forOf(p), note: p.note,
  };
}

const newestFirst = (a: PaymentRow, b: PaymentRow): number => b.paidOn.localeCompare(a.paidOn) || b.id.localeCompare(a.id);

/** Plăți list: by paidOn in the month, newest first; total without cancelled rows (5.10, C62). */
export async function listPayments(store: PresenceStore, q: PaymentQuery, today: string): Promise<PaymentList> {
  const [payments, athletes, subs, seasons] = await Promise.all([store.payments(monthRange(q.month)), store.athletes(), store.subscriptions(), store.seasons()]);
  const names: Names = { athletes: byId(athletes), subs: byId(subs), seasons: byId(seasons) };
  const rows = payments
    .filter((p) => (q.method === null || p.method === q.method) && (q.purpose === null || p.purpose === q.purpose))
    .sort(newestFirst)
    .map((p) => viewOf(p, names));
  return { rows, total: sumMoney(rows.filter((r) => !r.cancelled).map((r) => r.amount)) };
}

function lineText(l: ClubLine): string {
  if (l.lesson) return PAYMENT_COPY.lessonLine(l.date, l.lesson.price);
  const parts = [listDate(l.date)];
  if (l.groupName) parts.push(l.groupName);
  parts.push(...l.charges.map((c) => PAYMENT_COPY.chargeText(c)));
  return parts.join(', ');
}

const monthRow = (m: ClubMonth): MonthRow => ({
  month: m.month, grup: m.grup, uscat: m.uscat, lessons: m.lessons, due: m.due, paid: m.paid, left: m.left, lines: m.lines.map(lineText),
});

/** Everything one athlete's money reads need, each loaded once. */
async function ledgerOf(store: PresenceStore, athleteId: string) {
  const [attendances, lessons, payments, subs, seasons, groups, startDate] = await Promise.all([
    store.attendances({ athleteId }), store.lessons({ athleteId }), store.payments({ athleteId }), store.subscriptions({ athleteId }),
    store.seasons(), store.groups(), store.attendanceStartDate(),
  ]);
  const months = clubMonths({ attendances, lessons, payments, groupNames: groupNameMap(groups), startDate });
  return { months, lessons, payments, subs, seasons };
}

/** The athlete's Plăți tab: months newest first with detail lines; read-only when anonymized (5.7, C52). */
export async function athletePayments(store: PresenceStore, athleteId: string, today: string): Promise<AthletePayments | null> {
  const athlete = await store.athlete(athleteId);
  if (!athlete) return null;
  const ledger = await ledgerOf(store, athleteId);
  const names: Names = { athletes: byId([athlete]), subs: byId(ledger.subs), seasons: byId(ledger.seasons) };
  return {
    months: ledger.months.map(monthRow),
    payments: [...ledger.payments].sort(newestFirst).map((p) => viewOf(p, names)),
    hasEmail: (athlete.email ?? '').trim() !== '',
    readOnly: isAnonymized(athlete),
  };
}

/** "Pentru" options with default amounts for one athlete (4.15, C33). */
export async function athletePaymentOptions(store: PresenceStore, athleteId: string, today: string, extraMonth: string | null = null): Promise<PaymentOption[] | null> {
  if (!(await store.athlete(athleteId))) return null;
  const ledger = await ledgerOf(store, athleteId);
  return paymentOptions({ subs: ledger.subs, payments: ledger.payments, seasons: ledger.seasons, months: ledger.months, lessons: ledger.lessons, today, extraMonth });
}
