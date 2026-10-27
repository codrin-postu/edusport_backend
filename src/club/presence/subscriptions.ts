import type { AttendanceRow, SubscriptionRow, SubscriptionState } from './types';
import { PRESENCE_WORDS, remainingText } from './copy/core';

const usedOf = (used: Map<string, number>, id: string): number => used.get(id) ?? 0;

/** Slots used per abonament: the attendance rows that point to it (C7). */
export function usedSlots(rows: readonly Pick<AttendanceRow, 'subscriptionId'>[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const row of rows) {
    if (row.subscriptionId) used.set(row.subscriptionId, usedOf(used, row.subscriptionId) + 1);
  }
  return used;
}

export function subscriptionState(sub: SubscriptionRow, used: number, today: string): SubscriptionState {
  if (sub.cancelled) return 'anulat';
  if (used >= sub.slots) return 'epuizat';
  if (today > sub.validUntil) return 'expirat';
  return 'activ';
}

/** Valid on the list it was bought on, or on a list it was carried to by a move (4.11). */
export function isValidForList(sub: SubscriptionRow, priceListId: string): boolean {
  return sub.priceListId === priceListId || sub.validIn.includes(priceListId);
}

const byUseOrder = (a: SubscriptionRow, b: SubscriptionRow): number =>
  a.validUntil.localeCompare(b.validUntil) || a.startsOn.localeCompare(b.startsOn) || a.purchasedAt.localeCompare(b.purchasedAt);

/** The abonamente a Școala attendance on this date may use, in the order they are used (4.10). */
export function slotCandidates(subs: SubscriptionRow[], used: Map<string, number>, priceListId: string, date: string): SubscriptionRow[] {
  return subs
    .filter((s) => !s.cancelled && isValidForList(s, priceListId) && s.startsOn <= date && date <= s.validUntil && usedOf(used, s.id) < s.slots)
    .sort(byUseOrder);
}

export function pickSubscription(subs: SubscriptionRow[], used: Map<string, number>, priceListId: string, date: string): SubscriptionRow | null {
  return slotCandidates(subs, used, priceListId, date)[0] ?? null;
}

export function remainingOf(sub: SubscriptionRow, used: Map<string, number>): number {
  return sub.slots - usedOf(used, sub.id);
}

export function abonamentStatusText(remaining: number | null): string {
  return remaining === null ? PRESENCE_WORDS.noSubscription : remainingText(remaining);
}
