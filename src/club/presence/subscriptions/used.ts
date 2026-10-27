import type { PresenceStore } from '../store';
import { usedSlots } from '../subscriptions';
import type { SubscriptionRow } from '../types';

/** Slots used per abonament: one read of the attendances that point to them. */
export async function usedOf(store: PresenceStore, subs: readonly SubscriptionRow[]): Promise<Map<string, number>> {
  return subs.length > 0 ? usedSlots(await store.attendances({ subscriptionIds: subs.map((s) => s.id) })) : new Map();
}
