import { describe, expect, it } from 'vitest';
import type { HistoryInput } from '../history';
import { PRICE_ERRORS, duplicateNameError, type PriceItemData, type RawAdminList, type RawAdminSection } from '../price-admin';
import { createPriceList, editPriceItem, savePriceNotes, type PriceStore } from '../price-admin-service';

const item = (name: string, extra: Partial<PriceItemData> = {}): PriceItemData => ({
  name,
  kind: 'subscription',
  sessions: 8,
  memberPrice: 590,
  nonMemberPrice: 790,
  tooltip: null,
  included: false,
  ...extra,
});

function fakeStore() {
  const sections: RawAdminSection[] = [
    { documentId: 's', name: 'Școala de patinaj', kind: 'school', order: 1, priceNotes: ['Veche'] },
    { documentId: 'c', name: 'Club', kind: 'club', order: 2 },
  ];
  const lists: RawAdminList[] = [
    { documentId: 'std', name: 'Standard', section: { documentId: 's' }, items: [item('Abonament 8 ședințe grup')] },
    { documentId: 'gold', name: 'Avansați Gold', section: { documentId: 's' }, items: [] },
    { documentId: 'clb', name: 'Club lunar', section: { documentId: 'c' }, items: [item('Gold 8')] },
  ];
  const history: HistoryInput[] = [];
  const saved: string[] = [];
  const store: PriceStore = {
    sections: async () => sections,
    lists: async () => lists,
    findList: async (id) => lists.find((l) => l.documentId === id) ?? null,
    findSection: async (id) => sections.find((s) => s.documentId === id) ?? null,
    listNameTaken: async (name) => lists.some((l) => String(l.name).toLowerCase() === name.toLowerCase()),
    saveItems: async (id, items) => {
      saved.push(id);
      lists.find((l) => l.documentId === id)!.items = items;
    },
    createList: async (name, sectionId) => {
      lists.push({ documentId: 'new', name, section: { documentId: sectionId }, items: [] });
      return 'new';
    },
    saveNotes: async (id, notes) => {
      sections.find((s) => s.documentId === id)!.priceNotes = notes;
    },
    record: async (entry) => {
      history.push(entry);
    },
  };
  return { store, history, saved, lists };
}

const fields = (name: string) => {
  const { included: _i, ...f } = item(name);
  return f;
};

describe('editPriceItem', () => {
  it('adds a price, records who and what, and answers with the fresh page data', async () => {
    const { store, history } = fakeStore();
    const r = await editPriceItem(store, 'gold', { kind: 'add', item: fields('Abonament Avansați Gold 8 ședințe') }, 'ana@club.ro');
    expect(r.ok && r.data.lists.find((l) => l.documentId === 'gold')?.items.map((i) => i.name)).toEqual(['Abonament Avansați Gold 8 ședințe']);
    expect(history).toEqual([
      expect.objectContaining({
        subjectType: 'price-list',
        subjectId: 'gold',
        action: 'price-added',
        actor: 'ana@club.ro',
        changes: expect.objectContaining({ item: 'Abonament Avansați Gold 8 ședințe', memberPrice: { from: null, to: 590 } }),
      }),
    ]);
  });

  it("blocks a name already used in another list of the same school, and saves nothing", async () => {
    const { store, history, saved } = fakeStore();
    const r = await editPriceItem(store, 'gold', { kind: 'add', item: fields('abonament 8 sedinte grup') }, 'ana@club.ro');
    expect(r).toEqual({ ok: false, status: 409, error: duplicateNameError('abonament 8 sedinte grup') });
    expect(saved).toEqual([]);
    expect(history).toEqual([]);
  });

  it('allows the same name in another section', async () => {
    const { store } = fakeStore();
    await expect(editPriceItem(store, 'gold', { kind: 'add', item: fields('Gold 8') }, 'a')).resolves.toMatchObject({ ok: true });
  });

  it('changing only the price of an item keeps its name without a clash', async () => {
    const { store, history } = fakeStore();
    const edit = { kind: 'update' as const, index: 0, expectedName: 'Abonament 8 ședințe grup', item: { ...fields('Abonament 8 ședințe grup'), memberPrice: 610 } };
    await expect(editPriceItem(store, 'std', edit, 'a')).resolves.toMatchObject({ ok: true });
    expect(history[0]).toMatchObject({ action: 'price-updated', changes: { item: 'Abonament 8 ședințe grup', memberPrice: { from: 590, to: 610 } } });
  });

  it('removes a price and keeps it in history', async () => {
    const { store, history } = fakeStore();
    const r = await editPriceItem(store, 'std', { kind: 'remove', index: 0, expectedName: 'Abonament 8 ședințe grup' }, 'a');
    expect(r.ok && r.data.lists.find((l) => l.documentId === 'std')?.items).toEqual([]);
    expect(history[0]).toMatchObject({ action: 'price-removed', changes: { item: 'Abonament 8 ședințe grup', name: { from: 'Abonament 8 ședințe grup', to: null } } });
  });

  it('refuses a missing list (404) and a row changed meanwhile (409)', async () => {
    const { store } = fakeStore();
    await expect(editPriceItem(store, 'nope', { kind: 'remove', index: 0, expectedName: 'x' }, 'a')).resolves.toEqual({ ok: false, status: 404, error: PRICE_ERRORS.listMissing });
    await expect(editPriceItem(store, 'std', { kind: 'remove', index: 0, expectedName: 'Alt nume' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: PRICE_ERRORS.stale });
  });

  it('writes nothing when the submitted item is unchanged', async () => {
    const { store, history, saved } = fakeStore();
    const edit = { kind: 'update' as const, index: 0, expectedName: 'Abonament 8 ședințe grup', item: fields('Abonament 8 ședințe grup') };
    await expect(editPriceItem(store, 'std', edit, 'a')).resolves.toMatchObject({ ok: true });
    expect(saved).toEqual([]);
    expect(history).toEqual([]);
  });
});

describe('createPriceList', () => {
  it('creates an empty list in the section and records it', async () => {
    const { store, history } = fakeStore();
    const r = await createPriceList(store, 'Vară', 's', 'a');
    expect(r.ok && r.data.lists.map((l) => l.name)).toContain('Vară');
    expect(history[0]).toMatchObject({ subjectType: 'price-list', subjectId: 'new', action: 'created', changes: { name: 'Vară', sectionId: 's' } });
  });

  it('refuses an existing name and an unknown section', async () => {
    const { store } = fakeStore();
    await expect(createPriceList(store, 'standard', 's', 'a')).resolves.toEqual({ ok: false, status: 409, error: PRICE_ERRORS.listExists });
    await expect(createPriceList(store, 'Vară', 'x', 'a')).resolves.toEqual({ ok: false, status: 400, error: PRICE_ERRORS.sectionMissing });
  });
});

describe('savePriceNotes', () => {
  it('saves the paragraphs and records old -> new', async () => {
    const { store, history } = fakeStore();
    const r = await savePriceNotes(store, 's', ['Nouă'], 'a');
    expect(r.ok && r.data.sections[0].priceNotes).toEqual(['Nouă']);
    expect(history[0]).toMatchObject({ subjectType: 'section', subjectId: 's', action: 'price-notes-updated', changes: { priceNotes: { from: ['Veche'], to: ['Nouă'] } } });
  });

  it('refuses an unknown section', async () => {
    await expect(savePriceNotes(fakeStore().store, 'x', [], 'a')).resolves.toEqual({ ok: false, status: 404, error: PRICE_ERRORS.sectionMissing });
  });
});
