import type { AbonamentBar, CoverRow } from './rules';

/** Response shapes shared with the admin UI; kept free of server imports so the admin build stays client-only. */
export type FormItem = {
  itemKey: string; itemName: string; slots: number; priceListId: string; listName: string; memberPrice: number | null; nonMemberPrice: number | null;
};
/** `member`: A.C.S. "Da" for the season of the start date; both prices of every item are here so the audience can switch without a request. */
export type NewSubscriptionForm = {
  athleteName: string; hasEmail: boolean; member: boolean; seasonLabel: string; fee: number | null; startsOn: string; validUntil: string;
  lists: { priceListId: string; listName: string; items: FormItem[] }[];
  cover: CoverRow[];
};
export type AddSubscriptionResult = { subscriptionId: string; athleteName: string; withPayment: boolean };
/** GET /club/memberships/:id/move-preview: the abonament that would follow the athlete, and whether it carries to the new group (5.12). */
export type MovePreview = { bar: AbonamentBar | null; carries: boolean };
