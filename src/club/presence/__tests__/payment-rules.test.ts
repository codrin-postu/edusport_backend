import { describe, expect, it } from 'vitest';
import type { SeasonRecord } from '../../groups/types';
import { attendanceRow, lessonRow, paymentRow, subscriptionRow } from './fake-store';
import type { ClubMonth } from '../due/settlement';
import {
  acsOnFee, acsRevert, listPurposeText, overpayText, owedFor, paymentFieldChanges, paymentOptions, purposeFields, purposeText, readAmount, readNewPayment, sameFor,
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
  it('an extra month is offered even when nothing is due or it is older than 12 months (I1)', () => {
    const months = [month('2025-05', { due: 0, paid: 20, left: -20 })];
    const base = { subs: [], payments: [], seasons: [], months, lessons: [], today };
    expect(paymentOptions(base).map((o) => o.label)).toEqual(['Club, noiembrie', 'Altceva']);
    const withExtra = paymentOptions({ ...base, extraMonth: '2025-05' });
    expect(withExtra.map((o) => [o.label, o.amount])).toEqual([['Club, noiembrie', 0], ['Club, mai', 0], ['Altceva', null]]);
    expect(paymentOptions({ ...base, extraMonth: 'nope' }).map((o) => o.label)).toEqual(['Club, noiembrie', 'Altceva']);
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
  it('two fees of one season: the order of the cancels does not matter (final review M4)', () => {
    const first = paymentRow({ id: 'f1', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'nu', recordedAt: '2026-10-01T10:00:00.000Z' });
    const second = paymentRow({ id: 'f2', purpose: 'cotizatie', seasonId: 's26', acsBefore: 'da', recordedAt: '2026-10-02T10:00:00.000Z' });
    expect(acsRevert({ ...first, cancelled: true }, [{ ...second }], 'da').revert).toBe(false);
    expect(acsRevert({ ...second, cancelled: true }, [{ ...first, cancelled: true }], 'da')).toEqual({ revert: true, to: 'nu' });
    expect(acsRevert({ ...first, cancelled: true }, [{ ...second, cancelled: true }], 'da')).toEqual({ revert: true, to: 'nu' });
  });
  it('field changes for history, purpose as text (4.17, 8)', () => {
    const before = paymentRow({ id: 'p', amount: 300, method: 'numerar', note: null });
    expect(paymentFieldChanges(before, { ...before, amount: 320, method: 'card' }, { before: 'Altceva', after: 'Altceva' }))
      .toEqual({ amount: { from: 300, to: 320 }, method: { from: 'numerar', to: 'card' } });
    expect(paymentFieldChanges(before, { ...before }, { before: 'Altceva', after: 'Club, septembrie' })).toEqual({ purposeText: { from: 'Altceva', to: 'Club, septembrie' } });
  });
});

describe('what is still owed (DEC 2026-11-03)', () => {
  const src = (over: object = {}) => ({ subs: [subscriptionRow({ id: 's1', price: 320 })], payments: [], seasons: SEASONS, lessons: [], attendances: [], startDate: null, ...over });
  const pays = [
    paymentRow({ id: 'a', purpose: 'abonament', subscriptionId: 's1', amount: 100 }),
    paymentRow({ id: 'x', purpose: 'abonament', subscriptionId: 's1', amount: 999, cancelled: true }),
    paymentRow({ id: 'f', purpose: 'cotizatie', seasonId: 's26', amount: 40.5 }),
    paymentRow({ id: 'l', purpose: 'lectie', lessonId: 'l1', amount: 30 }),
  ];
  const lesson = lessonRow({ id: 'l1', date: '2026-10-28', state: 'saved', present: true, price: 80, amount: 80 });

  it('abonament price, fee, lesson price minus live payments; Club month left; never below 0', () => {
    expect(owedFor({ kind: 'abonament', subscriptionId: 's1' }, src({ payments: pays }))).toBe(220);
    expect(owedFor({ kind: 'cotizatie', seasonId: 's26' }, src({ payments: pays }))).toBe(59.5);
    expect(owedFor({ kind: 'lectie', lessonId: 'l1' }, src({ payments: pays, lessons: [lesson] }))).toBe(50);
    const club = attendanceRow({ id: 't1', athleteId: 'a1', billing: 'club', amount: 100 });
    const sources = src({ attendances: [{ ...club, sessionDate: '2026-10-06', groupId: 'g', charges: [] }], payments: [paymentRow({ id: 'c', purpose: 'club_luna', clubMonth: '2026-10', amount: 60 })] });
    expect(owedFor({ kind: 'club_luna', month: '2026-10' }, sources)).toBe(40);
    expect(owedFor({ kind: 'club_luna', month: '2026-09' }, sources)).toBe(0);
    expect(owedFor({ kind: 'abonament', subscriptionId: 's1' }, src({ payments: [paymentRow({ id: 'o', purpose: 'abonament', subscriptionId: 's1', amount: 400 })] }))).toBe(0);
  });
  it('Altceva and a missing price have no limit', () => {
    expect(owedFor({ kind: 'altceva' }, src())).toBeNull();
    expect(owedFor({ kind: 'abonament', subscriptionId: 's1' }, src({ subs: [subscriptionRow({ id: 's1', price: null })] }))).toBeNull();
    expect(owedFor({ kind: 'lectie', lessonId: 'l1' }, src({ lessons: [{ ...lesson, price: null }] }))).toBeNull();
    expect(owedFor({ kind: 'cotizatie', seasonId: 's26' }, src({ seasons: [{ ...SEASONS[1], membershipFee: null }] }))).toBeNull();
  });
  it('an edited payment counts its own amount as owed', () => {
    const sources = src({ payments: pays });
    expect(owedFor({ kind: 'abonament', subscriptionId: 's1' }, sources, 'a')).toBe(320);
    expect(owedFor({ kind: 'abonament', subscriptionId: 's1' }, sources, 'f')).toBe(220);
  });
  it('refuses at due + 0.01, accepts exactly the due, text with RON like other amounts', () => {
    expect(overpayText(220.01, 220)).toBe('Suma depășește restul de plată: 220 RON.');
    expect(overpayText(60.51, 60.5)).toBe('Suma depășește restul de plată: 60,50 RON.');
    expect(overpayText(220, 220)).toBeNull();
    expect(overpayText(0.3, 0.1 + 0.2)).toBeNull();
    expect(overpayText(1e6, null)).toBeNull();
  });
});
