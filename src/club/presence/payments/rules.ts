import type { AcsState } from '../../acs';
import { isIsoDate } from '../../groups/dates';
import type { SeasonRecord } from '../../groups/types';
import { PAYMENT_COPY } from '../copy/payments';
import { METHOD_WORDS, PRESENCE_ERRORS, PURPOSE_WORDS } from '../copy/core';
import { addMonths, isMonth, monthOf } from '../dates';
import type { ClubMonth } from '../due/settlement';
import { sumMoney } from '../money';
import { startText } from '../subscriptions/rules';
import type { LessonRow, PaymentMethod, PaymentRow, PaymentWrite, SubscriptionRow } from '../types';

export type PaymentFor =
  | { kind: 'abonament'; subscriptionId: string } | { kind: 'cotizatie'; seasonId: string }
  | { kind: 'club_luna'; month: string } | { kind: 'lectie'; lessonId: string } | { kind: 'altceva' };
export type PaymentInput = { amount: number; paidOn: string; method: PaymentMethod; for: PaymentFor; collectedAtRink: boolean; note: string | null };
export type NewPaymentInput = PaymentInput & { athleteId: string; sendEmail: boolean };
export type Checked<T> = { ok: true; value: T } | { ok: false; status: 400; error: string };

const MAX_AMOUNT = 100000;
const MAX_NOTE = 1000;
const invalid = { ok: false, status: 400, error: PRESENCE_ERRORS.invalid } as const;
const refused = (error: string): Checked<never> => ({ ok: false, status: 400, error });

/** Two decimals at most, more than 0, at most 100000; stored rounded to bani (decided 2). */
export function readAmount(v: unknown): Checked<number> {
  if (typeof v !== 'number' || !Number.isFinite(v)) return invalid;
  if (v <= 0) return refused(PAYMENT_COPY.errors.amount);
  const bani = v * 100;
  if (Math.abs(bani - Math.round(bani)) >= 1e-6 || v > MAX_AMOUNT) return invalid;
  return { ok: true, value: Math.round(bani) / 100 };
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function readFor(v: unknown): Checked<PaymentFor> {
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  switch (o?.kind) {
    case 'abonament': return isText(o.subscriptionId) ? { ok: true, value: { kind: 'abonament', subscriptionId: o.subscriptionId } } : invalid;
    case 'cotizatie': return isText(o.seasonId) ? { ok: true, value: { kind: 'cotizatie', seasonId: o.seasonId } } : invalid;
    case 'club_luna': return isMonth(o.month) ? { ok: true, value: { kind: 'club_luna', month: o.month } } : invalid;
    case 'lectie': return isText(o.lessonId) ? { ok: true, value: { kind: 'lectie', lessonId: o.lessonId } } : invalid;
    case 'altceva': return { ok: true, value: { kind: 'altceva' } };
    default: return refused(PAYMENT_COPY.errors.purpose);
  }
}

function readNote(v: unknown): Checked<string | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== 'string' || v.length > MAX_NOTE) return invalid;
  return { ok: true, value: v.trim() === '' ? null : v.trim() };
}

export function readPaymentInput(body: unknown, today: string): Checked<PaymentInput> {
  if (typeof body !== 'object' || body === null) return invalid;
  const b = body as Record<string, unknown>;
  const amount = readAmount(b.amount);
  if (amount.ok === false) return amount;
  if (typeof b.paidOn !== 'string' || !isIsoDate(b.paidOn)) return invalid;
  if (b.paidOn > today) return refused(PAYMENT_COPY.errors.future);
  if (typeof b.method !== 'string' || !Object.keys(METHOD_WORDS).includes(b.method)) return invalid;
  const forWhat = readFor(b.for);
  if (forWhat.ok === false) return forWhat;
  const note = readNote(b.note);
  if (note.ok === false) return note;
  return {
    ok: true, value: { amount: amount.value, paidOn: b.paidOn, method: b.method as PaymentMethod, for: forWhat.value, collectedAtRink: b.collectedAtRink === true, note: note.value },
  };
}

export function readNewPayment(body: unknown, today: string): Checked<NewPaymentInput> {
  const input = readPaymentInput(body, today);
  if (input.ok === false) return input;
  const b = body as Record<string, unknown>;
  if (!isText(b.athleteId)) return invalid;
  return { ok: true, value: { ...input.value, athleteId: b.athleteId, sendEmail: b.sendEmail === true } };
}

export type PurposeFields = Pick<PaymentWrite, 'purpose' | 'subscriptionId' | 'lessonId' | 'clubMonth' | 'seasonId' | 'collectedAtRink'>;

/** The fee carries the season chosen; every other purpose, the season of the date. The rink box only counts for an abonament (3.5, C8). */
export function purposeFields(f: PaymentFor, collectedAtRink: boolean, seasonOfPaidOn: string): PurposeFields {
  const base = { subscriptionId: null, lessonId: null, clubMonth: null, seasonId: seasonOfPaidOn, collectedAtRink: false };
  switch (f.kind) {
    case 'abonament': return { ...base, purpose: 'abonament', subscriptionId: f.subscriptionId, collectedAtRink };
    case 'cotizatie': return { ...base, purpose: 'cotizatie', seasonId: f.seasonId };
    case 'club_luna': return { ...base, purpose: 'club_luna', clubMonth: f.month };
    case 'lectie': return { ...base, purpose: 'lectie', lessonId: f.lessonId };
    case 'altceva': return { ...base, purpose: 'altceva' };
  }
}

export type PurposeNames = { itemName?: string | null; startsOn?: string | null; seasonLabel?: string | null };

const abonamentText = (names: PurposeNames): string =>
  names.itemName && names.startsOn ? PAYMENT_COPY.optAbonament(names.itemName, startText(names.startsOn)) : (names.itemName ?? PURPOSE_WORDS.abonament);

/** "Pentru" as shown in a payment's own lines (5.10). */
export function purposeText(p: Pick<PaymentRow, 'purpose' | 'clubMonth'>, names: PurposeNames): string {
  switch (p.purpose) {
    case 'abonament': return abonamentText(names);
    case 'cotizatie': return names.seasonLabel ? PAYMENT_COPY.optFee(names.seasonLabel) : PURPOSE_WORDS.cotizatie;
    case 'club_luna': return p.clubMonth ? PAYMENT_COPY.optMonth(p.clubMonth) : PURPOSE_WORDS.club_luna;
    default: return PURPOSE_WORDS[p.purpose];
  }
}

const NOTE_WORDS = 4;

/** The Plăți list: "Altceva" plus the note's first 4 words (C61, decided 17). */
export function listPurposeText(p: Pick<PaymentRow, 'purpose' | 'clubMonth' | 'note'>, names: PurposeNames): string {
  const text = purposeText(p, names);
  const first = p.purpose === 'altceva' && p.note ? p.note.trim().split(/\s+/).slice(0, NOTE_WORDS).join(' ') : '';
  return first === '' ? text : `${text}, ${first}`;
}

export function sameFor(p: PaymentRow, fields: PurposeFields): boolean {
  return p.purpose === fields.purpose && p.subscriptionId === fields.subscriptionId && p.lessonId === fields.lessonId
    && p.clubMonth === fields.clubMonth && p.seasonId === fields.seasonId;
}

export const paidFor = (payments: readonly PaymentRow[], match: (p: PaymentRow) => boolean): number =>
  sumMoney(payments.filter((p) => !p.cancelled && match(p)).map((p) => p.amount));

export type PaymentOption = { for: PaymentFor; label: string; amount: number | null; isDefault: boolean };

const option = (f: PaymentFor, label: string, amount: number | null, isDefault = false): PaymentOption => ({ for: f, label, amount, isDefault });
const notBelowZero = (n: number): number => Math.max(0, n);
const newestFirst = <T>(rows: readonly T[], key: (r: T) => string): T[] => [...rows].sort((a, b) => key(b).localeCompare(key(a)));

function abonamentOptions(subs: readonly SubscriptionRow[], payments: readonly PaymentRow[]): PaymentOption[] {
  const open = subs.filter((s) => !s.cancelled);
  return newestFirst(open, (s) => `${s.startsOn}|${s.id}`).map((s) => {
    const left = s.price === null ? null : notBelowZero(sumMoney([s.price, -paidFor(payments, (p) => p.purpose === 'abonament' && p.subscriptionId === s.id)]));
    return option({ kind: 'abonament', subscriptionId: s.id }, PAYMENT_COPY.optAbonament(s.itemName, startText(s.startsOn)), left);
  });
}

function monthOptions(months: readonly ClubMonth[], today: string): PaymentOption[] {
  const current = monthOf(today);
  const first = addMonths(current, -11);
  const listed = new Map(months.filter((m) => m.month >= first && m.month <= current && m.due > 0).map((m) => [m.month, m]));
  const ids = newestFirst([...new Set([current, ...listed.keys()])], (m) => m);
  return ids.map((m) => option({ kind: 'club_luna', month: m }, PAYMENT_COPY.optMonth(m), notBelowZero(listed.get(m)?.left ?? 0)));
}

function lessonOptions(lessons: readonly LessonRow[], payments: readonly PaymentRow[], today: string): PaymentOption[] {
  const from = `${addMonths(monthOf(today), -11)}-01`;
  const open = lessons.filter((l) => l.state === 'saved' && l.present === true && l.price !== null && l.date >= from);
  return newestFirst(open, (l) => `${l.date}|${l.id}`).map((l) => {
    const left = notBelowZero(sumMoney([l.price as number, -paidFor(payments, (p) => p.purpose === 'lectie' && p.lessonId === l.id)]));
    return option({ kind: 'lectie', lessonId: l.id }, PAYMENT_COPY.optLesson(l.date), left);
  });
}

/** "Pentru" options with default amounts (4.15, C33): abonamente, fee per season, Club months, lessons, Altceva. */
export function paymentOptions(i: {
  subs: SubscriptionRow[]; payments: PaymentRow[]; seasons: SeasonRecord[]; months: ClubMonth[]; lessons: LessonRow[]; today: string;
}): PaymentOption[] {
  const fees = newestFirst(i.seasons, (s) => s.startMonth).map((s) => option({ kind: 'cotizatie', seasonId: s.id }, PAYMENT_COPY.optFee(s.label), s.membershipFee, s.isCurrent));
  return [
    ...abonamentOptions(i.subs, i.payments), ...fees, ...monthOptions(i.months, i.today), ...lessonOptions(i.lessons, i.payments, i.today),
    option({ kind: 'altceva' }, PURPOSE_WORDS.altceva, null),
  ];
}

/** A fee sets "Da"; the state before is kept (null: no row) (4.16, C9). */
export function acsOnFee(current: AcsState | null): { set: boolean; acsBefore: AcsState | null } {
  return { set: current !== 'da', acsBefore: current };
}

/** Back to the state before only when no other live fee of the season remains and A.C.S. is still "Da" (4.17, C9). */
export function acsRevert(payment: PaymentRow, others: readonly PaymentRow[], current: AcsState | null): { revert: boolean; to: AcsState | null } {
  const otherFee = others.some((o) => o.id !== payment.id && !o.cancelled && o.purpose === 'cotizatie' && o.seasonId === payment.seasonId);
  const revert = payment.purpose === 'cotizatie' && !otherFee && current === 'da' && payment.acsBefore !== 'da';
  return { revert, to: revert ? payment.acsBefore : current };
}

const TRACKED = ['amount', 'paidOn', 'method', 'collectedAtRink', 'note'] as const;

/** Changed fields as old -> new for the history line; the purpose as text (4.17, 8). */
export function paymentFieldChanges(before: PaymentRow, after: PaymentWrite, texts: { before: string; after: string }): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of TRACKED) {
    if (before[key] !== after[key]) changes[key] = { from: before[key], to: after[key] };
  }
  const relinked = before.subscriptionId !== after.subscriptionId || before.lessonId !== after.lessonId;
  if (texts.before !== texts.after || relinked) changes.purposeText = { from: texts.before, to: texts.after };
  return changes;
}
