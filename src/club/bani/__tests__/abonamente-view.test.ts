import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeSections } from '../../ui-filters';
import type { SubscriptionListRow } from '../../presence/money-api';
import type { NewSubscriptionForm } from '../../presence/subscriptions/views';
import { abonamenteSections, addDraft, coverDisabled, extendModel, formMatchesStart, itemOptions, stateOf, toggleCover, addBody, feeBox, withForm, withMember, withOption } from '../abonamente-view';

const listRow = (o: Partial<SubscriptionListRow>): SubscriptionListRow => ({
  subscriptionId: 's1', athleteId: 'a1', athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', slots: 8, used: 0, validUntil: '2026-12-01',
  expired: false, state: 'activ', canCancel: false, ...o,
});

type Item = { itemKey: string; slots: number; price: number; nonMemberPrice?: number | null };
const formOf = (o: { cover: string[]; items: Item[]; member?: boolean; fee?: number | null }): NewSubscriptionForm => ({
  athleteName: 'Ana Ionescu', hasEmail: true, member: o.member ?? true, seasonLabel: '2026-2027', fee: o.fee ?? null, startsOn: '2026-11-20', validUntil: '2026-12-18',
  lists: [{
    priceListId: 'pl-std', listName: 'Standard',
    items: o.items.map(({ price, nonMemberPrice, ...i }) => ({ ...i, memberPrice: price, nonMemberPrice: nonMemberPrice === undefined ? price + 40 : nonMemberPrice, itemName: i.itemKey, priceListId: 'pl-std', listName: 'Standard' })),
  }],
  cover: o.cover.map((id, n) => ({ attendanceId: id, date: `2026-11-0${n + 1}`, groupId: 'g1', groupName: 'Grupa', priceListId: 'pl-std' })),
});

describe('Abonamente view', () => {
  it('submit waits for the form of the asked start date (M2)', () => {
    expect([formMatchesStart(null, null), formMatchesStart(null, '2026-11-10'), formMatchesStart('2026-11-10', '2026-11-10')]).toEqual([true, false, true]);
  });
  it('Grupă counts in the Filtre badge, Stare never does (M1)', () => {
    const groups = [{ value: 'g-ib', label: 'Intermediari Bronze' }];
    expect(activeSections(abonamenteSections({ state: 'active', groupId: null }, groups))).toBe(0);
    expect(activeSections(abonamenteSections({ state: 'expirate', groupId: 'g-ib' }, groups))).toBe(1);
    expect(abonamenteSections({ state: 'active', groupId: null }, groups)[1].options).toEqual(groups);
  });
  it('the add window: first item, oldest rows ticked up to the slots, payment off (5.8, C23, C57)', () => {
    const form = formOf({ cover: ['t1', 't2', 't3'], items: [{ itemKey: 'Abonament 6 ședințe', slots: 6, price: 260 }] });
    expect(addDraft(form)).toMatchObject({ itemKey: 'Abonament 6 ședințe', cover: ['t1', 't2', 't3'], payNow: false, amount: '260', sendEmail: false });
    const two = formOf({ cover: ['t1', 't2', 't3'], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    const t = addDraft(two);
    expect(t.cover).toEqual(['t1', 't2']);
    expect(coverDisabled(t, two, 't3')).toBe(true);
    expect(toggleCover(t, two, 't3').cover).toEqual(['t1', 't2']);
    expect(coverDisabled(toggleCover(t, two, 't1'), two, 't3')).toBe(false);
  });
  it('item options: both audiences as their own option, price as hint, list name only with several lists (C22)', () => {
    const form = formOf({ cover: [], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    expect(itemOptions(form)).toEqual([
      { value: 'pl-std|member|Mini', label: 'Mini, preț membru', hint: '100 lei' },
      { value: 'pl-std|nonMember|Mini', label: 'Mini, preț neafiliat', hint: '140 lei' },
    ]);
    const two = { ...form, lists: [...form.lists, { ...form.lists[0], priceListId: 'pl-2', listName: 'Gold' }] };
    expect(itemOptions(two).map((o) => o.label)).toEqual(['Mini, Standard, preț membru', 'Mini, Standard, preț neafiliat', 'Mini, Gold, preț membru', 'Mini, Gold, preț neafiliat']);
    const only = formOf({ cover: [], items: [{ itemKey: 'Gold', slots: 4, price: 300, nonMemberPrice: null }] });
    expect(itemOptions(only).map((o) => o.label)).toEqual(['Gold, preț membru']);
  });
  it('the draft starts on the athlete audience; picking an option sets the amount and never the A.C.S. box', () => {
    const form = formOf({ cover: [], member: false, items: [{ itemKey: 'Mini', slots: 2, price: 100 }], fee: 50 });
    const d = addDraft(form);
    expect([d.member, d.audience, d.itemKey, d.amount]).toEqual([false, 'nonMember', 'Mini', '140']);
    const pick = withOption(d, form, { listId: 'pl-std', itemKey: 'Mini', audience: 'member' });
    expect([pick.member, pick.audience, pick.amount]).toEqual([false, 'member', '100']);
    expect(addBody(pick, form)).toMatchObject({ audience: 'member', member: false });
  });
  it('the A.C.S. box only turns membership on in the draft; the price option stays; the fee box follows', () => {
    const form = formOf({ cover: [], member: false, items: [{ itemKey: 'Mini', slots: 2, price: 100 }], fee: 50 });
    const on = withMember(addDraft(form), form, true);
    expect([on.member, on.audience, on.amount]).toEqual([true, 'nonMember', '140']);
    expect(addBody({ ...on, addFee: true }, form)).toMatchObject({ member: true, addFee: false });
    expect(addBody({ ...on, addFee: true, payNow: true, amount: '140' }, form)).toMatchObject({ member: true, audience: 'nonMember', addFee: true });
    expect(withMember({ ...on, addFee: true }, form, false).addFee).toBe(false);
  });
  it('a date change keeps the chosen option when still offered, else the first', () => {
    const form = formOf({ cover: [], items: [{ itemKey: 'Mini', slots: 2, price: 100 }, { itemKey: 'Gold', slots: 4, price: 300 }] });
    const picked = withOption(addDraft(form), form, { listId: 'pl-std', itemKey: 'Gold', audience: 'nonMember' });
    expect(withForm(picked, form)).toMatchObject({ itemKey: 'Gold', audience: 'nonMember', amount: '340' });
    const gone = formOf({ cover: [], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    expect(withForm(picked, gone)).toMatchObject({ itemKey: 'Mini', audience: 'member' });
  });
  it('the fee box shows only with the payment on; ticked it adds its own row and the total; a remaining fee is shown as is', () => {
    const form = formOf({ cover: [], member: false, items: [{ itemKey: 'Mini', slots: 2, price: 100 }], fee: 170 });
    const d = withOption(withMember(addDraft(form), form, true), form, { listId: 'pl-std', itemKey: 'Mini', audience: 'member' });
    expect(feeBox(d, form)).toBeNull();
    const pay = { ...d, payNow: true };
    expect(feeBox(pay, form)).toEqual({ label: 'Adaugă cotizația (170 lei)', row: null, total: null });
    expect(feeBox({ ...pay, addFee: true }, form)).toEqual({ label: 'Adaugă cotizația (170 lei)', row: 'Cotizație 170 lei', total: 'Total 270 lei' });
    expect(feeBox(pay, { ...form, fee: 0 })).toBeNull();
    expect(feeBox({ ...pay, member: false }, form)).toBeNull();
  });
  it('a date change keeps a deliberate untick for an existing member', () => {
    const form = formOf({ cover: [], member: true, items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    const unticked = withMember(addDraft(form), form, false);
    expect(withForm(unticked, form).member).toBe(false);
  });
  it('the window source: box on top from the athlete, price as hint, fee box by feeLine', () => {
    const src = readFileSync(join(__dirname, '../../../admin/dashboard/bani/AddSubscriptionWindow.tsx'), 'utf8');
    expect(src).toContain('SUBSCRIPTION_COPY.memberBox(form.seasonLabel)');
    expect(src).toContain('withMember(d, form, member)');
    expect(src).toContain('withOption(d, form');
    expect(src).toContain('feeBox(draft, form)');
    expect(src).toContain('triggerHint');
    expect(src).not.toContain('o.hint ?');
  });
  it('the extend modal (5.9)', () => {
    expect(extendModel({ count: 14 }, 2)).toEqual({ text: 'Se prelungesc 14 abonamente active cu 2 săptămâni.', button: 'Prelungește 14 abonamente', disabled: false });
    expect(extendModel({ count: 0 }, 1).disabled).toBe(true);
    expect(extendModel(null, 1).disabled).toBe(true);
  });
});

describe('Abonament code and the 14 day filter (11-5 5.7)', () => {
  it('"Stare" ends with "Expiră în 14 zile" (expira14)', () => {
    const [state] = abonamenteSections({ state: 'expira14', groupId: null }, []);
    expect(state.options.at(-1)).toEqual({ value: 'expira14', label: 'Expiră în 14 zile' });
    expect(state.selected).toEqual(['expira14']);
    expect(stateOf('expira14')).toBe('expira14');
  });
});
