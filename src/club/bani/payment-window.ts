import { PAYMENT_COPY } from '../presence/copy/payments';
import { longDate } from '../presence/dates';
import type { PaymentRowView } from '../presence/money-api';
import type { PaymentFor, PaymentOption } from '../presence/payments/rules';
import type { PaymentMethod } from '../presence/types';

/** The payment window's form state (spec 5.10); the amount stays text until it is sent. */
export type PaymentDraft = {
  athleteId: string | null; amount: string; paidOn: string; method: PaymentMethod; optionKey: string | null;
  collectedAtRink: boolean; sendEmail: boolean; note: string;
};
export type DraftErrors = Partial<Record<'amount' | 'paidOn' | 'for', string>>;

const AMOUNT = /^\d+(?:[.,]\d{1,2})?$/;

/** "abonament:<id>", "cotizatie:<id>", "club_luna:2026-10", "lectie:<id>", "altceva". */
export function optionKey(f: PaymentFor): string {
  switch (f.kind) {
    case 'abonament': return `abonament:${f.subscriptionId}`;
    case 'cotizatie': return `cotizatie:${f.seasonId}`;
    case 'club_luna': return `club_luna:${f.month}`;
    case 'lectie': return `lectie:${f.lessonId}`;
    case 'altceva': return 'altceva';
  }
}

/** Comma or point, two decimals at most, more than 0 (decided 2). */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!AMOUNT.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n > 0 ? n : null;
}

/** "12,50" for a fraction, "12" for a whole amount (spec format). */
export const amountText = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

export const showsRink = (d: PaymentDraft): boolean => d.optionKey !== null && d.optionKey.startsWith('abonament:');

/** The option's default amount (empty when it has none); the rink box only survives for an abonament (C8). A key the options do not hold leaves "Pentru" unchosen. */
export function withOption(d: PaymentDraft, key: string, options: PaymentOption[]): PaymentDraft {
  const found = options.find((o) => optionKey(o.for) === key);
  if (!found) return { ...d, optionKey: null, amount: '', collectedAtRink: false };
  const amount = found.amount !== null ? amountText(found.amount) : '';
  return { ...d, optionKey: key, amount, collectedAtRink: key.startsWith('abonament:') ? d.collectedAtRink : false };
}

export function newDraft(i: { athleteId: string | null; today: string; preselect: PaymentFor | null; options: PaymentOption[] }): PaymentDraft {
  const base: PaymentDraft = { athleteId: i.athleteId, amount: '', paidOn: i.today, method: 'numerar', optionKey: null, collectedAtRink: false, sendEmail: false, note: '' };
  return i.preselect ? withOption(base, optionKey(i.preselect), i.options) : base;
}

export function editDraft(p: PaymentRowView): PaymentDraft {
  return {
    athleteId: p.athleteId, amount: amountText(p.amount), paidOn: p.paidOn, method: p.method, optionKey: optionKey(p.for),
    collectedAtRink: p.collectedAtRink, sendEmail: false, note: p.note ?? '',
  };
}

/** The payment's own "Pentru" stays selectable when it is no longer offered (decided 3). */
export function editOptions(options: PaymentOption[], p: PaymentRowView): PaymentOption[] {
  const key = optionKey(p.for);
  if (options.some((o) => optionKey(o.for) === key)) return options;
  return [{ for: p.for, label: p.purposeText, amount: p.amount, isDefault: false }, ...options];
}

export function checkDraft(d: PaymentDraft, today: string): DraftErrors {
  const errors: DraftErrors = {};
  if (parseAmount(d.amount) === null) errors.amount = PAYMENT_COPY.errors.amount;
  if (d.paidOn > today) errors.paidOn = PAYMENT_COPY.errors.future;
  if (d.optionKey === null) errors.for = PAYMENT_COPY.errors.purpose;
  return errors;
}

/** POST /club/payments body (plan 5-3 Task 4); call after `checkDraft` found nothing. */
export function toBody(d: PaymentDraft, options: PaymentOption[]): Record<string, unknown> {
  const chosen = options.find((o) => optionKey(o.for) === d.optionKey);
  const amount = parseAmount(d.amount);
  if (!chosen || amount === null) throw new Error('toBody called with an unchecked draft');
  return {
    athleteId: d.athleteId, amount, paidOn: d.paidOn, method: d.method, for: chosen.for,
    collectedAtRink: showsRink(d) && d.collectedAtRink, note: d.note.trim(), sendEmail: d.sendEmail,
  };
}

/** PUT body: never the athlete, never the e-mail (4.17, C12, C34). */
export function toEditBody(d: PaymentDraft, options: PaymentOption[]): Record<string, unknown> {
  const { athleteId: _athleteId, sendEmail: _sendEmail, ...rest } = toBody(d, options);
  return rest;
}

/** `null` while the athlete's answer is not in yet: disabled, no hint (an unknown address is not "no address"). */
export const emailBox = (hasEmail: boolean | null): { disabled: boolean; hint: string | null } => {
  if (hasEmail === null) return { disabled: true, hint: null };
  return hasEmail ? { disabled: false, hint: null } : { disabled: true, hint: PAYMENT_COPY.noEmail };
};

export const cancelText = (p: PaymentRowView): string => PAYMENT_COPY.cancelConfirm(p.amount, longDate(p.paidOn));
