import { nameKey } from './migrate/names';

export const PRICE_ITEM_KINDS = ['subscription', 'session', 'individual'] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];
export type Audience = 'member' | 'nonMember';
export type PriceItemPrices = { memberPrice?: number | null; nonMemberPrice?: number | null };

export function isPriceItemKind(v: unknown): v is PriceItemKind {
  return typeof v === 'string' && (PRICE_ITEM_KINDS as readonly string[]).includes(v);
}

/** A usable price: a finite number, zero included. Empty price fields come back as null. */
export function isPrice(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function priceFor(item: PriceItemPrices, audience: Audience): number | null {
  const value = audience === 'member' ? item.memberPrice : item.nonMemberPrice;
  return isPrice(value) ? value : null;
}

/** Offered to members when it has a member price, to non-members when it has a non-member price. */
export function isOfferedTo(item: PriceItemPrices, audience: Audience): boolean {
  return priceFor(item, audience) !== null;
}

export function offeredItems<T extends PriceItemPrices>(items: T[], audience: Audience): T[] {
  return items.filter((item) => isOfferedTo(item, audience));
}

/** Incomplete = offered to nobody. Hidden on the website and in the form; flagged "Preț incomplet" in the admin. */
export function isIncomplete(item: PriceItemPrices): boolean {
  return !isOfferedTo(item, 'member') && !isOfferedTo(item, 'nonMember');
}

/**
 * Item names used more than once across one school's price lists (case, spaces and diacritics
 * ignored), as first written. The form identifies the chosen item by its name, so names must be unique.
 */
export function duplicateItemNames(lists: { items?: { name?: unknown }[] | null }[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const item of lists.flatMap((l) => l.items ?? [])) {
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) continue;
    const entry = seen.get(nameKey(name)) ?? { name, count: 0 };
    seen.set(nameKey(name), { name: entry.name, count: entry.count + 1 });
  }
  return [...seen.values()].filter((e) => e.count > 1).map((e) => e.name);
}
