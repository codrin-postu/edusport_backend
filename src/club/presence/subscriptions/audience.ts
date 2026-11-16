import { priceFor, type Audience } from '../../price-item';
import { SUBSCRIPTION_COPY } from '../copy/subscriptions';

/** The A.C.S. box of "Adaugă abonament" picks the audience: ticked is a member, unticked pays the non-member price (shown as "neafiliat"). */
export const audienceOf = (member: boolean): Audience => (member ? 'member' : 'nonMember');

/** The item's price for the audience; null when it is not offered to it. */
export const itemPrice = (item: { memberPrice: number | null; nonMemberPrice: number | null }, a: Audience): number | null => priceFor(item, a);

/** The "Adaugă cotizația (<fee> lei)" box: only when membership turns on (was not a member) and some of the season fee is still owed. */
export function feeLine(member: boolean, wasMember: boolean, fee: number | null): { label: string } | null {
  if (!member || wasMember || fee === null || fee <= 0) return null;
  return { label: SUBSCRIPTION_COPY.addFee(fee) };
}
