import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeSections } from '../../ui-filters';
import type { SubscriptionListRow } from '../../presence/money-api';
import type { NewSubscriptionForm } from '../../presence/subscriptions/views';
import { abonamenteSections, addDraft, coverDisabled, extendModel, formMatchesStart, itemOptions, stateOf, toggleCover, addBody, feeBox, withForm, withMember } from '../abonamente-view';

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
  it('item options: the item as label, the audience price as hint, list name in the label only with several lists (C22)', () => {
    const form = formOf({ cover: [], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    expect(itemOptions(form, true)).toEqual([{ value: 'pl-std|Mini', label: 'Mini', hint: '100 lei' }]);
    expect(itemOptions(form, false)).toEqual([{ value: 'pl-std|Mini', label: 'Mini', hint: '140 lei' }]);
    const two = { ...form, lists: [...form.lists, { ...form.lists[0], priceListId: 'pl-2', listName: 'Gold' }] };
    expect(itemOptions(two, true).map((o) => o.label)).toEqual(['Mini, Standard', 'Mini, Gold']);
  });
  it('the A.C.S. box starts as the athlete is and switches the list and amount without a request', () => {
    const form = formOf({ cover: [], member: false, items: [{ itemKey: 'Mini', slots: 2, price: 100 }, { itemKey: 'Gold', slots: 4, price: 300, nonMemberPrice: null }], fee: 50 });
    const d = addDraft(form);
    expect([d.member, d.itemKey, d.amount]).toEqual([false, 'Mini', '140']);
    expect(itemOptions(form, false).map((o) => o.label)).toEqual(['Mini']);
    const on = withMember(d, form, true);
    expect([on.member, on.itemKey, on.amount]).toEqual([true, 'Mini', '100']);
    expect(itemOptions(form, true).map((o) => o.label)).toEqual(['Mini', 'Gold']);
    expect(addBody({ ...on, addFee: true }, form)).toMatchObject({ member: true, addFee: false });
    expect(addBody({ ...on, addFee: true, payNow: true, amount: '100' }, form)).toMatchObject({ member: true, addFee: true });
  });
  it('an item the new audience is not offered falls to the first one; the fee box choice goes when membership goes', () => {
    const form = formOf({ cover: [], member: true, items: [{ itemKey: 'Gold', slots: 4, price: 300, nonMemberPrice: null }, { itemKey: 'Mini', slots: 2, price: 100 }], fee: 50 });
    const d = withMember(addDraft(form), form, true);
    expect(d.itemKey).toBe('Gold');
    expect(withMember({ ...d, member: false }, form, false).itemKey).toBe('Mini');
    const off = withMember({ ...withMember(addDraft({ ...form, member: false }), { ...form, member: false }, true), addFee: true }, { ...form, member: false }, false);
    expect(off.addFee).toBe(false);
  });
  it('the fee box shows only with the payment on; ticked it adds its own row and the total; a remaining fee is shown as is', () => {
    const form = formOf({ cover: [], member: false, items: [{ itemKey: 'Mini', slots: 2, price: 100 }], fee: 170 });
    const d = withMember(addDraft(form), form, true);
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
    expect(src).toContain('feeBox(draft, form)');
    expect(src).toContain('triggerHint');
    expect(src).not.toContain('o.hint ?');
  });
  it('the extend modal (5.9)', () => {
    expect(extendModel({ count: 14 }, 2)).toEqual({ text: 'Se prelungesc 14 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare.', button: 'Prelungește 14 abonamente', disabled: false });
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
