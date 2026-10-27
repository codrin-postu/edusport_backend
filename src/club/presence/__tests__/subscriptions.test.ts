import { describe, expect, it } from 'vitest';
import type { SubscriptionRow } from '../types';
import { abonamentStatusText, pickSubscription, remainingOf, subscriptionState, usedSlots } from '../subscriptions';

const subscriptionRow = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: 'sub', athleteId: 'a1', seasonId: 's26', priceListId: 'pl-std', validIn: [], itemName: 'Abonament 8 ședințe', price: 320,
  audience: 'member', slots: 8, startsOn: '2026-10-27', validUntil: '2026-11-23', extendedWeeks: 0, cancelled: false, cancelledAt: null,
  cancelledBy: null, purchasedAt: '2026-10-27T09:00:00.000Z', recordedBy: 'tm-andreea', ...over,
});

const a = subscriptionRow({ id: 'a', startsOn: '2026-10-27', validUntil: '2026-11-23', purchasedAt: '2026-10-27T09:00:00.000Z' });
const b = subscriptionRow({ id: 'b', startsOn: '2026-11-01', validUntil: '2026-11-28', purchasedAt: '2026-11-01T09:00:00.000Z' });
const gold = subscriptionRow({ id: 'g', priceListId: 'pl-gold', price: 400, startsOn: '2026-11-02', validUntil: '2026-11-29' });
const carried = subscriptionRow({ id: 'c', validIn: ['pl-gold'], startsOn: '2026-10-20', validUntil: '2026-11-16' });
const none = new Map<string, number>();

describe('abonament state and slot choice', () => {
  it('uses the abonament expiring first, then the earlier start, then the earlier purchase (4.10, C24)', () => {
    expect(pickSubscription([b, a], none, 'pl-std', '2026-11-05')?.id).toBe('a');
    expect(pickSubscription([b, a], new Map([['a', 8]]), 'pl-std', '2026-11-05')?.id).toBe('b');
    const twin = subscriptionRow({ id: 'a2', startsOn: '2026-10-27', validUntil: '2026-11-23', purchasedAt: '2026-10-27T08:00:00.000Z' });
    expect(pickSubscription([a, twin], none, 'pl-std', '2026-11-05')?.id).toBe('a2');
  });
  it('the start day and the last valid day use a slot, the day after does not (4.8)', () => {
    expect(pickSubscription([a], none, 'pl-std', '2026-10-27')?.id).toBe('a');
    expect(pickSubscription([a], none, 'pl-std', '2026-11-23')?.id).toBe('a');
    expect(pickSubscription([a], none, 'pl-std', '2026-11-24')).toBeNull();
    expect(pickSubscription([a], none, 'pl-std', '2026-10-26')).toBeNull();
  });
  it('a cancelled abonament is never used; a carried Standard works in Gold, Gold never in Standard (4.11, p5 Q10)', () => {
    expect(pickSubscription([{ ...a, cancelled: true }], none, 'pl-std', '2026-11-05')).toBeNull();
    expect(pickSubscription([gold, carried], none, 'pl-gold', '2026-11-05')?.id).toBe('c');
    expect(pickSubscription([gold], none, 'pl-std', '2026-11-05')).toBeNull();
  });
  it('states (3.4)', () => {
    expect(subscriptionState(a, 3, '2026-11-23')).toBe('activ');
    expect(subscriptionState(a, 3, '2026-11-24')).toBe('expirat');
    expect(subscriptionState(a, 8, '2026-11-24')).toBe('epuizat');
    expect(subscriptionState({ ...a, cancelled: true }, 8, '2026-11-01')).toBe('anulat');
  });
  it('used slots are counted from attendance rows (C7)', () => {
    expect([...usedSlots([{ subscriptionId: 'a' }, { subscriptionId: 'a' }, { subscriptionId: null }])]).toEqual([['a', 2]]);
    expect(remainingOf(a, new Map([['a', 3]]))).toBe(5);
  });
  it('status under a name (4.10)', () => {
    expect([abonamentStatusText(7), abonamentStatusText(1), abonamentStatusText(null)]).toEqual(['7 ședințe rămase', '1 ședință rămasă', 'Fără abonament']);
  });
});
