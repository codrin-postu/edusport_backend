import { describe, expect, it } from 'vitest';
import { G_SEASONS, G_SECTIONS } from '../../groups/__tests__/fake-group-store';
import { readDue } from '../due/reads';
import { athletePayments, listPayments, readPaymentQuery } from '../payments/reads';
import type { AttendanceWrite, LessonRow, SessionRow } from '../types';
import { athleteSubscriptions, listSubscriptions, readSubscriptionQuery } from '../subscriptions/reads';
import { athleteRow, attendanceRow, fakePresenceContext, lessonRow, member, paymentRow, sessionRow, subscriptionRow, type FakePresenceSeed } from './fake-store';

/** Sessions and attendance rows, one session per row; ids are unique so the uniqueKey is too. */
function rows() {
  const sessions: SessionRow[] = [];
  const attendances: (AttendanceWrite & { id: string })[] = [];
  let n = 0;
  const add = (athleteId: string, groupId: string, date: string, over: Partial<AttendanceWrite>): void => {
    n += 1;
    const sessionId = `ss-${n}`;
    sessions.push(sessionRow({ id: sessionId, groupId, date }));
    attendances.push(attendanceRow({ id: `t-${n}`, sessionId, athleteId, uniqueKey: `${sessionId}|${athleteId}`, ...over }));
  };
  const slots = (athleteId: string, subscriptionId: string, count: number): void => {
    for (let i = 0; i < count; i += 1) add(athleteId, 'g-ib', '2026-11-02', { billing: 'slot', subscriptionId, grup: true, charges: [], amount: 0 });
  };
  const club = (athleteId: string, groupId: string, date: string, uscat = false): void => {
    const charges = [{ type: 'grup' as const, itemName: 'Ședință grup', price: 40, included: false }];
    if (uscat) charges.push({ type: 'uscat' as const, itemName: 'Uscat', price: 20, included: true });
    add(athleteId, groupId, date, { billing: 'club', grup: true, uscat, charges, amount: 40 });
  };
  slots('a1', 'sa', 5);
  slots('a1', 'sa-old', 8);
  slots('a2', 'sb', 2);
  slots('a3', 'sm', 8);
  slots('a4', 'sd', 3);
  for (const date of ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']) club('a3', 'g-pro', date);
  club('a4', 'g-av', '2026-10-06', true);
  club('a4', 'g-av', '2026-10-08', true);
  for (const date of ['2026-10-13', '2026-10-15', '2026-10-20']) club('a4', 'g-av', date);
  for (const date of ['2026-10-07', '2026-10-09', '2026-10-14', '2026-10-16', '2026-10-21', '2026-10-23']) club('a5', 'g-av', date);
  return { sessions, attendances };
}

function listSeed(): FakePresenceSeed {
  const { sessions, attendances } = rows();
  const lessons: LessonRow[] = [
    lessonRow({ id: 'l-absent', athleteId: 'a1', date: '2026-10-22', state: 'saved', present: false, price: 80, amount: 0 }),
    lessonRow({ id: 'ld', athleteId: 'a4', date: '2026-10-17', state: 'saved', present: true, price: 60, amount: 60, itemName: 'Lecție individuală' }),
    lessonRow({ id: 'lm', athleteId: 'a3', date: '2026-10-19', state: 'saved', present: true, price: 180, amount: 180, itemName: 'Lecție individuală' }),
  ];
  return {
    group: {
      seasons: G_SEASONS,
      sections: G_SECTIONS,
      athletes: [
        athleteRow({ id: 'a1', name: 'Ana Ionescu', email: 'ana@example.com' }),
        athleteRow({ id: 'a2', name: 'Sofia Dinu' }),
        athleteRow({ id: 'a3', name: 'Matei Popescu' }),
        athleteRow({ id: 'a4', name: 'David Stan', email: 'david@example.com' }),
        athleteRow({ id: 'a5', name: 'Ioana Dinu' }),
        athleteRow({ id: 'a9', name: 'Sportiv anonimizat', status: 'anonimizat' }),
      ],
      memberships: [
        member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }),
        member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }),
        member({ id: 'm3', athleteId: 'a3', groupId: 'g-pro' }),
        member({ id: 'm4', athleteId: 'a4', groupId: 'g-av' }),
        member({ id: 'm5', athleteId: 'a5', groupId: 'g-av' }),
      ],
      admins: { 'admin@example.com': 'Admin Test' },
    },
    subscriptions: [
      subscriptionRow({ id: 'sa', athleteId: 'a1' }),
      subscriptionRow({ id: 'sa-old', athleteId: 'a1', seasonId: 's25', startsOn: '2026-09-29', validUntil: '2026-10-26' }),
      subscriptionRow({ id: 'sb', athleteId: 'a2', startsOn: '2026-10-22', validUntil: '2026-11-21' }),
      subscriptionRow({ id: 'sm', athleteId: 'a3', startsOn: '2026-10-05', validUntil: '2026-11-10' }),
      subscriptionRow({ id: 'sd', athleteId: 'a4', startsOn: '2026-10-01', validUntil: '2026-10-30' }),
    ],
    payments: [
      paymentRow({ id: 'p-1', athleteId: 'a1', amount: 320, paidOn: '2026-10-27', purpose: 'abonament', subscriptionId: 'sa', method: 'numerar' }),
      paymentRow({ id: 'p-2', athleteId: 'a3', amount: 340, paidOn: '2026-10-26', purpose: 'club_luna', clubMonth: '2026-09', method: 'transfer' }),
      paymentRow({ id: 'p-3', athleteId: 'a1', amount: 80, paidOn: '2026-10-22', purpose: 'lectie', lessonId: 'l-absent', method: 'numerar', cancelled: true, cancelledAt: '2026-10-22T12:00:00.000Z', cancelledBy: 'admin@example.com' }),
      paymentRow({ id: 'p-4', athleteId: 'a1', amount: 320, paidOn: '2026-09-29', purpose: 'abonament', subscriptionId: 'sa-old', seasonId: 's25' }),
      paymentRow({ id: 'p-5', athleteId: 'a3', amount: 320, paidOn: '2026-11-02', purpose: 'abonament', subscriptionId: 'sm' }),
      paymentRow({ id: 'p-6', athleteId: 'a4', amount: 320, paidOn: '2026-11-03', purpose: 'abonament', subscriptionId: 'sd' }),
      paymentRow({ id: 'p-7', athleteId: 'a4', amount: 100, paidOn: '2026-11-03', purpose: 'club_luna', clubMonth: '2026-10' }),
      paymentRow({ id: 'p-8', athleteId: 'a5', amount: 240, paidOn: '2026-11-03', purpose: 'club_luna', clubMonth: '2026-10' }),
    ],
    sessions,
    attendances,
    lessons,
    startDate: '2026-10-01',
  };
}

describe('money reads', () => {
  it('Abonamente: default Active, Grupă = main group today, sorted by expiry, cancel hidden with a payment (5.9, C58, C75)', async () => {
    const f = fakePresenceContext(listSeed());
    const page = await listSubscriptions(f.store, readSubscriptionQuery({}), '2026-11-20');
    expect(page.rows.map((r) => [r.athleteName, r.groupName, `${r.used}/${r.slots}`, r.validUntil, r.state, r.canCancel])).toEqual([
      ['Sofia Dinu', 'Intermediari Bronze', '2/8', '2026-11-21', 'activ', true],
      ['Ana Ionescu', 'Intermediari Bronze', '5/8', '2026-11-23', 'activ', false]]);
    const all = await listSubscriptions(f.store, readSubscriptionQuery({ state: 'toate' }), '2026-11-20');
    expect(all.rows.find((r) => r.state === 'expirat')?.expired).toBe(true);
    expect((await listSubscriptions(f.store, readSubscriptionQuery({ state: 'epuizate' }), '2026-11-20')).rows.map((r) => r.athleteName)).toEqual(['Matei Popescu']);
  });

  it('athlete abonament tab: groups of the season, active bars, earlier ones (5.7)', async () => {
    const f = fakePresenceContext(listSeed());
    expect(await athleteSubscriptions(f.store, 'a1', 's26', '2026-11-20')).toEqual({
      groups: [{ name: 'Intermediari Bronze', main: true }],
      bars: [{ subscriptionId: 'sa', itemName: 'Abonament 8 ședințe', slots: 8, used: 5, validUntil: '2026-11-23' }],
      earlier: [{ itemName: 'Abonament 8 ședințe', startsOn: '2026-09-29', validUntil: '2026-10-26', used: 8, slots: 8, state: 'epuizat' }] });
  });

  it('Plăți list: month, filters, newest first, total without cancelled (5.10, C62)', async () => {
    const f = fakePresenceContext(listSeed());
    const list = await listPayments(f.store, readPaymentQuery({ month: '2026-10' }, '2026-11-20'), '2026-11-20');
    expect(list.rows.map((r) => [r.paidOn, r.purposeText, r.cancelled])).toEqual([
      ['2026-10-27', 'Abonament 8 ședințe', false], ['2026-10-26', 'Club, septembrie', false], ['2026-10-22', 'Lecție individuală', true]]);
    expect(list.total).toBe(660);
    expect((await listPayments(f.store, readPaymentQuery({ month: '2026-10', method: 'transfer' }, '2026-11-20'), '2026-11-20')).rows).toHaveLength(1);
    expect((await listPayments(f.store, readPaymentQuery({ month: '2026-10', purpose: 'club_luna' }, '2026-11-20'), '2026-11-20')).total).toBe(340);
  });

  it('De încasat: Școala part ignores the month; Club part owing first; notice count (5.11, p5 Q34, C64)', async () => {
    const f = fakePresenceContext(listSeed());
    const due = await readDue(f.store, '2026-10', '2026-11-20');
    expect(due.school.map((r) => [r.athleteName, r.groupName, r.price, r.paid, r.left])).toEqual([['Sofia Dinu', 'Intermediari Bronze', 320, 0, 320]]);
    expect(due.club.map((r) => [r.athleteName, r.groupNames, r.due, r.paid, r.left])).toEqual([
      ['Matei Popescu', 'Profesioniști', 340, 0, 340], ['David Stan', 'Avansați', 260, 100, 160], ['Ioana Dinu', 'Avansați', 240, 240, 0]]);
    expect(due.groupsWithoutList).toBe(1);
    expect((await readDue(f.store, '2026-09', '2026-11-20')).club).toEqual([]);   // before the start date 2026-10-01
  });

  it('athlete Plăți tab: months newest first with detail lines; read-only when anonymized (5.7, C52)', async () => {
    const f = fakePresenceContext(listSeed());
    const tab = await athletePayments(f.store, 'a4', '2026-11-20');
    expect(tab?.months[0]).toMatchObject({ month: '2026-10', grup: 5, uscat: 2, due: 260, paid: 100, left: 160 });
    expect(tab?.months[0].lines[0]).toBe('Mar 6 oct, Avansați, Grup 40 RON, Uscat inclus');
    expect((await athletePayments(f.store, 'a9', '2026-11-20'))?.readOnly).toBe(true);
    expect(await athletePayments(f.store, 'missing', '2026-11-20')).toBeNull();
  });
});
