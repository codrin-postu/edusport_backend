import { PRESENCE_ERRORS, SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import { SUBSCRIPTION_COPY } from '../presence/copy/subscriptions';
import { longDate } from '../presence/dates';
import type { SubscriptionListRow, SubscriptionStateFilter } from '../presence/money-api';
import { defaultCover } from '../presence/subscriptions/rules';
import type { NewSubscriptionForm } from '../presence/subscriptions/views';
import type { PaymentMethod } from '../presence/types';
import { isPastDate, slotsText } from './format';
import { amountText, parseAmount } from './payment-window';
import type { FilterSection } from './plati-view';

const copy = MONEY_UI_COPY.abonamente;
const STATES: SubscriptionStateFilter[] = ['toate', 'active', 'epuizate', 'expirate', 'anulate'];

/** "Stare" starts on "Active"; "Grupă" starts with "Toate". Single choice each. */
export function abonamenteSections(q: { state: SubscriptionStateFilter; groupId: string | null }, groups: { value: string; label: string }[]): FilterSection[] {
  const states = STATES.map((value, i) => ({ value, label: copy.stateOptions[i] }));
  const groupOptions = [{ value: '', label: copy.all }, ...groups];
  return [
    { key: 'state', label: copy.state, options: states, single: true, allLabel: null, selected: [q.state] },
    { key: 'groupId', label: copy.group, options: groupOptions, single: true, allLabel: null, selected: groups.some((g) => g.value === q.groupId) && q.groupId ? [q.groupId] : [] },
  ];
}

export type AbonamenteCells = { athlete: string; group: string; item: string; used: string; expires: string; expiredRed: boolean; state: string };

export function abonamenteCells(r: SubscriptionListRow, today: string): AbonamenteCells {
  return {
    athlete: r.athleteName, group: r.groupName ?? '', item: slotsText(r.slots), used: `${r.used}/${r.slots}`,
    expires: longDate(r.validUntil), expiredRed: isPastDate(r.validUntil, today), state: SUBSCRIPTION_STATE_WORDS[r.state],
  };
}

/** Only an abonament without a payment and not yet anulat can be cancelled (5.9, C75). */
export const abonamentMenu = (r: SubscriptionListRow): 'cancel'[] => (r.canCancel ? ['cancel'] : []);

export type AddDraft = {
  listId: string | null; itemKey: string | null; startsOn: string; cover: string[]; payNow: boolean; amount: string;
  method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean;
};

const itemOf = (form: NewSubscriptionForm, listId: string | null, itemKey: string | null) =>
  form.lists.find((l) => l.priceListId === listId)?.items.find((i) => i.itemKey === itemKey) ?? null;

/** The first list that offers something, its first item, the oldest rows ticked up to the slots, payment off (C57). */
export function addDraft(form: NewSubscriptionForm): AddDraft {
  const base: AddDraft = {
    listId: null, itemKey: null, startsOn: form.startsOn, cover: [], payNow: false, amount: '', method: 'numerar', collectedAtRink: false, sendEmail: false,
  };
  const list = form.lists.find((l) => l.items.length > 0);
  return list ? withItem(base, form, list.priceListId, list.items[0].itemKey) : { ...base, listId: form.lists[0]?.priceListId ?? null };
}

/** Cover and amount follow the item. */
export function withItem(d: AddDraft, form: NewSubscriptionForm, listId: string, itemKey: string): AddDraft {
  const item = itemOf(form, listId, itemKey);
  if (!item) return d;
  return { ...d, listId, itemKey, cover: defaultCover(form.cover, listId, item.slots), amount: amountText(item.price) };
}

/** The athlete's "Fără abonament" rows on the chosen list. */
export const coverRows = (d: AddDraft, form: NewSubscriptionForm) => form.cover.filter((r) => r.priceListId === d.listId);

const slotsOf = (d: AddDraft, form: NewSubscriptionForm): number => itemOf(form, d.listId, d.itemKey)?.slots ?? 0;

export const coverDisabled = (d: AddDraft, form: NewSubscriptionForm, id: string): boolean => !d.cover.includes(id) && d.cover.length >= slotsOf(d, form);

/** Never more than the slots (C23). */
export function toggleCover(d: AddDraft, form: NewSubscriptionForm, id: string): AddDraft {
  if (d.cover.includes(id)) return { ...d, cover: d.cover.filter((c) => c !== id) };
  return coverDisabled(d, form, id) ? d : { ...d, cover: [...d.cover, id] };
}

/** POST /club/athletes/:id/subscriptions body (plan 5-3 Task 5); the payment only when "Înregistrează plata acum" is on. */
export function addBody(d: AddDraft): Record<string, unknown> | { error: string } {
  if (d.listId === null || d.itemKey === null) return { error: PRESENCE_ERRORS.invalid };
  const body = { itemKey: d.itemKey, priceListId: d.listId, startsOn: d.startsOn, cover: d.cover };
  if (!d.payNow) return body;
  const amount = parseAmount(d.amount);
  if (amount === null) return { error: PAYMENT_COPY.errors.amount };
  return { ...body, payment: { amount, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail } };
}

export const addToast = (name: string, withPayment: boolean): string =>
  withPayment ? SUBSCRIPTION_COPY.addedWithPayment(name) : SUBSCRIPTION_COPY.added(name);

/** "<item>, preț membru"; the list name as hint when several lists offer items (C22). */
export function itemOptions(form: NewSubscriptionForm): { value: string; label: string; hint: string | null }[] {
  const several = form.lists.filter((l) => l.items.length > 0).length > 1;
  return form.lists.flatMap((l) => l.items.map((i) => ({
    value: itemValue(l.priceListId, i.itemKey), label: SUBSCRIPTION_COPY.itemOption(i.itemName, form.audience), hint: several ? l.listName : null,
  })));
}

export const itemValue = (listId: string, itemKey: string): string => `${listId}|${itemKey}`;

export const extendModel = (preview: { count: number } | null, weeks: number): { text: string; button: string; disabled: boolean } => {
  const count = preview?.count ?? 0;
  return { text: SUBSCRIPTION_COPY.extendText(count, weeks), button: SUBSCRIPTION_COPY.extendButton(count), disabled: count === 0 };
};

/** The list's state filter as the address carries it; anything else is the default "Active". */
export const stateOf = (v: string | null): SubscriptionStateFilter => STATES.find((s) => s === v) ?? 'active';

/** After the start date changed: the same item when still offered, else the first; the payment choices stay, the amount follows the item. */
export function withForm(d: AddDraft, form: NewSubscriptionForm): AddDraft {
  const fresh = addDraft(form);
  const kept = d.listId !== null && d.itemKey !== null && itemOf(form, d.listId, d.itemKey) ? withItem(fresh, form, d.listId, d.itemKey) : fresh;
  return { ...kept, payNow: d.payNow, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail };
}
