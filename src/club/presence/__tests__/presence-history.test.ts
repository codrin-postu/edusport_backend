import { describe, expect, it } from 'vitest';
import { G_SEASONS, G_SECTIONS } from '../../groups/__tests__/fake-group-store';
import type { HistoryRow } from '../attendance/api-types';
import { payLabel } from '../history/pay';
import { readPresenceHistory } from '../history/read';
import type { AttendanceWrite, SessionRow } from '../types';
import { athleteRow, attendanceRow, fakePresenceContext, lessonRow, member, paymentRow, sessionRow, subscriptionRow, type FakePresenceSeed } from './fake-store';

const ATH = 'a1';
const SEASON = 's26';

function seed(): FakePresenceSeed {
  const sessions: SessionRow[] = [];
  const attendances: (AttendanceWrite & { id: string })[] = [];
  let n = 0;
  const add = (groupId: string, date: string, over: Partial<AttendanceWrite>): void => {
    n += 1;
    sessions.push(sessionRow({ id: `ss-${n}`, groupId, date, startTime: '17:00' }));
    attendances.push(attendanceRow({ id: `t-${String(n).padStart(2, '0')}`, sessionId: `ss-${n}`, athleteId: ATH, uniqueKey: `k${n}`, ...over }));
  };
  const slot = (subscriptionId: string, date: string): void => add('g-ib', date, { billing: 'slot', subscriptionId });
  ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21'].forEach((d) => slot('sub-1', d));
  ['2026-10-26', '2026-10-28', '2026-11-02'].forEach((d) => slot('sub-2', d));
  const club = (date: string, amount: number): void => add('g-av', date, { billing: 'club', charges: [{ type: 'grup', itemName: 'Ședință grup', price: amount, included: false }], amount });
  club('2026-11-04', 200);
  club('2026-11-06', 200);
  club('2026-10-30', 40);
  add('g-ib', '2026-11-09', { billing: 'fara_abonament' });
  return {
    group: {
      seasons: G_SEASONS, sections: G_SECTIONS,
      athletes: [athleteRow({ id: ATH, name: 'Ana Ionescu' })], memberships: [member({ id: 'm1', athleteId: ATH, groupId: 'g-ib' })],
    },
    sessions, attendances,
    subscriptions: [
      subscriptionRow({ id: 'sub-1', code: 'A-0001', slots: 8, startsOn: '2026-10-05', validUntil: '2026-11-01' }),
      subscriptionRow({ id: 'sub-2', code: 'A-0002', slots: 8, startsOn: '2026-10-26', validUntil: '2026-11-23' }),
    ],
    lessons: [
      lessonRow({ id: 'l-paid', date: '2026-12-10', state: 'saved', present: true, price: 150, amount: 150, coachIds: ['tm-andreea'] }),
      lessonRow({ id: 'l-unpaid', date: '2026-12-11', state: 'saved', present: true, price: 150, amount: 150, coachIds: ['tm-andreea', 'tm-virgil'] }),
      lessonRow({ id: 'l-absent', date: '2026-12-12', state: 'saved', present: false, price: 150, amount: 0 }),
    ],
    payments: [
      paymentRow({ id: 'p-club-nov', purpose: 'club_luna', clubMonth: '2026-11', amount: 200, paidOn: '2026-11-08' }),
      paymentRow({ id: 'p-club-oct', purpose: 'club_luna', clubMonth: '2026-10', amount: 40, paidOn: '2026-10-31' }),
      paymentRow({ id: 'p-lesson', purpose: 'lectie', lessonId: 'l-paid', amount: 150, paidOn: '2026-11-10' }),
      paymentRow({ id: 'p-lesson-x', purpose: 'lectie', lessonId: 'l-unpaid', amount: 150, paidOn: '2026-11-11', cancelled: true }),
    ],
  };
}

const ok = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error('refused');
  return r.data as T;
};

describe('athlete presence history', () => {
  const f = fakePresenceContext(seed());
  const allPages = async (): Promise<HistoryRow[]> => [
    ...ok(await readPresenceHistory(f.store, ATH, SEASON, 1)).rows, ...ok(await readPresenceHistory(f.store, ATH, SEASON, 2)).rows,
  ];

  it('pages 10 newest first over both sources', async () => {
    const p1 = ok(await readPresenceHistory(f.store, ATH, SEASON, 1));
    expect([p1.total, p1.rows.length, p1.pageSize, p1.seasonLabel]).toEqual([15, 10, 10, '2026-2027']);
    const p2 = ok(await readPresenceHistory(f.store, ATH, SEASON, 2));
    expect(p2.rows.length).toBe(5);
    expect(p2.rows[0].date <= p1.rows[9].date).toBe(true);
    expect(p1.rows[0]).toMatchObject({ kind: 'individual', lessonId: 'l-unpaid', place: 'Cu Andreea Pascu, Virgil Pascu' });
    expect(p1.rows[2]).toMatchObject({ kind: 'grup', sessionId: 'ss-13', place: 'Intermediari Bronze' });
  });

  it('labels each row by the 4.3a rule', async () => {
    const rows = (await allPages()).map((r) => [r.kind, payLabel(r.pay), r.detail]);
    expect(rows).toContainEqual(['grup', 'Ședința 6/8 A-0001', null]);
    expect(rows).toContainEqual(['grup', 'Ședința 3/8 A-0002', null]);
    expect(rows).toContainEqual(['grup', 'Neplătit', 'Club, noiembrie: de plătit 400 RON, plătit 200 RON, rămas 200 RON.']);
    expect(rows).toContainEqual(['grup', 'Plătit', 'Club, octombrie: de plătit 40 RON, plătit 40 RON, rămas 0 RON.']);
    expect(rows).toContainEqual(['grup', 'Neplătit', 'Fără abonament.']);
    expect(rows).toContainEqual(['individual', 'Plătit', 'Lecție individuală: 150 RON, plătit 150 RON.']);
    expect(rows).toContainEqual(['individual', 'Neplătit', 'Lecție individuală: 150 RON, plătit 0 RON.']);
    expect(rows.filter(([k]) => k === 'individual')).toHaveLength(2);
  });

  it('counts units in the abonament use order, not page order', async () => {
    const p2 = ok(await readPresenceHistory(f.store, ATH, SEASON, 2));
    expect(p2.rows.map((r) => payLabel(r.pay))).toContain('Ședința 1/8 A-0001');
    const units = (await allPages()).flatMap((r) => (r.pay.kind === 'unit' && r.pay.code === 'A-0001' ? [r.pay.unit] : []));
    expect(units.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('refuses a bad page with 400 and an unknown athlete or season with 404', async () => {
    for (const page of [0, -1, 1.5, 'x', '2.5']) expect(await readPresenceHistory(f.store, ATH, SEASON, page)).toMatchObject({ ok: false, status: 400 });
    expect(await readPresenceHistory(f.store, 'nope', SEASON, 1)).toMatchObject({ ok: false, status: 404 });
    expect(await readPresenceHistory(f.store, ATH, 'nope', 1)).toMatchObject({ ok: false, status: 404 });
    expect(ok(await readPresenceHistory(f.store, ATH, undefined, '1')).seasonLabel).toBe('2026-2027');
  });

  it('refuses a season or page that is not plain text or a number, and a page beyond the cap, with 400', async () => {
    for (const season of [['s26', 's25'], { id: 's26' }, 5, true]) expect(await readPresenceHistory(f.store, ATH, season, 1), JSON.stringify(season)).toMatchObject({ ok: false, status: 400 });
    for (const page of [['1', '2'], { n: 1 }, '1e3', '0x10', 1.5, 10 ** 15, '1001']) expect(await readPresenceHistory(f.store, ATH, SEASON, page), JSON.stringify(page)).toMatchObject({ ok: false, status: 400 });
    expect(await readPresenceHistory(f.store, ATH, undefined, '1')).toMatchObject({ ok: true });
    expect(await readPresenceHistory(f.store, ATH, '', 1)).toMatchObject({ ok: true });
    expect(await readPresenceHistory(f.store, ATH, SEASON, '1000')).toMatchObject({ ok: true });
  });

  it('an empty season has total 0', async () => {
    const empty = ok(await readPresenceHistory(f.store, ATH, 's27', 1));
    expect([empty.total, empty.rows]).toEqual([0, []]);
  });

  it('rows with the same date and start time keep one order: newest document id first, across sources', async () => {
    const tie = fakePresenceContext({
      group: { seasons: G_SEASONS, sections: G_SECTIONS, athletes: [athleteRow({ id: ATH, name: 'Ana Ionescu' })], memberships: [member({ id: 'm1', athleteId: ATH, groupId: 'g-ib' })] },
      sessions: [sessionRow({ id: 'ss-1', groupId: 'g-ib', date: '2026-11-03', startTime: '17:00' }), sessionRow({ id: 'ss-2', groupId: 'g-av', date: '2026-11-03', startTime: '17:00' })],
      attendances: [
        attendanceRow({ id: 'att-b', sessionId: 'ss-2', athleteId: ATH, uniqueKey: 'k2', billing: 'fara_abonament' }),
        attendanceRow({ id: 'att-a', sessionId: 'ss-1', athleteId: ATH, uniqueKey: 'k1', billing: 'fara_abonament' }),
      ],
      lessons: [lessonRow({ id: 'att-c', date: '2026-11-03', startTime: '17:00', state: 'saved', present: true, price: 150, amount: 150 })],
    });
    const rows = ok(await readPresenceHistory(tie.store, ATH, SEASON, 1)).rows;
    expect(rows.map((r) => r.sessionId ?? r.lessonId)).toEqual(['att-c', 'ss-2', 'ss-1']);
  });

  it('a Club row whose month is missing from the ledger is "Neplătit" with the zero detail line', async () => {
    const early = fakePresenceContext({
      group: { seasons: G_SEASONS, sections: G_SECTIONS, athletes: [athleteRow({ id: ATH, name: 'Ana Ionescu' })], memberships: [member({ id: 'm1', athleteId: ATH, groupId: 'g-av' })] },
      sessions: [sessionRow({ id: 'ss-1', groupId: 'g-av', date: '2026-10-05', startTime: '17:00' })],
      attendances: [attendanceRow({ id: 'att-a', sessionId: 'ss-1', athleteId: ATH, uniqueKey: 'k1', billing: 'club', charges: [{ type: 'grup', itemName: 'Ședință grup', price: 40, included: false }], amount: 40 })],
      startDate: '2026-11-01',
    } as FakePresenceSeed);
    const rows = ok(await readPresenceHistory(early.store, ATH, SEASON, 1)).rows;
    expect(rows.map((r) => [payLabel(r.pay), r.detail])).toEqual([['Neplătit', 'Club, octombrie: de plătit 0 RON, plătit 0 RON, rămas 0 RON.']]);
  });
});
