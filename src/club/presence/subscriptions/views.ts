import type { Audience } from '../../price-item';
import type { CoverRow, OfferedItem } from './rules';

/** Response shapes shared with the admin UI; kept free of server imports so the admin build stays client-only. */
export type NewSubscriptionForm = {
  athleteName: string; hasEmail: boolean; audience: Audience; startsOn: string; validUntil: string;
  lists: { priceListId: string; listName: string; items: OfferedItem[] }[];
  cover: CoverRow[];
};
export type AddSubscriptionResult = { subscriptionId: string; athleteName: string; withPayment: boolean };
