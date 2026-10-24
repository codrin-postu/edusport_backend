import { refuse as fail, type AdminResult } from './admin-result';
import type { HistoryInput } from './history';
import { asTextList } from './narrow';
import {
  PRICE_ERRORS,
  applyItemEdit,
  buildAdminPrices,
  duplicateNameError,
  fieldChanges,
  nameClash,
  toItemData,
  type AdminPrices,
  type ItemEdit,
  type PriceItemData,
  type RawAdminList,
  type RawAdminSection,
} from './price-admin';

/** Storage the Prețuri actions need. `strapiPriceStore` (price-admin-store.ts) is the real one; tests pass a fake. */
export interface PriceStore {
  sections(): Promise<RawAdminSection[]>;
  lists(): Promise<RawAdminList[]>;
  findList(documentId: string): Promise<RawAdminList | null>;
  findSection(documentId: string): Promise<RawAdminSection | null>;
  listNameTaken(name: string): Promise<boolean>;
  saveItems(listId: string, items: PriceItemData[]): Promise<void>;
  createList(name: string, sectionId: string): Promise<string>;
  saveNotes(sectionId: string, priceNotes: string[]): Promise<void>;
  record(entry: HistoryInput): Promise<void>;
}

const ITEM_ACTIONS: Record<ItemEdit['kind'], string> = { add: 'price-added', update: 'price-updated', remove: 'price-removed' };

export async function loadAdminPrices(store: PriceStore): Promise<AdminPrices> {
  const [sections, lists] = await Promise.all([store.sections(), store.lists()]);
  return buildAdminPrices(sections, lists);
}

const sectionOf = (list: RawAdminList) => (typeof list.section?.documentId === 'string' ? list.section.documentId : null);

/** The other lists of the same section, plus this list with its new items. */
async function sectionListsWith(store: PriceStore, list: RawAdminList, items: PriceItemData[]) {
  const others = (await store.lists()).filter((l) => l.documentId !== list.documentId && sectionOf(l) === sectionOf(list));
  return [...others.map((l) => ({ items: toItemData(l.items) })), { items }];
}

/** Adds, changes or removes one price; blocks a name already used in the section; writes history. */
export async function editPriceItem(store: PriceStore, listId: string, edit: ItemEdit, actor: string): Promise<AdminResult<AdminPrices>> {
  const list = await store.findList(listId);
  if (!list) return fail(404, PRICE_ERRORS.listMissing);
  const applied = applyItemEdit(toItemData(list.items), edit);
  if (applied.ok === false) return fail(409, applied.error);
  const renamed = applied.after && applied.after.name !== applied.before?.name;
  if (renamed && nameClash(await sectionListsWith(store, list, applied.items), applied.after.name)) {
    return fail(409, duplicateNameError(applied.after.name));
  }
  const changes = fieldChanges(applied.before, applied.after);
  if (edit.kind === 'update' && Object.keys(changes).length === 0) {
    return { ok: true, data: await loadAdminPrices(store) };
  }
  await store.saveItems(listId, applied.items);
  const item = (applied.after ?? applied.before)?.name;
  await store.record({ subjectType: 'price-list', subjectId: listId, action: ITEM_ACTIONS[edit.kind], changes: { item, ...changes }, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}

/** "+ Listă nouă": unique name, existing section; writes history. */
export async function createPriceList(store: PriceStore, name: string, sectionId: string, actor: string): Promise<AdminResult<AdminPrices>> {
  if (!(await store.findSection(sectionId))) return fail(400, PRICE_ERRORS.sectionMissing);
  if (await store.listNameTaken(name)) return fail(409, PRICE_ERRORS.listExists);
  const documentId = await store.createList(name, sectionId);
  await store.record({ subjectType: 'price-list', subjectId: documentId, action: 'created', changes: { name, sectionId }, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}

/** "Notițe subsol" of one section; history keeps the old and new paragraphs. */
export async function savePriceNotes(store: PriceStore, sectionId: string, priceNotes: string[], actor: string): Promise<AdminResult<AdminPrices>> {
  const section = await store.findSection(sectionId);
  if (!section) return fail(404, PRICE_ERRORS.sectionMissing);
  const before = asTextList(section.priceNotes);
  await store.saveNotes(sectionId, priceNotes);
  const changes = { priceNotes: { from: before, to: priceNotes } };
  await store.record({ subjectType: 'section', subjectId: sectionId, action: 'price-notes-updated', changes, actor });
  return { ok: true, data: await loadAdminPrices(store) };
}
