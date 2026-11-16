import { PRESENCE_ERRORS, SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import { SUBSCRIPTION_COPY } from '../presence/copy/subscriptions';
import { longDate } from '../presence/dates';
import type { SubscriptionListRow, SubscriptionStateFilter } from '../presence/money-api';
import type { Audience } from '../price-item';
import { AUDIENCES, audienceOf, feeLine, itemPrice } from '../presence/subscriptions/audience';
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
  listId: string | null; itemKey: string | null; audience: Audience; startsOn: string; cover: string[]; payNow: boolean; amount: string;
  method: PaymentMethod; collectedAtRink: boolean; sendEmail: boolean; member: boolean; addFee: boolean;
};

export type PriceOption = { listId: string; listName: string; itemKey: string; itemName: string; slots: number; audience: Audience; price: number };

/** Every item of every list once per audience that has a price: "<item>, preț membru" and "<item>, preț neafiliat". */
export function priceOptions(form: NewSubscriptionForm): PriceOption[] {
  return form.lists.flatMap((l) => l.items.flatMap((i) => AUDIENCES.flatMap((audience) => {
    const price = itemPrice(i, audience);
    return price === null ? [] : [{ listId: l.priceListId, listName: l.listName, itemKey: i.itemKey, itemName: i.itemName, slots: i.slots, audience, price }];
  })));
}

const optionOf = (form: NewSubscriptionForm, listId: string | null, itemKey: string | null, audience: Audience): PriceOption | null =>
  priceOptions(form).find((o) => o.listId === listId && o.itemKey === itemKey && o.audience === audience) ?? null;

/** The first option, the athlete's own audience first, the oldest rows ticked up to the slots, payment off, the A.C.S. box as the athlete is (C57). */
export function addDraft(form: NewSubscriptionForm): AddDraft {
  const audience = audienceOf(form.member);
  const base: AddDraft = {
    listId: null, itemKey: null, audience, startsOn: form.startsOn, cover: [], payNow: false, amount: '', method: 'numerar', collectedAtRink: false, sendEmail: false,
    member: form.member, addFee: false,
  };
  const options = priceOptions(form);
  const first = options.find((o) => o.audience === audience) ?? options[0];
  return first ? withOption(base, form, first) : { ...base, listId: form.lists[0]?.priceListId ?? null };
}

/** The form on screen was loaded for the start date now asked for (null: the form's own default); a changed date holds the submit back until its form is in (M2). */
export const formMatchesStart = (loadedFor: string | null, asked: string | null): boolean => loadedFor === asked;

/** Cover and amount follow the chosen option (item and audience). */
export function withOption(d: AddDraft, form: NewSubscriptionForm, o: { listId: string; itemKey: string; audience: Audience }): AddDraft {
  const option = optionOf(form, o.listId, o.itemKey, o.audience);
  if (!option) return d;
  return { ...d, listId: o.listId, itemKey: o.itemKey, audience: o.audience, cover: defaultCover(form.cover, o.listId, option.slots), amount: amountText(option.price) };
}

/** The A.C.S. box only decides membership: the price option stays; the fee box goes when it no longer applies. */
export const withMember = (d: AddDraft, form: NewSubscriptionForm, member: boolean): AddDraft =>
  ({ ...d, member, addFee: d.addFee && feeLine(member, form.member, form.fee) !== null });

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

const slotsOf = (d: AddDraft, form: NewSubscriptionForm): number => optionOf(form, d.listId, d.itemKey, d.audience)?.slots ?? 0;

export const coverDisabled = (d: AddDraft, form: NewSubscriptionForm, id: string): boolean => !d.cover.includes(id) && d.cover.length >= slotsOf(d, form);

/** Never more than the slots (C23). */
export function toggleCover(d: AddDraft, form: NewSubscriptionForm, id: string): AddDraft {
  if (d.cover.includes(id)) return { ...d, cover: d.cover.filter((c) => c !== id) };
  return coverDisabled(d, form, id) ? d : { ...d, cover: [...d.cover, id] };
}

/** POST /club/athletes/:id/subscriptions body (plan 5-3 Task 5); the payment only when "Înregistrează plata acum" is on; the server prices again from `audience` and the item. */
export function addBody(d: AddDraft, form: NewSubscriptionForm): Record<string, unknown> | { error: string } {
  if (d.listId === null || d.itemKey === null) return { error: PRESENCE_ERRORS.invalid };
  const body = { itemKey: d.itemKey, priceListId: d.listId, audience: d.audience, startsOn: d.startsOn, cover: d.cover, member: d.member, addFee: false };
  if (!d.payNow) return body;
  const amount = parseAmount(d.amount);
  if (amount === null) return { error: PAYMENT_COPY.errors.amount };
  return { ...body, addFee: d.addFee && feeLine(d.member, form.member, form.fee) !== null, payment: { amount, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail } };
}

export const addToast = (name: string, withPayment: boolean): string =>
  withPayment ? SUBSCRIPTION_COPY.addedWithPayment(name) : SUBSCRIPTION_COPY.added(name);

/** Both audiences' options: "<item>, preț membru" or "<item>, preț neafiliat" as label, the price right-aligned as the hint; the list name joins the label when several lists offer items (C22). */
export function itemOptions(form: NewSubscriptionForm): { value: string; label: string; hint: string }[] {
  const options = priceOptions(form);
  const several = new Set(options.map((o) => o.listId)).size > 1;
  return options.map((o) => ({
    value: itemValue(o.listId, o.itemKey, o.audience),
    label: [o.itemName, ...(several ? [o.listName] : []), SUBSCRIPTION_COPY.priceWord[o.audience]].join(', '),
    hint: SUBSCRIPTION_COPY.price(o.price),
  }));
}

export const itemValue = (listId: string, itemKey: string, audience: Audience): string => `${listId}|${audience}|${itemKey}`;

export const extendModel = (preview: { count: number } | null, weeks: number): { text: string; button: string; disabled: boolean } => {
  const count = preview?.count ?? 0;
  return { text: SUBSCRIPTION_COPY.extendText(count, weeks), button: SUBSCRIPTION_COPY.extendButton(count), disabled: count === 0 };
};

/** The list's state filter as the address carries it; anything else is the default "Active". */
export const stateOf = (v: string | null): SubscriptionStateFilter => STATES.find((s) => s === v) ?? 'active';

/** After the start date changed: the same option when still offered, else the first; the A.C.S. box keeps the admin's choice (an untick stays), the payment choices stay, the amount follows the option. */
export function withForm(d: AddDraft, form: NewSubscriptionForm): AddDraft {
  const fresh = addDraft({ ...form, member: d.member });
  const kept = optionOf(form, d.listId, d.itemKey, d.audience) ? withOption(fresh, form, { listId: d.listId ?? '', itemKey: d.itemKey ?? '', audience: d.audience }) : fresh;
  return { ...kept, payNow: d.payNow, method: d.method, collectedAtRink: d.collectedAtRink, sendEmail: d.sendEmail, member: d.member, addFee: d.addFee && feeLine(d.member, form.member, form.fee) !== null };
}
