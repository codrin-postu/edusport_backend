import { describe, expect, it } from 'vitest';
import { activeSections } from '../../ui-filters';
import type { SubscriptionListRow } from '../../presence/money-api';
import type { NewSubscriptionForm } from '../../presence/subscriptions/views';
import { abonamentCell, abonamentMenu, abonamenteCells, abonamenteSections, addBody, addDraft, addToast, coverDisabled, extendModel, formMatchesStart, itemOptions, stateOf, toggleCover } from '../abonamente-view';

const listRow = (o: Partial<SubscriptionListRow>): SubscriptionListRow => ({
  subscriptionId: 's1', athleteId: 'a1', athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', slots: 8, used: 0, validUntil: '2026-12-01',
  expired: false, state: 'activ', canCancel: false, ...o,
});

const formOf = (o: { cover: string[]; items: { itemKey: string; slots: number; price: number }[] }): NewSubscriptionForm => ({
  athleteName: 'Ana Ionescu', hasEmail: true, audience: 'member', startsOn: '2026-11-20', validUntil: '2026-12-18',
  lists: [{
    priceListId: 'pl-std', listName: 'Standard',
    items: o.items.map((i) => ({ ...i, itemName: i.itemKey, priceListId: 'pl-std', listName: 'Standard' })),
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
  it('row cells and the red past date; menu hidden with a payment or when anulat (5.9, C75)', () => {
    const r = listRow({ athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', slots: 8, used: 5, validUntil: '2026-11-07', state: 'activ', canCancel: true });
    expect(abonamenteCells(r, '2026-11-20')).toEqual({ athlete: 'Ana Ionescu', group: 'Intermediari Bronze', item: '8 ședințe', used: '5/8', expires: '7 noi 2026', expiredRed: true, state: 'activ' });
    expect(abonamentMenu({ ...r, canCancel: false })).toEqual([]);
    expect(abonamentMenu(r)).toEqual(['cancel']);
    expect(abonamenteSections({ state: 'active', groupId: null }, [{ value: 'g-ib', label: 'Intermediari Bronze' }]).map((s) => [s.label, s.selected])).toEqual([['Stare', ['active']], ['Grupă', []]]);
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
  it('the body and the toast (plan 5-3 Task 5, 5.8)', () => {
    const form = formOf({ cover: ['t1'], items: [{ itemKey: 'Abonament 8 ședințe', slots: 8, price: 320 }] });
    expect(addBody(addDraft(form))).toEqual({ itemKey: 'Abonament 8 ședințe', priceListId: 'pl-std', startsOn: '2026-11-20', cover: ['t1'] });
    expect(addBody({ ...addDraft(form), payNow: true, amount: '320', sendEmail: true })).toMatchObject({ payment: { amount: 320, method: 'numerar', collectedAtRink: false, sendEmail: true } });
    expect(addBody({ ...addDraft(form), payNow: true, amount: '0' })).toEqual({ error: 'Suma trebuie să fie mai mare decât 0.' });
    expect([addToast('Ana Ionescu', false), addToast('Ana Ionescu', true)]).toEqual(['Abonament adăugat: Ana Ionescu.', 'Abonament și plată înregistrate: Ana Ionescu.']);
  });
  it('item options: audience price, list name as hint only with several lists (C22)', () => {
    const form = formOf({ cover: [], items: [{ itemKey: 'Mini', slots: 2, price: 100 }] });
    expect(itemOptions(form)).toEqual([{ value: 'pl-std|Mini', label: 'Mini, preț membru', hint: null }]);
    const two = { ...form, lists: [...form.lists, { ...form.lists[0], priceListId: 'pl-2', listName: 'Gold' }] };
    expect(itemOptions(two).map((o) => o.hint)).toEqual(['Standard', 'Gold']);
  });
  it('the extend modal (5.9)', () => {
    expect(extendModel({ count: 14 }, 2)).toEqual({ text: 'Se prelungesc 14 abonamente active cu 2 săptămâni. Noua dată de expirare se calculează pentru fiecare.', button: 'Prelungește 14 abonamente', disabled: false });
    expect(extendModel({ count: 0 }, 1).disabled).toBe(true);
    expect(extendModel(null, 1).disabled).toBe(true);
  });
});

describe('Abonament code and the 14 day filter (11-5 5.7)', () => {
  it('cell: code muted before "8 ședințe"; no code: empty', () => {
    expect(abonamentCell({ code: 'A-0124', slots: 8 })).toEqual({ code: 'A-0124', text: '8 ședințe' });
    expect(abonamentCell({ code: null, slots: 1 })).toEqual({ code: null, text: '1 ședință' });
  });
  it('"Stare" ends with "Expiră în 14 zile" (expira14)', () => {
    const [state] = abonamenteSections({ state: 'expira14', groupId: null }, []);
    expect(state.options.at(-1)).toEqual({ value: 'expira14', label: 'Expiră în 14 zile' });
    expect(state.selected).toEqual(['expira14']);
    expect(stateOf('expira14')).toBe('expira14');
  });
});
