import { describe, expect, it } from 'vitest';
import type { PaymentOption } from '../../presence/payments/rules';
import type { PaymentRowView } from '../../presence/money-api';
import { amountText, cancelText, checkDraft, editDraft, editOptions, emailBox, groupedOptions, isOverpaid, newDraft, optionGroup, optionHint, parseAmount, showsRink, toBody, withOption } from '../payment-window';

const paymentView = (o: Partial<PaymentRowView>): PaymentRowView => ({
  paymentId: 'p1', athleteId: 'a1', athleteName: 'Ana Ionescu', paidOn: '2026-10-27', purpose: 'abonament', purposeText: 'Abonament', method: 'numerar',
  collectedAtRink: false, amount: 100, recordedBy: 'Admin 1', cancelled: false, for: { kind: 'altceva' }, note: null, ...o,
});

const opts: PaymentOption[] = [
  { for: { kind: 'abonament', subscriptionId: 'sub1' }, label: 'Abonament 8 ședințe (activ din 27 oct)', amount: 320, isDefault: false, owed: 320, paid: 0 },
  { for: { kind: 'cotizatie', seasonId: 's26' }, label: 'Cotizație membru 2026-2027', amount: 100, isDefault: true, owed: 100, paid: 0 },
  { for: { kind: 'club_luna', month: '2026-10' }, label: 'Club, octombrie', amount: 160, isDefault: false, owed: 160, paid: 0 },
  { for: { kind: 'altceva' }, label: 'Altceva', amount: null, isDefault: false, owed: null, paid: 0 }];

describe('payment window rules', () => {
  it('amount text: comma or point, two decimals at most (decided 2)', () => {
    expect(['320', '12,50', '12.5', ' 40 '].map(parseAmount)).toEqual([320, 12.5, 12.5, 40]);
    expect(['', '0', '-3', '12,505', 'abc', '1e3'].map(parseAmount)).toEqual([null, null, null, null, null, null]);
  });
  it('a new payment: today, Numerar, e-mail off, nothing chosen; preselected from De încasat (5.10, C33, C63, p5 Q22)', () => {
    expect(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }))
      .toEqual({ athleteId: 'a1', amount: '', paidOn: '2026-11-20', method: 'numerar', optionKey: null, collectedAtRink: false, sendEmail: false, note: '' });
    expect(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: { kind: 'club_luna', month: '2026-10' }, options: opts })).toMatchObject({ optionKey: 'club_luna:2026-10', amount: '160' });
  });
  it('choosing "Pentru" sets the default amount; rink only for an abonament (C8)', () => {
    const d = withOption(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }), 'abonament:sub1', opts);
    expect([d.amount, showsRink(d)]).toEqual(['320', true]);
    const e = withOption({ ...d, collectedAtRink: true }, 'altceva', opts);
    expect([e.amount, e.collectedAtRink, showsRink(e)]).toEqual(['', false, false]);
  });
  it('a preselected key the options do not hold leaves "Pentru" unchosen (I1)', () => {
    const d = newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: { kind: 'club_luna', month: '2025-01' }, options: opts });
    expect(d).toMatchObject({ optionKey: null, amount: '' });
    expect(checkDraft({ ...d, amount: '5' }, '2026-11-20').for).toBe('Alege pentru ce este plata.');
  });
  it('a default amount with cents shows a comma and two decimals (M4)', () => {
    expect([amountText(12.5), amountText(320), amountText(0.05)]).toEqual(['12,50', '320', '0,05']);
    const o: PaymentOption[] = [{ for: { kind: 'altceva' }, label: 'Altceva', amount: 12.5, isDefault: false, owed: 0, paid: 0 }];
    expect(withOption(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: o }), 'altceva', o).amount).toBe('12,50');
    expect(editDraft(paymentView({ amount: 99.9 })).amount).toBe('99,90');
  });
  it('errors of 5.10', () => {
    const d = newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts });
    expect(checkDraft(d, '2026-11-20')).toEqual({ amount: 'Suma trebuie să fie mai mare decât 0.', for: 'Alege pentru ce este plata.' });
    expect(checkDraft({ ...d, amount: '12,50', optionKey: 'altceva', paidOn: '2026-11-21' }, '2026-11-20')).toEqual({ paidOn: 'Data nu poate fi în viitor.' });
  });
  it('the body sent (plan 5-3 Task 4)', () => {
    const d = { ...withOption(newDraft({ athleteId: 'a1', today: '2026-11-20', preselect: null, options: opts }), 'abonament:sub1', opts), amount: '12,50', sendEmail: true };
    expect(toBody(d, opts)).toEqual({ athleteId: 'a1', amount: 12.5, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'abonament', subscriptionId: 'sub1' }, collectedAtRink: false, note: '', sendEmail: true });
  });
  it('edit keeps the payment\'s own Pentru when it is no longer offered (decided 3)', () => {
    const p = paymentView({ for: { kind: 'lectie', lessonId: 'old' }, purposeText: 'Lecție individuală' });
    expect(editOptions(opts, p)[0]).toMatchObject({ label: 'Lecție individuală', for: { kind: 'lectie', lessonId: 'old' } });
    expect(editDraft(p).sendEmail).toBe(false);
  });
  it('e-mail box disabled without an address; cancel confirmation text (C36, 5.10)', () => {
    expect([emailBox(true), emailBox(false)]).toEqual([{ disabled: false, hint: null }, { disabled: true, hint: 'Sportivul nu are e-mail.' }]);
    expect(emailBox(null)).toEqual({ disabled: true, hint: null });   // M3: no hint before the answer
    expect(cancelText(paymentView({ amount: 320, paidOn: '2026-10-27' }))).toBe('Anulezi plata de 320 RON din 27 oct 2026? Rândul rămâne, marcat anulată.');
  });
});

describe('server refusal under the amount', () => {
  it('only the overpay text belongs under the amount field', () => {
    expect(isOverpaid('Suma depășește restul de plată: 60,50 RON.')).toBe(true);
    expect(isOverpaid('Cerere invalidă.')).toBe(false);
  });
  it('groups and hints', () => {
    const o = (f: PaymentOption['for'], owed: number | null, paid: number): PaymentOption => ({ for: f, label: 'x', amount: owed, isDefault: false, owed, paid });
    const abon380 = o({ kind: 'abonament', subscriptionId: 's' }, 380, 220);
    const fee270 = o({ kind: 'cotizatie', seasonId: 's26' }, 270, 0);
    const paidMonth = o({ kind: 'club_luna', month: '2026-09' }, 0, 340);
    const altceva = o({ kind: 'altceva' }, null, 0);
    const emptyMonth = o({ kind: 'club_luna', month: '2026-11' }, 0, 0);
    expect([optionGroup(abon380), optionHint(abon380)]).toEqual(['due', 'rămas 380 RON']);
    expect(optionHint(fee270)).toBe('270 RON');
    expect([optionGroup(paidMonth), optionHint(paidMonth)]).toEqual(['paid', 'achitat']);
    expect([optionGroup(altceva), optionHint(altceva)]).toEqual(['other', 'orice sumă']);
    expect([optionGroup(emptyMonth), optionHint(emptyMonth)]).toEqual(['other', null]);
    expect(groupedOptions([altceva, paidMonth, abon380]).map((r) => r.group)).toEqual(['De plată', 'Achitate', 'Altele']);
  });
});
