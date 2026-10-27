import { describe, expect, it } from 'vitest';
import type { SeasonRecord } from '../../groups/types';
import { lessonRow, paymentRow, subscriptionRow } from './fake-store';
import type { ClubMonth } from '../due/settlement';
import {
  acsOnFee, acsRevert, listPurposeText, paymentFieldChanges, paymentOptions, purposeFields, purposeText, readAmount, readNewPayment, sameFor,
} from '../payments/rules';

const today = '2026-11-20';
const SEASONS: SeasonRecord[] = [
  { id: 's25', label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', isCurrent: false, membershipFee: 100 },
  { id: 's26', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', isCurrent: true, membershipFee: 100 },
];
const month = (m: string, over: Partial<ClubMonth> = {}): ClubMonth => ({ month: m, grup: 0, uscat: 0, lessons: 0, due: 0, paid: 0, left: 0, groupIds: [], lines: [], ...over });
const body = (over: object) => ({ athleteId: 'a1', amount: 320, paidOn: '2026-11-20', method: 'numerar', for: { kind: 'altceva' }, collectedAtRink: false, note: '', sendEmail: false, ...over });
const invalid = { ok: false, status: 400, error: 'Cerere invalidă.' };

describe('payment input', () => {
  it('amounts: two decimals, more than 0, at most 100000, stored rounded (decided 2)', () => {
    expect([readAmount(12.5), readAmount(0.1 + 0.2), readAmount(100000)].map((r) => r.ok && r.value)).toEqual([12.5, 0.3, 100000]);
    expect(readAmount(0)).toEqual({ ok: false, status: 400, error: 'Suma trebuie să fie mai mare decât 0.' });
    expect(readAmount(-5)).toEqual({ ok: false, status: 400, error: 'Suma trebuie să fie mai mare decât 0.' });
    expect([readAmount(12.345), readAmount(0.004), readAmount(100000.01), readAmount('320'), readAmount(Number.NaN)].map((r) => r.ok === false && r.error))
      .toEqual(['Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.', 'Cerere invalidă.']);
  });
  it('date not in the future, a purpose, a method (5.10)', () => {
    expect(readNewPayment(body({ paidOn: '2026-11-21' }), today)).toEqual({ ok: false, status: 400, error: 'Data nu poate fi în viitor.' });
    expect(readNewPayment(body({ for: null }), today)).toEqual({ ok: false, status: 400, error: 'Alege pentru ce este plata.' });
    expect(readNewPayment(body({ for: { kind: 'club_luna', month: '2026-13' } }), today).ok).toBe(false);
    expect(readNewPayment(body({ method: 'cec' }), today)).toEqual(invalid);
    expect(readNewPayment(body({ paidOn: '2026-02-30' }), today)).toEqual(invalid);
    expect(readNewPayment(body({ athleteId: '' }), today)).toEqual(invalid);
    expect(readNewPayment(body({ note: '  ' }), today)).toMatchObject({ ok: true, value: { note: null, sendEmail: false } });
    expect(readNewPayment(body({ sendEmail: 'true' }), today)).toMatchObject({ ok: true, value: { sendEmail: false } });
    expect(readNewPayment(body({ sendEmail: true }), today)).toMatchObject({ ok: true, value: { sendEmail: true } });
  });
});

describe('purpose', () => {
  it('purpose fields: fee season chosen, others the season of the date; rink only for abonament (3.5, C8)', () => {
    expect(purposeFields({ kind: 'cotizatie', seasonId: 's25' }, true, 's26')).toEqual({ purpose: 'cotizatie', subscriptionId: null, lessonId: null, clubMonth: null, seasonId: 's25', collectedAtRink: false });
    expect(purposeFields({ kind: 'abonament', subscriptionId: 'sub1' }, true, 's26')).toEqual({ purpose: 'abonament', subscriptionId: 'sub1', lessonId: null, clubMonth: null, seasonId: 's26', collectedAtRink: true });
    expect(purposeFields({ kind: 'club_luna', month: '2026-09' }, false, 's26')).toMatchObject({ purpose: 'club_luna', clubMonth: '2026-09' });
    const p = paymentRow({ purpose: 'club_luna', clubMonth: '2026-09' });
    expect(sameFor(p, purposeFields({ kind: 'club_luna', month: '2026-09' }, false, 's26'))).toBe(true);
    expect(sameFor(p, purposeFields({ kind: 'club_luna', month: '2026-10' }, false, 's26'))).toBe(false);
  });
  it('"Pentru" texts (5.10, C61, decided 17)', () => {
    expect(purposeText({ purpose: 'abonament', clubMonth: null }, { itemName: 'Abonament 8 ședințe' })).toBe('Abonament 8 ședințe');
    expect(purposeText({ purpose: 'abonament', clubMonth: null }, { itemName: 'Abonament 8 ședințe', startsOn: '2026-11-03' })).toBe('Abonament 8 ședințe (activ din 3 noi)');
    expect(purposeText({ purpose: 'club_luna', clubMonth: '2026-09' }, {})).toBe('Club, septembrie');
    expect(purposeText({ purpose: 'cotizatie', clubMonth: null }, { seasonLabel: '2026-2027' })).toBe('Cotizație membru 2026-2027');
    expect(purposeText({ purpose: 'lectie', clubMonth: null }, {})).toBe('Lecție individuală');
    expect(listPurposeText({ purpose: 'altceva', clubMonth: null, note: 'o ședință plătită la intrare ieri' }, {})).toBe('Altceva, o ședință plătită la');
    expect(listPurposeText({ purpose: 'altceva', clubMonth: null, note: null }, {})).toBe('Altceva');
    expect(listPurposeText({ purpose: 'lectie', clubMonth: null, note: 'ignorată' }, {})).toBe('Lecție individuală');
  });
  it('options and default amounts (4.15, C33, decided 4 and 5)', () => {
    const sub = subscriptionRow({ id: 'sub1', startsOn: '2026-10-27', price: 320 });
    const paid = paymentRow({ id: 'p1', purpose: 'abonament', subscriptionId: 'sub1', amount: 100 });
    const gone = paymentRow({ id: 'p2', purpose: 'abonament', subscriptionId: 'sub1', amount: 50, cancelled: true });
    const opts = paymentOptions({ subs: [sub, subscriptionRow({ id: 'x', cancelled: true })], payments: [paid, gone], seasons: SEASONS,
      months: [month('2026-09', { due: 340, paid: 400 }), month('2025-10', { due: 80 })], lessons: [lessonRow({ id: 'l1', date: '2026-10-28', state: 'saved', present: true, price: 80, amount: 80 })], today });
    expect(opts.map((o) => [o.label, o.amount])).toEqual([
      ['Abonament 8 ședințe (activ din 27 oct)', 220],
      ['Cotizație membru 2026-2027', 100], ['Cotizație membru 2025-2026', 100],
      ['Club, noiembrie', 0], ['Club, septembrie', 0],
      ['Lecție individuală, 28 oct 2026', 80],
      ['Altceva', null]]);
    expect(opts.find((o) => o.isDefault && o.for.kind === 'cotizatie')?.label).toBe('Cotizație membru 2026-2027');
    expect(opts.filter((o) => o.isDefault)).toHaveLength(1);
  });
  it('a Club month with a balance defaults to it; an overpaid abonament and an absent lesson are not below 0 or listed', () => {
    const sub = subscriptionRow({ id: 'sub1', price: 100 });
    const opts = paymentOptions({ subs: [sub], payments: [paymentRow({ id: 'p1', purpose: 'abonament', subscriptionId: 'sub1', amount: 150 })], seasons: [],
      months: [month('2026-11', { due: 160, paid: 130, left: 30 })], lessons: [lessonRow({ id: 'l1', date: '2026-11-02', state: 'saved', present: false, price: 80 })], today });
    expect(opts.map((o) => [o.label, o.amount])).toEqual([['Abonament 8 ședințe (activ din 27 oct)', 0], ['Club, noiembrie', 30], ['Altceva', null]]);
  });
});

describe('A.C.S. effect and history', () => {
  it('a fee sets A.C.S. Da and keeps the state before; the revert only when no other fee and still Da (4.16, 4.17, C9, decided 6)', () => {
    expect([acsOnFee(null), acsOnFee('nu'), acsOnFee('da')]).toEqual([{ set: true, acsBefore: null }, { set: true, acsBefore: 'nu' }, { set: false, acsBefore: 'da' }]);
    const fee = paymentRow({ id: 'f1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu' });
    expect(acsRevert(fee, [], 'da')).toEqual({ revert: true, to: 'nu' });
    expect(acsRevert({ ...fee, acsBefore: null }, [], 'da')).toEqual({ revert: true, to: null });
    expect(acsRevert(fee, [paymentRow({ id: 'f2', purpose: 'cotizatie', seasonId: 's26' })], 'da').revert).toBe(false);
    expect(acsRevert(fee, [paymentRow({ id: 'f2', purpose: 'cotizatie', seasonId: 's26', cancelled: true })], 'da').revert).toBe(true);
    expect(acsRevert(fee, [paymentRow({ id: 'f3', purpose: 'cotizatie', seasonId: 's25' })], 'da').revert).toBe(true);
    expect(acsRevert(fee, [], 'nu').revert).toBe(false);
    expect(acsRevert({ ...fee, acsBefore: 'da' }, [], 'da').revert).toBe(false);
    expect(acsRevert(paymentRow({ id: 'x', purpose: 'altceva' }), [], 'da').revert).toBe(false);
  });
  it('field changes for history, purpose as text (4.17, 8)', () => {
    const before = paymentRow({ id: 'p', amount: 300, method: 'numerar', note: null });
    expect(paymentFieldChanges(before, { ...before, amount: 320, method: 'card' }, { before: 'Altceva', after: 'Altceva' }))
      .toEqual({ amount: { from: 300, to: 320 }, method: { from: 'numerar', to: 'card' } });
    expect(paymentFieldChanges(before, { ...before }, { before: 'Altceva', after: 'Club, septembrie' })).toEqual({ purposeText: { from: 'Altceva', to: 'Club, septembrie' } });
  });
});
