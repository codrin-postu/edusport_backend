import { describe, expect, it } from 'vitest';
import type { PaymentOption } from '../../presence/payments/rules';
import type { PaymentRowView } from '../../presence/money-api';
import { cancelText, checkDraft, editDraft, editOptions, emailBox, newDraft, parseAmount, showsRink, toBody, withOption } from '../payment-window';

const paymentView = (o: Partial<PaymentRowView>): PaymentRowView => ({
  paymentId: 'p1', athleteId: 'a1', athleteName: 'Ana Ionescu', paidOn: '2026-10-27', purpose: 'abonament', purposeText: 'Abonament', method: 'numerar',
  collectedAtRink: false, amount: 100, recordedBy: 'Admin 1', cancelled: false, for: { kind: 'altceva' }, note: null, ...o,
});

const opts: PaymentOption[] = [
  { for: { kind: 'abonament', subscriptionId: 'sub1' }, label: 'Abonament 8 ședințe (activ din 27 oct)', amount: 320, isDefault: false },
  { for: { kind: 'cotizatie', seasonId: 's26' }, label: 'Cotizație membru 2026-2027', amount: 100, isDefault: true },
  { for: { kind: 'club_luna', month: '2026-10' }, label: 'Club, octombrie', amount: 160, isDefault: false },
  { for: { kind: 'altceva' }, label: 'Altceva', amount: null, isDefault: false }];

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
    expect(cancelText(paymentView({ amount: 320, paidOn: '2026-10-27' }))).toBe('Anulezi plata de 320 RON din 27 oct 2026? Rândul rămâne, marcat anulată.');
  });
});
