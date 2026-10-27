import type { AcsRow } from '../athletes/store';
import type { GroupRecord } from '../groups/types';
import { priceFor, type Audience, type PriceItemKind } from '../price-item';
import { usesMemberPrice } from '../acs';
import type { Billing, Charge, PresenceType, PriceListRecord } from './types';
import { sumMoney } from './money';

type ClubBilling = Extract<Billing, 'club' | 'inclus' | 'fara_pret'>;
type Billed = Charge & { price: number };

const ITEM_KIND: Record<PresenceType, PriceItemKind> = { grup: 'session', uscat: 'uscat' };

/** Member price only with A.C.S. "Da" for the season; no season means non-member (4.13). */
export function audienceFor(acs: readonly AcsRow[], athleteId: string, seasonId: string | null): Audience {
  if (seasonId === null) return 'nonMember';
  const row = acs.find((a) => a.athleteId === athleteId && a.seasonId === seasonId);
  return usesMemberPrice(row?.state) ? 'member' : 'nonMember';
}

function chargeFor(list: PriceListRecord, type: PresenceType, audience: Audience): Charge {
  const item = list.items.find((i) => i.kind === ITEM_KIND[type]);
  if (!item) return { type, itemName: '', price: null, included: false };
  return { type, itemName: item.name, price: priceFor(item, audience), included: item.included };
}

function billingOf(charges: Charge[], billed: Billed[]): ClubBilling {
  if (charges.length > 0 && charges.every((c) => c.included)) return 'inclus';
  return billed.length > 0 ? 'club' : 'fara_pret';
}

export function clubCharges(
  list: PriceListRecord | null, ticks: { grup: boolean; uscat: boolean }, audience: Audience,
): { charges: Charge[]; billing: ClubBilling; amount: number } {
  if (!list) return { charges: [], billing: 'fara_pret', amount: 0 };
  const types: PresenceType[] = (['grup', 'uscat'] as const).filter((t) => ticks[t]);
  const charges = types.map((t) => chargeFor(list, t, audience));
  const billed = charges.filter((c): c is Billed => !c.included && c.price !== null);
  return { charges, billing: billingOf(charges, billed), amount: sumMoney(billed.map((c) => c.price)) };
}

/** The first individual item of the list, at the audience's price (5.5). */
export function lessonPrice(list: PriceListRecord | null, audience: Audience): { itemName: string | null; price: number | null } {
  const item = list?.items.find((i) => i.kind === 'individual');
  return item ? { itemName: item.name, price: priceFor(item, audience) } : { itemName: null, price: null };
}

export function groupsWithoutPriceList(groups: readonly GroupRecord[]): number {
  return groups.filter((g) => g.active && !g.priceListId).length;
}
