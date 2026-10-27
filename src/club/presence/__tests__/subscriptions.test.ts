import { describe, expect, it } from 'vitest';
import { subscriptionRow } from './fake-store';
import { abonamentStatusText, pickSubscription, remainingOf, slotCandidates, subscriptionState, usedSlots } from '../subscriptions';

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
  it('same validUntil: the earlier start is used before the later one (4.10, second tier)', () => {
    const early = subscriptionRow({ id: 'e', startsOn: '2026-10-27', validUntil: '2026-11-23', purchasedAt: '2026-11-05T09:00:00.000Z' });
    const late = subscriptionRow({ id: 'l', startsOn: '2026-11-02', validUntil: '2026-11-23', purchasedAt: '2026-10-01T09:00:00.000Z' });
    expect(pickSubscription([late, early], none, 'pl-std', '2026-11-05')?.id).toBe('e');
  });
  it('identical dates and purchase time: the id decides, whatever the read order (4.10, final tie-break)', () => {
    const x = subscriptionRow({ id: 'x1', purchasedAt: '2026-10-27T09:00:00.000Z' });
    const y = subscriptionRow({ id: 'x2', purchasedAt: '2026-10-27T09:00:00.000Z' });
    expect(pickSubscription([y, x], none, 'pl-std', '2026-11-05')?.id).toBe('x1');
    expect(pickSubscription([x, y], none, 'pl-std', '2026-11-05')?.id).toBe('x1');
  });
  it('a carried Standard used up hands the slot to the Gold abonament (4.11)', () => {
    expect(pickSubscription([gold, carried], new Map([['c', 8]]), 'pl-gold', '2026-11-05')?.id).toBe('g');
  });
  it('slotCandidates drops exhausted and out-of-window abonamente and keeps the order', () => {
    const full = subscriptionRow({ id: 'f', validUntil: '2026-11-10' });
    expect(slotCandidates([a, b, full], new Map([['f', 8]]), 'pl-std', '2026-11-05').map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('status under a name (4.10)', () => {
    expect([abonamentStatusText(7), abonamentStatusText(1), abonamentStatusText(null)]).toEqual(['7 ședințe rămase', '1 ședință rămasă', 'Fără abonament']);
  });
});
