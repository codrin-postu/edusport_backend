import { priceFor } from '../../price-item';
import { SUBSCRIPTION_COPY } from '../copy/subscriptions';

/** Who an abonament is priced for in "Adaugă abonament": the A.C.S. box ticked or not. */
export type Audience = 'member' | 'neafiliat';

export const audienceOf = (member: boolean): Audience => (member ? 'member' : 'neafiliat');

/** The item's price for the audience; null when it is not offered to it. */
export function itemPrice(item: { memberPrice: number | null; nonMemberPrice: number | null }, a: Audience): number | null {
  return priceFor(item, a === 'member' ? 'member' : 'nonMember');
}

/** The "Adaugă cotizația (<fee> lei)" box: only when membership turns on (was not a member) and the season has a fee. */
export function feeLine(member: boolean, wasMember: boolean, fee: number | null): { show: boolean; label: string } | null {
  if (!member || wasMember || fee === null || fee <= 0) return null;
  return { show: true, label: SUBSCRIPTION_COPY.addFee(fee) };
}
