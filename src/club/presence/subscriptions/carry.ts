import { isValidForList, subscriptionState } from '../subscriptions';
import type { PriceListRecord, SubscriptionRow } from '../types';
import { offeredSubscriptionItems } from './rules';

/** The price the new list asks for the same slot count and audience; null when it has none yet. */
function priceOnList(sub: SubscriptionRow, to: PriceListRecord): number | null {
  return offeredSubscriptionItems(to, sub.audience).find((item) => item.slots === sub.slots)?.price ?? null;
}

/** Carried when the frozen price is lower than the new list's price, or the new list has none yet (4.11, p5 Q35). */
function isCheaper(sub: SubscriptionRow, to: PriceListRecord): boolean {
  const target = priceOnList(sub, to);
  return sub.price !== null && (target === null || sub.price < target);
}

/** The abonamente a move to `to` carries: active, valid for the old list, not yet for the new one, and cheaper (decided 10: no frozen price, no carry). */
export function carryList(i: { subs: SubscriptionRow[]; used: Map<string, number>; fromListId: string; to: PriceListRecord; today: string }): SubscriptionRow[] {
  return i.subs.filter((s) => subscriptionState(s, i.used.get(s.id) ?? 0, i.today) === 'activ'
    && isValidForList(s, i.fromListId) && !isValidForList(s, i.to.id) && isCheaper(s, i.to));
}
