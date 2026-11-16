import { PRESENCE_ERRORS, SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import { SUBSCRIPTION_COPY } from '../presence/copy/subscriptions';
import { longDate } from '../presence/dates';
import type { SubscriptionListRow, SubscriptionStateFilter } from '../presence/money-api';
import { audienceOf, feeLine, itemPrice } from '../presence/subscriptions/audience';
import { defaultCover } from '../presence/subscriptions/rules';
import type { NewSubscriptionForm } from '../presence/subscriptions/views';
import type { PaymentMethod } from '../presence/types';
import { isPastDate, slotsText } from './format';
import { amountText, parseAmount } from './payment-window';
import type { FilterSection } from './plati-view';

const copy = MONEY_UI_COPY.abonamente;
const STATES: SubscriptionStateFilter[] = ['toate', 'active', 'epuizate', 'expirate', 'anulate', 'expira14'];

/** "Stare" always has a value ("Active" by default); "Grupă" starts with the panel's own "Toate" row, so it counts in the Filtre badge. Single choice each. */
export function abonamenteSections(q: { state: SubscriptionStateFilter; groupId: string | null }, groups: { value: string; label: string }[]): FilterSection[] {
  const states = STATES.map((value, i) => ({ value, label: copy.stateOptions[i] }));
  return [
    { key: 'state', label: copy.state, options: states, single: true, allLabel: null, selected: [q.state] },
    { key: 'groupId', label: copy.group, options: groups, single: true, selected: groups.some((g) => g.value === q.groupId) && q.groupId ? [q.groupId] : [] },
  ];
}

export type AbonamenteCells = { athlete: string; group: string; item: string; used: string; expires: string; expiredRed: boolean; state: string };

export function abonamenteCells(r: SubscriptionListRow, today: string): AbonamenteCells {
  return {
    athlete: r.athleteName, group: r.groupName ?? '', item: slotsText(r.slots), used: `${r.used}/${r.slots}`,
    expires: longDate(r.validUntil), expiredRed: isPastDate(r.validUntil, today), state: SUBSCRIPTION_STATE_WORDS[r.state],
  };
}

/** The "Abonament" cell: the code (muted) and "8 ședințe". */
export const abonamentCell = (r: { code: string | null; slots: number }): { code: string | null; text: string } => ({ code: r.code, text: slotsText(r.slots) });

/** Only an abonament without a payment and not yet anulat can be cancelled (5.9, C75). */
export const abonamentMenu = (r: SubscriptionListRow): 'cancel'[] => (r.canCancel ? ['cancel'] : []);

export type AddDraft = {
  listId: string | null; itemKey: string | null; startsOn: string; cover: string[]; payNow: boolean; amount: string;
  method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean; member: boolean; addFee: boolean;
};

/** The form's items that the audience of the A.C.S. box can buy, each with that audience's price. */
export function offeredLists(form: NewSubscriptionForm, member: boolean) {
  const a = audienceOf(member);
  return form.lists.map((l) => ({
    ...l, items: l.items.flatMap((i) => { const price = itemPrice(i, a); return price === null ? [] : [{ ...i, price }]; }),
  }));
}

const itemOf = (form: NewSubscriptionForm, member: boolean, listId: string | null, itemKey: string | null) =>
  offeredLists(form, member).find((l) => l.priceListId === listId)?.items.find((i) => i.itemKey === itemKey) ?? null;

/** The first list that offers something, its first item, the oldest rows ticked up to the slots, payment off, the A.C.S. box as the athlete is (C57). */
export function addDraft(form: NewSubscriptionForm): AddDraft {
  const base: AddDraft = {
    listId: null, itemKey: null, startsOn: form.startsOn, cover: [], payNow: false, amount: '', method: 'numerar', collectedAtRink: false, sendEmail: false,
    member: form.member, addFee: false,
  };
  const list = offeredLists(form, base.member).find((l) => l.items.length > 0);
  return list ? withItem(base, form, list.priceListId, list.items[0].itemKey) : { ...base, listId: form.lists[0]?.priceListId ?? null };
}

/** The form on screen was loaded for the start date now asked for (null: the form's own default); a changed date holds the submit back until its form is in (M2). */
export const formMatchesStart = (loadedFor: string | null, asked: string | null): boolean => loadedFor === asked;

/** Cover and amount follow the item. */
export function withItem(d: AddDraft, form: NewSubscriptionForm, listId: string, itemKey: string): AddDraft {
  const item = itemOf(form, d.member, listId, itemKey);
  if (!item) return d;
  return { ...d, listId, itemKey, cover: defaultCover(form.cover, listId, item.slots), amount: amountText(item.price) };
}

/** The A.C.S. box: the item list switches to the audience's prices at once; the same item stays when still offered; the fee box goes when it no longer applies. */
export function withMember(d: AddDraft, form: NewSubscriptionForm, member: boolean): AddDraft {
  const next = { ...d, member, addFee: d.addFee && feeLine(member, form.member, form.fee) !== null };
  if (next.listId !== null && next.itemKey !== null && itemOf(form, member, next.listId, next.itemKey)) return withItem(next, form, next.listId, next.itemKey);
  const fresh = addDraft({ ...form, member });
  return { ...next, listId: fresh.listId, itemKey: fresh.itemKey, cover: fresh.cover, amount: fresh.amount };
}

/** The fee box lives in the payment block: shown only with "Înregistrează plata acum" on. Ticked, it adds its own visible row and the total. */
export function feeBox(d: AddDraft, form: NewSubscriptionForm): { label: string; row: string | null; total: string | null } | null {
  const line = d.payNow ? feeLine(d.member, form.member, form.fee) : null;
  if (line === null || form.fee === null) return null;
  const amount = parseAmount(d.amount);
  return {
    label: line.label, row: d.addFee ? SUBSCRIPTION_COPY.feeRow(form.fee) : null,
    total: d.addFee && amount !== null ? SUBSCRIPTION_COPY.total(amount + form.fee) : null,
  };
}

/** The athlete's "Fără abonament" rows on the chosen list. */
export const coverRows = (d: AddDraft, form: NewSubscriptionForm) => form.cover.filter((r) => r.priceListId === d.listId);

const slotsOf = (d: AddDraft, form: NewSubscriptionForm): number => itemOf(form, d.member, d.listId, d.itemKey)?.slots ?? 0;

export const coverDisabled = (d: AddDraft, form: NewSubscriptionForm, id: string): boolean => !d.cover.includes(id) && d.cover.length >= slotsOf(d, form);

/** Never more than the slots (C23). */
export function toggleCover(d: AddDraft, form: NewSubscriptionForm, id: string): AddDraft {
  if (d.cover.includes(id)) return { ...d, cover: d.cover.filter((c) => c !== id) };
  return coverDisabled(d, form, id) ? d : { ...d, cover: [...d.cover, id] };
}

/** POST /club/athletes/:id/subscriptions body (plan 5-3 Task 5); the payment only when "Înregistrează plata acum" is on; the server prices again from `member`. */
export function addBody(d: AddDraft, form: NewSubscriptionForm): Record<string, unknown> | { error: string } {
  if (d.listId === null || d.itemKey === null) return { error: PRESENCE_ERRORS.invalid };
  const body = { itemKey: d.itemKey, priceListId: d.listId, startsOn: d.startsOn, cover: d.cover, member: d.member, addFee: false };
  if (!d.payNow) return body;
  const amount = parseAmount(d.amount);
  if (amount === null) return { error: PAYMENT_COPY.errors.amount };
  return { ...body, addFee: d.addFee && feeLine(d.member, form.member, form.fee) !== null, payment: { amount, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail } };
}

export const addToast = (name: string, withPayment: boolean): string =>
  withPayment ? SUBSCRIPTION_COPY.addedWithPayment(name) : SUBSCRIPTION_COPY.added(name);

/** The offered items of the chosen audience: the item as label, its price right-aligned as the hint; the list name joins the label when several lists offer items (C22). */
export function itemOptions(form: NewSubscriptionForm, member: boolean): { value: string; label: string; hint: string }[] {
  const lists = offeredLists(form, member);
  const several = lists.filter((l) => l.items.length > 0).length > 1;
  return lists.flatMap((l) => l.items.map((i) => ({
    value: itemValue(l.priceListId, i.itemKey), label: several ? `${i.itemName}, ${l.listName}` : i.itemName, hint: SUBSCRIPTION_COPY.price(i.price),
  })));
}

export const itemValue = (listId: string, itemKey: string): string => `${listId}|${itemKey}`;

export const extendModel = (preview: { count: number } | null, weeks: number): { text: string; button: string; disabled: boolean } => {
  const count = preview?.count ?? 0;
  return { text: SUBSCRIPTION_COPY.extendText(count, weeks), button: SUBSCRIPTION_COPY.extendButton(count), disabled: count === 0 };
};

/** The list's state filter as the address carries it; anything else is the default "Active". */
export const stateOf = (v: string | null): SubscriptionStateFilter => STATES.find((s) => s === v) ?? 'active';

/** After the start date changed: the same item when still offered, else the first; the A.C.S. box keeps the admin's choice (an untick stays), the payment choices stay, the amount follows the item. */
export function withForm(d: AddDraft, form: NewSubscriptionForm): AddDraft {
  const member = d.member;
  const fresh = addDraft({ ...form, member });
  const kept = d.listId !== null && d.itemKey !== null && itemOf(form, member, d.listId, d.itemKey) ? withItem(fresh, form, d.listId, d.itemKey) : fresh;
  return { ...kept, payNow: d.payNow, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail, member, addFee: d.addFee && feeLine(member, form.member, form.fee) !== null };
}
