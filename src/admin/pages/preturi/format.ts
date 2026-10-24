import type { PriceItemKind } from '../../../club/price-item';
import type { AdminPriceItem } from '../../../club/price-admin';

export const KIND_LABELS: Record<PriceItemKind, string> = {
  subscription: 'Abonament',
  session: 'Ședință',
  individual: 'Lecție individuală',
};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as PriceItemKind[]).map((value) => ({ value, label: KIND_LABELS[value] }));

/** "520 RON", or "-" for a single missing price (normal, e.g. 1 ședință grup has no member price). */
export const priceText = (price: number | null) => (price === null ? '-' : `${price} RON`);

/** Price input text -> number for the API; an empty field is no price. Anything else is sent as typed, and refused there. */
export function priceValue(text: string): number | null | string {
  const t = text.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : t;
}

export const priceInput = (price: number | null) => (price === null ? '' : String(price));

export const hasTooltip = (items: AdminPriceItem[]) => items.some((i) => i.tooltip);
