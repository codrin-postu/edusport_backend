import { describe, expect, it } from 'vitest';
import type { CarryOutcome } from '../../groups/members';
import { G_GROUPS, member } from '../../groups/__tests__/fake-group-store';
import { carryList } from '../subscriptions/carry';
import { movePreview, presenceCarry } from '../subscriptions/move';
import type { PriceListRecord, SubscriptionRow } from '../types';
import { attendanceRow, fakePresenceContext, P_GROUPS, P_LISTS, sessionRow, subscriptionRow } from './fake-store';

const list = (id: string): PriceListRecord => P_LISTS.find((l) => l.id === id) as PriceListRecord;
const std = subscriptionRow({ id: 'std', priceListId: 'pl-std', price: 320, audience: 'member', slots: 8, validUntil: '2026-11-23' });
const gold = subscriptionRow({ id: 'gold', priceListId: 'pl-gold', price: 400, audience: 'member', slots: 8, validUntil: '2026-11-23' });
const none = new Map<string, number>();

/** a1 in g-ib (pl-std) with the abonament `std`; g-ib2 is a second school group on the same list. */
const moveSeed = (over: Partial<SubscriptionRow> = {}) => ({
  group: {
    groups: [...P_GROUPS, { ...G_GROUPS[1], id: 'g-ib2', name: 'Intermediari Bronze 2', order: 5 }],
    memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' })],
  },
  subscriptions: [{ ...std, ...over }],
  sessions: [sessionRow({ id: 'sg', groupId: 'g-gold' })],
});

describe('carryList (4.11, p5 Q35)', () => {
  it('Standard -> Gold carried (cheaper); Gold -> Standard never; missing Gold price carried (4.11, p5 Q35)', () => {
    expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: list('pl-gold'), today: '2026-11-20' }).map((s) => s.id)).toEqual(['std']);
    expect(carryList({ subs: [gold], used: none, fromListId: 'pl-gold', to: list('pl-std'), today: '2026-11-20' })).toEqual([]);
    const noPrice = { ...list('pl-gold'), items: list('pl-gold').items.map((i) => ({ ...i, memberPrice: null })) };
    expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: noPrice, today: '2026-11-20' })).toHaveLength(1);
    const sixOnly = { ...list('pl-gold'), items: [] };
    expect(carryList({ subs: [std], used: none, fromListId: 'pl-std', to: sixOnly, today: '2026-11-20' })).toHaveLength(1);
  });

  it('only active abonamente valid for the old list and not yet valid for the new one (4.11)', () => {
    const args = (subs: SubscriptionRow[], used = none) => ({ subs, used, fromListId: 'pl-std', to: list('pl-gold'), today: '2026-11-20' });
    expect(carryList(args([{ ...std, cancelled: true }]))).toEqual([]);
    expect(carryList(args([std], new Map([['std', 8]])))).toEqual([]);
    expect(carryList(args([{ ...std, validUntil: '2026-11-19' }]))).toEqual([]);
    expect(carryList(args([{ ...std, validIn: ['pl-gold'] }]))).toEqual([]);
    expect(carryList(args([{ ...std, price: null }]))).toEqual([]);
  });
});

describe('presence carry port and move preview (5.12)', () => {
  it('the port writes the carry and its line; the preview shows the bar and the Gold flag (5.12)', async () => {
    const f = fakePresenceContext(moveSeed());
    const { carry } = presenceCarry(f.store);
    let out!: CarryOutcome;
    await f.store.transaction(async () => {
      await f.store.lockAthlete('a1');
      out = await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold', today: '2026-11-20' });
    });
    expect(out.carried).toBe(1);
    expect(out.steps).toEqual([{ op: 'uncarry', subscriptionId: 'std', priceListId: 'pl-gold', athleteId: 'a1' }]);
    expect(out.lines).toEqual([{ subjectType: 'subscription', subjectId: 'std', action: 'subscription-carried', changes: { listName: 'Avansați Gold' } }]);
    expect(f.state.subscriptions[0].validIn).toEqual(['pl-gold']);
    expect(f.group.locks).toEqual(['athlete:a1', 'subscription:std']);
    const g = fakePresenceContext(moveSeed());
    expect(await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-gold' }, '2026-11-20')).toEqual({
      bar: { subscriptionId: 'std', itemName: 'Abonament 8 ședințe', slots: 8, used: 0, validUntil: '2026-11-23' }, carries: true,
    });
    expect((await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-av' }, '2026-11-20')).carries).toBe(false);
    expect((await movePreview(g.store, { athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: null }, '2026-11-20')).carries).toBe(false);
  });

  it('Club moves and same-list moves carry nothing', async () => {
    const f = fakePresenceContext(moveSeed());
    const { carry } = presenceCarry(f.store);
    await f.store.transaction(async () => {
      expect((await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-av', today: '2026-11-20' })).carried).toBe(0);
      expect((await carry({ athleteId: 'a1', fromGroupId: 'g-ib', toGroupId: 'g-ib2', today: '2026-11-20' })).carried).toBe(0);
    });
    expect(f.state.subscriptions[0].validIn).toEqual([]);
  });

  it('undo ports: uncarry removes the list; carryUsed sees a slot used in a Gold group', async () => {
    const f = fakePresenceContext(moveSeed({ validIn: ['pl-gold'] }));
    const { ports } = presenceCarry(f.store);
    expect(await ports.carryUsed('std', 'pl-gold')).toBe(false);
    f.state.attendances.push(attendanceRow({ id: 't9', sessionId: 'sg', subscriptionId: 'std', billing: 'slot' }));
    expect(await ports.carryUsed('std', 'pl-gold')).toBe(true);
    await f.store.transaction(() => ports.uncarry('std', 'pl-gold'));
    expect(f.state.subscriptions[0].validIn).toEqual([]);
  });
});
