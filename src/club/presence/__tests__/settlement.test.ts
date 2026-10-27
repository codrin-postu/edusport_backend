import { describe, expect, it } from 'vitest';
import { member } from '../../groups/__tests__/fake-group-store';
import { attendanceRow, lessonRow, P_GROUPS, paymentRow, subscriptionRow } from './fake-store';
import type { AttendanceRow } from '../types';
import { clubMonths, isClubAttendance, mainGroupToday, schoolDue } from '../due/settlement';
import { PAYMENT_COPY } from '../copy';

const att = (id: string, date: string, over: object): AttendanceRow => ({ ...attendanceRow({ id, athleteId: 'a1', ...over }), sessionDate: date, groupId: (over as { groupId?: string }).groupId ?? 'g-av' });
const grup = (price: number | null, included = false) => ({ type: 'grup' as const, itemName: 'Ședință grup', price, included });
const uscat = (price: number | null, included = false) => ({ type: 'uscat' as const, itemName: 'Uscat', price, included });

describe('month settlement', () => {
  it('a month: counts by type, due, paid (Club month and lesson payments), left (4.14, C31)', () => {
    const months = clubMonths({
      attendances: [att('t1', '2026-10-06', { grup: true, uscat: true, billing: 'club', charges: [grup(40), uscat(20, true)], amount: 40 }),
        att('t2', '2026-10-13', { grup: true, billing: 'club', charges: [grup(40)], amount: 40 }),
        att('t3', '2026-10-20', { grup: true, billing: 'fara_abonament', groupId: 'g-ib', charges: [], amount: 0 })],
      lessons: [lessonRow({ id: 'l1', date: '2026-10-28', state: 'saved', present: true, price: 80, amount: 80 }), lessonRow({ id: 'l2', date: '2026-10-29', state: 'saved', present: false, amount: 0 })],
      payments: [paymentRow({ id: 'p1', purpose: 'club_luna', clubMonth: '2026-10', amount: 50 }), paymentRow({ id: 'p2', purpose: 'lectie', lessonId: 'l1', amount: 80 }),
        paymentRow({ id: 'p3', purpose: 'club_luna', clubMonth: '2026-10', amount: 500, cancelled: true })],
      groupNames: new Map([['g-av', 'Avansați']]), startDate: '2026-10-01' });
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ month: '2026-10', grup: 2, uscat: 1, lessons: 1, due: 160, paid: 130, left: 30, groupIds: ['g-av'] });
    expect(months[0].lines.map((l) => l.date)).toEqual(['2026-10-06', '2026-10-13', '2026-10-28']);
    expect(months[0].lines[0]).toMatchObject({ groupName: 'Avansați', lesson: null });
    expect(months[0].lines[2]).toMatchObject({ groupName: null, lesson: { price: 80 } });
    expect(PAYMENT_COPY.sessionsText(2, 1, 1)).toBe('4 (2 grup, 1 uscat, 1 individuală)');
    expect(PAYMENT_COPY.sessionsText(6, 0, 0)).toBe('6 (6 grup)');
  });
  it('months newest first; a month with only a payment is listed (decided 15)', () => {
    const months = clubMonths({
      attendances: [att('t', '2026-09-08', { grup: true, billing: 'club', charges: [grup(40)], amount: 40 })], lessons: [],
      payments: [paymentRow({ id: 'p', purpose: 'club_luna', clubMonth: '2026-11', amount: 40 })], groupNames: new Map(), startDate: null });
    expect(months.map((m) => [m.month, m.due, m.paid, m.left])).toEqual([['2026-11', 0, 40, -40], ['2026-09', 40, 0, 40]]);
  });
  it('negative left, months before the start date hidden, no start date no limit (C32, C13, decided 14)', () => {
    const pay = paymentRow({ id: 'p', purpose: 'club_luna', clubMonth: '2026-09', amount: 400 });
    const a = att('t', '2026-09-08', { grup: true, billing: 'club', charges: [grup(40)], amount: 40 });
    expect(clubMonths({ attendances: [a], lessons: [], payments: [pay], groupNames: new Map(), startDate: null })[0]).toMatchObject({ due: 40, paid: 400, left: -360 });
    expect(clubMonths({ attendances: [a], lessons: [], payments: [pay], groupNames: new Map(), startDate: '2026-10-01' })).toEqual([]);
  });
  it('sums without float noise (Review Focus)', () => {
    const a = [1, 2, 3].map((i) => att(`t${i}`, `2026-10-0${i}`, { grup: true, billing: 'club', charges: [grup(0.1)], amount: 0.1 }));
    expect(clubMonths({ attendances: a, lessons: [], payments: [paymentRow({ id: 'p', purpose: 'club_luna', clubMonth: '2026-10', amount: 0.3 })], groupNames: new Map(), startDate: null })[0])
      .toMatchObject({ due: 0.3, paid: 0.3, left: 0 });
    const pays = [1, 2, 3].map((i) => paymentRow({ id: `p${i}`, purpose: 'abonament', subscriptionId: 's', amount: 33.33 }));
    expect(schoolDue([subscriptionRow({ id: 's', price: 100 })], pays)[0]).toMatchObject({ price: 100, paid: 99.99, left: 0.01 });
  });
  it('Școala part: price minus non-cancelled payments > 0, cancelled and unpriced out, by start date (4.14, p5 Q34, C76)', () => {
    const subs = [subscriptionRow({ id: 'b', startsOn: '2026-10-27', price: 320 }), subscriptionRow({ id: 'a', startsOn: '2026-10-20', price: 260 }),
      subscriptionRow({ id: 'paid', price: 320 }), subscriptionRow({ id: 'off', price: 320, cancelled: true }), subscriptionRow({ id: 'free', price: null })];
    const pays = [paymentRow({ id: 'p1', purpose: 'abonament', subscriptionId: 'a', amount: 100 }), paymentRow({ id: 'p2', purpose: 'abonament', subscriptionId: 'paid', amount: 320 }),
      paymentRow({ id: 'p3', purpose: 'abonament', subscriptionId: 'b', amount: 320, cancelled: true })];
    expect(schoolDue(subs, pays).map((r) => [r.subscriptionId, r.paid, r.left])).toEqual([['a', 100, 160], ['b', 0, 320]]);
  });
  it('"Fără abonament" attendance is never in any due (p5 Q39)', () => {
    const a = att('t', '2026-10-20', { groupId: 'g-ib', grup: true, billing: 'fara_abonament', charges: [], amount: 0 });
    expect(isClubAttendance(a)).toBe(false);
    expect(isClubAttendance({ billing: 'slot' })).toBe(false);
    expect(clubMonths({ attendances: [a], lessons: [], payments: [], groupNames: new Map(), startDate: null })).toEqual([]);
  });
  it('detail lines (decided 19)', () => {
    expect([PAYMENT_COPY.chargeText(grup(40)), PAYMENT_COPY.chargeText(uscat(20, true)), PAYMENT_COPY.chargeText(grup(null))]).toEqual(['Grup 40 RON', 'Uscat inclus', 'Grup fără preț']);
    expect(PAYMENT_COPY.lessonLine('2026-10-28', 80)).toBe('Mie 28 oct, Lecție individuală 80 RON');
    expect(PAYMENT_COPY.lessonLine('2026-10-28', null)).toBe('Mie 28 oct, Lecție individuală fără preț');
  });
  it('main group today: current main membership of the season only', () => {
    const m = [member({ id: '1', athleteId: 'a1', groupId: 'g-ib', isMain: true, seasonId: 's26' }), member({ id: '2', athleteId: 'a2', groupId: 'g-av', isMain: false, seasonId: 's26' }),
      { ...member({ id: '3', athleteId: 'a3', groupId: 'g-ib', isMain: true, seasonId: 's26' }), to: '2026-11-01' }, member({ id: '4', athleteId: 'a4', groupId: 'g-ib', isMain: true, seasonId: 's25' })];
    expect([...mainGroupToday(m, P_GROUPS, 's26')].map(([id, g]) => [id, g.id])).toEqual([['a1', 'g-ib']]);
    expect(mainGroupToday(m, P_GROUPS, null).size).toBe(0);
  });
});
