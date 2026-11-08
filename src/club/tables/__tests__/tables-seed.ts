import { athleteRow, member } from '../../groups/__tests__/fake-group-store';
import { attendanceRow, fakePresenceStore, lessonRow, paymentRow, sessionRow, subscriptionRow, type FakePresence } from '../../presence/__tests__/fake-store';
import type { PresenceStore } from '../../presence/store';
import type { TableDefinition } from '../types';

export const TODAY = '2026-11-20';
export const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' };

/** Counts every PresenceStore read so a test can assert one bulk read per source table. */
export function spied(store: PresenceStore): { store: PresenceStore; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const proxy = new Proxy(store, {
    get(target, key: string) {
      const v = (target as unknown as Record<string, unknown>)[key];
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        calls[key] = (calls[key] ?? 0) + 1;
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { store: proxy, calls };
}

export const definition = (over: Partial<TableDefinition> & Pick<TableDefinition, 'subject'>): TableDefinition => ({
  scope: { seasonId: 's26', sectionId: null, groupId: null, period: { kind: 'month', month: '2026-11' } }, columns: ['sportiv'], filters: [], groupBy: null, sort: null, ...over,
});

const att = (id: string, sessionId: string, athleteId: string, over: Parameters<typeof attendanceRow>[0] = {}) =>
  attendanceRow({ id, sessionId, athleteId, uniqueKey: `${sessionId}|${athleteId}`, ...over });

/**
 * Season s26. Groups: g-ib (section afi, coach tm-virgil), g-av (section club, coach tm-andreea).
 * a1 Ana (g-ib): A-0001 320 paid 320, used 2.  a2 Mihai (g-ib): A-0002 320 paid 100.  a3 Ioana (g-ib): A-0003 260 unpaid.
 * a4 Dan (g-av): 2 Club sessions 40 each, club month paid 80.  a5 Eva (g-av): 1 Club session 40 unpaid.  a6 Radu (g-av): nothing due.
 * a7 Vlad: in no group.  A-0000 of a1 started in October (outside November); A-0004 of a6 is cancelled.
 */
export function tablesSeed(): FakePresence {
  return fakePresenceStore({
    group: {
      athletes: [
        athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2016-03-10', contactName: 'Maria Ionescu', phone: '0711', email: 'm@ex.ro' }),
        athleteRow({ id: 'a2', name: 'Mihai Pop' }), athleteRow({ id: 'a3', name: 'Ioana Dinu', status: 'inactiv' }),
        athleteRow({ id: 'a4', name: 'Dan Radu' }), athleteRow({ id: 'a5', name: 'Eva Tudor' }), athleteRow({ id: 'a6', name: 'Radu Stan' }), athleteRow({ id: 'a7', name: 'Vlad Fără Grupă' }),
      ],
      memberships: [
        member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib' }), member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }),
        member({ id: 'm4', athleteId: 'a4', groupId: 'g-av' }), member({ id: 'm5', athleteId: 'a5', groupId: 'g-av' }), member({ id: 'm6', athleteId: 'a6', groupId: 'g-av' }),
        member({ id: 'm1b', athleteId: 'a1', groupId: 'g-av', isMain: false }),
      ],
    },
    acs: [{ id: 'acs1', athleteId: 'a1', seasonId: 's26', state: 'da' }],
    startDate: '2026-10-01',
    sessions: [
      sessionRow({ id: 's1', groupId: 'g-ib', date: '2026-11-07', startTime: '11:00', coachIds: ['tm-virgil'] }),
      sessionRow({ id: 's2', groupId: 'g-ib', date: '2026-11-14', startTime: '11:00', coachIds: ['tm-virgil'] }),
      sessionRow({ id: 's3', groupId: 'g-av', date: '2026-11-06', startTime: '17:00', coachIds: ['tm-andreea'] }),
      sessionRow({ id: 's4', groupId: 'g-av', date: '2026-11-13', startTime: '17:00', coachIds: ['tm-andreea', 'tm-virgil'] }),
      sessionRow({ id: 's0', groupId: 'g-ib', date: '2026-10-10', startTime: '11:00', coachIds: ['tm-virgil'] }),
    ],
    attendances: [
      att('t1', 's1', 'a1', { billing: 'slot', subscriptionId: 'sub-a1' }), att('t2', 's2', 'a1', { billing: 'slot', subscriptionId: 'sub-a1' }),
      att('t0', 's0', 'a1', { billing: 'slot', subscriptionId: 'sub-a1-oct' }),
      att('t3', 's3', 'a4', { billing: 'club', amount: 40 }), att('t4', 's4', 'a4', { billing: 'club', amount: 40 }), att('t5', 's3', 'a5', { billing: 'club', amount: 40 }),
    ],
    subscriptions: [
      subscriptionRow({ id: 'sub-a1', athleteId: 'a1', code: 'A-0001', price: 320, startsOn: '2026-11-02', validUntil: '2026-11-29' }),
      subscriptionRow({ id: 'sub-a2', athleteId: 'a2', code: 'A-0002', price: 320, startsOn: '2026-11-02', validUntil: '2026-11-29' }),
      subscriptionRow({ id: 'sub-a3', athleteId: 'a3', code: 'A-0003', price: 260, slots: 6, itemName: 'Abonament 6 ședințe', startsOn: '2026-11-03', validUntil: '2026-11-30' }),
      subscriptionRow({ id: 'sub-a6', athleteId: 'a6', code: 'A-0004', price: 300, startsOn: '2026-11-05', validUntil: '2026-12-02', cancelled: true }),
      subscriptionRow({ id: 'sub-a1-oct', athleteId: 'a1', code: 'A-0000', price: 320, startsOn: '2026-10-05', validUntil: '2026-10-30' }),
    ],
    payments: [
      paymentRow({ id: 'p1', athleteId: 'a1', amount: 320, purpose: 'abonament', subscriptionId: 'sub-a1', paidOn: '2026-11-02' }),
      paymentRow({ id: 'p2', athleteId: 'a2', amount: 100, purpose: 'abonament', subscriptionId: 'sub-a2', paidOn: '2026-12-01' }),
      paymentRow({ id: 'p2x', athleteId: 'a2', amount: 220, purpose: 'abonament', subscriptionId: 'sub-a2', paidOn: '2026-11-03', cancelled: true }),
      paymentRow({ id: 'p4', athleteId: 'a4', amount: 80, purpose: 'club_luna', clubMonth: '2026-11', paidOn: '2026-11-15' }),
    ],
    lessons: [lessonRow({ id: 'l-none', athleteId: 'a6', date: '2026-11-10', state: 'planned' })],
  });
}
