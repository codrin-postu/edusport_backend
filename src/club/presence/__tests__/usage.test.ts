import { describe, expect, it } from 'vitest';
import { G_SEASONS, G_SECTIONS } from '../../groups/__tests__/fake-group-store';
import { readAthleteSubscriptionCards, usesOf } from '../subscriptions/usage';
import { athleteRow, attendanceRow, fakePresenceContext, member, sessionRow, subscriptionRow } from './fake-store';

const GROUPS = new Map([['g-ib', 'Intermediari Bronze']]);

function seed() {
  return {
    group: { seasons: G_SEASONS, sections: G_SECTIONS, athletes: [athleteRow({ id: 'a1', name: 'Ana Ionescu' })], memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })] },
    sessions: [
      sessionRow({ id: 's-1', date: '2026-11-02', startTime: '17:00' }),
      sessionRow({ id: 's-2', date: '2026-11-04', startTime: '17:00' }),
      sessionRow({ id: 's-3', date: '2026-11-04', startTime: '10:00' }),
    ],
    attendances: [
      attendanceRow({ id: 't-1', sessionId: 's-2', uniqueKey: 'k2', subscriptionId: 'x', billing: 'slot' }),
      attendanceRow({ id: 't-2', sessionId: 's-3', uniqueKey: 'k3', subscriptionId: 'x', billing: 'slot' }),
      attendanceRow({ id: 't-3', sessionId: 's-1', uniqueKey: 'k1', subscriptionId: 'x', billing: 'slot' }),
    ],
    subscriptions: [
      subscriptionRow({ id: 'x', code: 'A-0001', startsOn: '2026-11-01', validUntil: '2026-11-30' }),
      subscriptionRow({ id: 'y', code: 'A-0002', startsOn: '2026-11-10', validUntil: '2026-11-25' }),
      subscriptionRow({ id: 'old', startsOn: '2026-09-01', validUntil: '2026-09-28' }),
      subscriptionRow({ id: 'can', startsOn: '2026-10-01', validUntil: '2026-10-30', cancelled: true }),
    ],
  };
}
const ok = <T>(r: { ok: boolean; data?: T }): T => {
  if (!r.ok) throw new Error('refused');
  return r.data as T;
};

describe('abonament usage', () => {
  it('lists dated units by session date, start time, attendance id', async () => {
    const f = fakePresenceContext(seed());
    const sub = (await f.store.subscription('x'))!;
    const atts = await f.store.attendances({ subscriptionIds: ['x'] });
    const sessions = new Map((await f.store.sessions()).map((s) => [s.id, s]));
    const uses = usesOf(sub, atts, sessions, GROUPS);
    expect(uses.map((u) => [u.unit, u.date, u.startTime, u.groupName])).toEqual([
      [1, '2026-11-02', '17:00', 'Intermediari Bronze'], [2, '2026-11-04', '10:00', 'Intermediari Bronze'], [3, '2026-11-04', '17:00', 'Intermediari Bronze'],
    ]);
  });

  it('current: the one abonament P5 would use today; every other card goes to others, newest start first', async () => {
    const f = fakePresenceContext(seed());
    const cards = ok(await readAthleteSubscriptionCards(f.store, 'a1', 's26', '2026-11-20'));
    expect(cards.current).toMatchObject({ id: 'y', code: 'A-0002' });
    expect(cards.others.map((c) => [c.id, c.state])).toEqual([['x', 'activ'], ['can', 'anulat'], ['old', 'expirat']]);
    expect(cards.others[0]).toMatchObject({ code: 'A-0001', used: 3, slots: 8, label: 'Abonament 8 ședințe' });
    expect(cards.others[0].uses).toHaveLength(3);
    expect(cards.groups).toEqual([{ name: 'Intermediari Bronze', main: true }]);
  });

  it('an active abonament plus one starting next week: only the started one is current', async () => {
    const f = fakePresenceContext(seed());
    const cards = ok(await readAthleteSubscriptionCards(f.store, 'a1', 's26', '2026-11-08'));
    expect(cards.current?.id).toBe('x');
    expect(cards.others.map((c) => [c.id, c.state])).toEqual([['y', 'activ'], ['can', 'anulat'], ['old', 'expirat']]);
  });

  it('only a future abonament is active: current is null and it sits under others', async () => {
    const f = fakePresenceContext(seed());
    const cards = ok(await readAthleteSubscriptionCards(f.store, 'a1', 's26', '2026-10-20'));
    expect(cards.current).toBeNull();
    expect(cards.others.map((c) => c.id)).toEqual(['y', 'x', 'can', 'old']);
  });

  it('none active gives a null current; unknown athlete is 404', async () => {
    const f = fakePresenceContext(seed());
    expect(ok(await readAthleteSubscriptionCards(f.store, 'a1', 's26', '2027-03-01')).current).toBeNull();
    expect(await readAthleteSubscriptionCards(f.store, 'nope', 's26', '2026-11-20')).toMatchObject({ ok: false, status: 404 });
  });
});
