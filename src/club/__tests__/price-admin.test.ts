import { describe, expect, it } from 'vitest';
import {
  PRICE_ERRORS,
  applyItemEdit,
  buildAdminPrices,
  fieldChanges,
  nameClash,
  readNewListInput,
  readPriceItemInput,
  readPriceNotes,
  toItemData,
  type PriceItemData,
} from '../price-admin';

const sub6: PriceItemData = { name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: null, included: false };
const single: PriceItemData = { name: '1 ședință grup', kind: 'session', sessions: 1, memberPrice: null, nonMemberPrice: 150, tooltip: 'Disponibil doar pentru prima ședință', included: false };
const { included: _i, ...sub6Fields } = sub6;

describe('readPriceItemInput', () => {
  it('accepts a full item and trims texts', () => {
    expect(readPriceItemInput({ ...sub6Fields, name: '  Abonament 6 ședințe grup ', tooltip: '  ' })).toEqual({ ok: true, item: sub6Fields });
  });

  it('accepts one missing price, and both missing (saved, then flagged incomplete)', () => {
    expect(readPriceItemInput({ name: 'Gold', kind: 'subscription', memberPrice: null, nonMemberPrice: null })).toMatchObject({ ok: true });
  });

  it('refuses a missing name or kind, a bad count and a negative or text price', () => {
    expect(readPriceItemInput({ kind: 'session' })).toEqual({ ok: false, error: PRICE_ERRORS.name });
    expect(readPriceItemInput({ name: 'X', kind: 'abonament' })).toEqual({ ok: false, error: PRICE_ERRORS.kind });
    expect(readPriceItemInput({ name: 'X', kind: 'session', sessions: 1.5 })).toEqual({ ok: false, error: PRICE_ERRORS.sessions });
    expect(readPriceItemInput({ name: 'X', kind: 'session', memberPrice: -1 })).toEqual({ ok: false, error: PRICE_ERRORS.price });
    expect(readPriceItemInput({ name: 'X', kind: 'session', nonMemberPrice: '150' })).toEqual({ ok: false, error: PRICE_ERRORS.price });
    expect(readPriceItemInput(null)).toEqual({ ok: false, error: PRICE_ERRORS.name });
  });
});

describe('toItemData', () => {
  it('keeps every stored field except the component row id', () => {
    expect(toItemData([{ id: 3, ...sub6, included: true }])).toEqual([{ ...sub6, included: true }]);
    expect(toItemData(null)).toEqual([]);
  });
});

describe('applyItemEdit', () => {
  const items = [sub6, single];

  it('adds at the end', () => {
    const r = applyItemEdit(items, { kind: 'add', item: { ...sub6Fields, name: 'Abonament 8' } });
    expect(r).toMatchObject({ ok: true, before: null, after: { name: 'Abonament 8', included: false } });
    expect(r.ok && r.items).toHaveLength(3);
  });

  it('updates the row it was opened on, keeping fields the drawer does not edit', () => {
    const r = applyItemEdit([{ ...sub6, included: true }, single], { kind: 'update', index: 0, expectedName: sub6.name, item: { ...sub6Fields, memberPrice: 540 } });
    expect(r).toMatchObject({ ok: true, before: { memberPrice: 520 }, after: { memberPrice: 540, included: true } });
  });

  it('removes the row', () => {
    const r = applyItemEdit(items, { kind: 'remove', index: 1, expectedName: single.name });
    expect(r).toEqual({ ok: true, items: [sub6], before: single, after: null });
  });

  it('refuses when the row at that place is not the one the admin opened', () => {
    expect(applyItemEdit(items, { kind: 'remove', index: 0, expectedName: single.name })).toEqual({ ok: false, error: PRICE_ERRORS.stale });
    expect(applyItemEdit(items, { kind: 'remove', index: 5, expectedName: single.name })).toEqual({ ok: false, error: PRICE_ERRORS.stale });
  });
});

describe('nameClash', () => {
  it("finds the name in another list of the section, ignoring case and diacritics", () => {
    const lists = [{ items: [sub6] }, { items: [{ name: 'abonament 6 sedinte grup' }] }];
    expect(nameClash(lists, 'Abonament 6 ședințe grup')).toBe(true);
    expect(nameClash([{ items: [sub6, single] }], '1 ședință grup')).toBe(false);
  });
});

describe('fieldChanges', () => {
  it('lists only what changed, old -> new', () => {
    expect(fieldChanges(sub6, { ...sub6, memberPrice: 540, tooltip: 'x' })).toEqual({
      memberPrice: { from: 520, to: 540 },
      tooltip: { from: null, to: 'x' },
    });
  });

  it('a new or removed price shows every field against null', () => {
    expect(fieldChanges(null, single)).toMatchObject({ name: { from: null, to: '1 ședință grup' }, nonMemberPrice: { from: null, to: 150 } });
    expect(fieldChanges(single, null)).toMatchObject({ name: { from: '1 ședință grup', to: null } });
  });
});

describe('buildAdminPrices', () => {
  it('orders sections, keeps list order and flags incomplete prices', () => {
    const r = buildAdminPrices(
      [
        { documentId: 'c', name: 'Club', kind: 'club', order: 2 },
        { documentId: 's', name: 'Școala de patinaj', kind: 'school', order: 1, priceNotes: ['Nota 1', ''] },
      ],
      [
        { documentId: 'l1', name: 'Standard', section: { documentId: 's' }, items: [sub6] },
        { documentId: 'l2', name: 'Avansați Gold', section: null, items: [{ name: 'Gold 8', kind: 'subscription' }] },
      ],
    );
    expect(r.sections.map((s) => [s.documentId, s.kind, s.priceNotes])).toEqual([
      ['s', 'school', ['Nota 1']],
      ['c', 'club', []],
    ]);
    expect(r.lists.map((l) => [l.documentId, l.sectionId, l.items.map((i) => i.incomplete)])).toEqual([
      ['l1', 's', [false]],
      ['l2', null, [true]],
    ]);
    expect(r.lists[0].items[0]).not.toHaveProperty('included');
  });
});

describe('readPriceNotes and readNewListInput', () => {
  it('notes are a list of texts; blanks dropped', () => {
    expect(readPriceNotes({ priceNotes: [' A ', '', 'B'] })).toEqual(['A', 'B']);
    expect(readPriceNotes({ priceNotes: 'A' })).toBeNull();
    expect(readPriceNotes({ priceNotes: ['A', 3] })).toBeNull();
  });

  it('a new list needs a name and a section', () => {
    expect(readNewListInput({ name: ' Gold ', sectionId: 's' })).toEqual({ ok: true, name: 'Gold', sectionId: 's' });
    expect(readNewListInput({ sectionId: 's' })).toEqual({ ok: false, error: PRICE_ERRORS.listName });
    expect(readNewListInput({ name: 'Gold' })).toEqual({ ok: false, error: PRICE_ERRORS.section });
  });
});
