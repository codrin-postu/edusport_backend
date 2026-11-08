import { athleteRow, member } from '../../groups/__tests__/fake-group-store';
import { attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow, subscriptionRow, type FakePresence } from '../../presence/__tests__/fake-store';
import type { GroupRecord } from '../../groups/types';

export const TODAY = '2026-11-20';

const att = (id: string, sessionId: string, athleteId: string, over: Parameters<typeof attendanceRow>[0] = {}) =>
  attendanceRow({ id, sessionId, athleteId, uniqueKey: `${sessionId}|${athleteId}`, ...over });

/**
 * Season s26, sections afi (school) and club. Groups: g-ib Intermediari Bronze (afi), g-av Avansați (club), g-fd Fără datorii (club).
 * a1 Ana (g-ib): A-0001 320 starts 11-02, paid 200 on 11-02 (left 120), active, expires 11-29 (inside 14 days of 11-20).
 * a2 Mihai (g-ib): A-0002 320 starts 10-05 (October), paid 120 on 10-06, expired 10-31, so no active one.
 * a3 Ioana (g-ib): A-0003 cancelled, price 300, starts 11-03, one payment of 50 that is cancelled too.
 * a4 Dan (g-av): Club November 400 (10 sessions of 40), paid 300 on 11-15 and 100 on 12-03.
 * a5 Eva (g-av): a lesson of 150 on 11-12, unpaid.
 * a6 Radu (g-fd): nothing due. A cancelled payment of 70 on 11-04.
 * October: a2 paid 120 (abonament), a4 paid 0.
 */
export function moneySeed(): FakePresence {
  const groups: GroupRecord[] = [
    { id: 'g-ib', name: 'Intermediari Bronze', sectionId: 'afi', order: 2, active: true, priceListId: 'pl-std', coachIds: [], programPublic: true },
    { id: 'g-av', name: 'Avansați', sectionId: 'club', order: 2, active: true, priceListId: 'pl-club', coachIds: [], programPublic: true },
    { id: 'g-fd', name: 'Fără datorii', sectionId: 'club', order: 3, active: true, priceListId: 'pl-club', coachIds: [], programPublic: true },
  ];
  const sessions = Array.from({ length: 10 }, (_, i) => sessionRow({ id: `sc${i}`, groupId: 'g-av', date: `2026-11-${String(i + 1).padStart(2, '0')}`, startTime: '17:00' }));
  return fakePresenceStore({
    group: {
      groups,
      athletes: ['a1:Ana Ionescu', 'a2:Mihai Pop', 'a3:Ioana Dinu', 'a4:Dan Radu', 'a5:Eva Tudor', 'a6:Radu Stan'].map((x) => athleteRow({ id: x.split(':')[0], name: x.split(':')[1] })),
      memberships: [
        member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }),
        member({ id: 'm4', athleteId: 'a4', groupId: 'g-av' }), member({ id: 'm5', athleteId: 'a5', groupId: 'g-av' }), member({ id: 'm6', athleteId: 'a6', groupId: 'g-fd' }),
      ],
    },
    startDate: '2026-10-01',
    sessions,
    attendances: sessions.map((s, i) => att(`t${i}`, s.id, 'a4', { billing: 'club', amount: 40 })),
    subscriptions: [
      subscriptionRow({ id: 'sub-a1', athleteId: 'a1', code: 'A-0001', price: 320, startsOn: '2026-11-02', validUntil: '2026-11-29' }),
      subscriptionRow({ id: 'sub-a2', athleteId: 'a2', code: 'A-0002', price: 320, startsOn: '2026-10-05', validUntil: '2026-10-31' }),
      subscriptionRow({ id: 'sub-a3', athleteId: 'a3', code: 'A-0003', price: 300, startsOn: '2026-11-03', validUntil: '2026-11-30', cancelled: true, cancelledAt: '2026-11-04T10:00:00.000Z' }),
    ],
    payments: [
      paymentRow({ id: 'p1', athleteId: 'a1', amount: 200, purpose: 'abonament', subscriptionId: 'sub-a1', paidOn: '2026-11-02', method: 'card', receiptNo: '2026-0001' }),
      paymentRow({ id: 'p2', athleteId: 'a2', amount: 120, purpose: 'abonament', subscriptionId: 'sub-a2', paidOn: '2026-10-06', receiptNo: '2026-0002' }),
      paymentRow({ id: 'p3', athleteId: 'a3', amount: 50, purpose: 'abonament', subscriptionId: 'sub-a3', paidOn: '2026-11-03', cancelled: true }),
      paymentRow({ id: 'p4', athleteId: 'a4', amount: 300, purpose: 'club_luna', clubMonth: '2026-11', paidOn: '2026-11-15', method: 'transfer', receiptNo: '2026-0003' }),
      paymentRow({ id: 'p5', athleteId: 'a4', amount: 100, purpose: 'club_luna', clubMonth: '2026-11', paidOn: '2026-12-03', receiptNo: '2026-0004' }),
      paymentRow({ id: 'p6', athleteId: 'a6', amount: 70, purpose: 'cotizatie', paidOn: '2026-11-04', cancelled: true, receiptNo: '2026-0005' }),
      paymentRow({ id: 'p7', athleteId: 'a1', amount: 180, purpose: 'cotizatie', paidOn: '2026-11-04', receiptNo: null }),
      paymentRow({ id: 'p8', athleteId: 'a2', amount: 120, purpose: 'altceva', paidOn: '2026-11-04', receiptNo: '2026-0006', method: 'card' }),
    ],
    lessons: [lessonRow({ id: 'l1', athleteId: 'a5', date: '2026-11-12', state: 'saved', present: true, price: 150, amount: 150, itemName: 'Lecție individuală' })],
  });
}
