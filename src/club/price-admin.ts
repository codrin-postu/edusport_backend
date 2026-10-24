import { changedFields, type FieldChange } from './admin-result';
import { nameKey } from './migrate/names';
import { asText, asTextList } from './narrow';
import { duplicateItemNames, isIncomplete, isPrice, isPriceItemKind, type PriceItemKind } from './price-item';

/** One price item as the Prețuri drawer edits it. */
export type PriceItemFields = {
  name: string;
  kind: PriceItemKind;
  sessions: number | null;
  memberPrice: number | null;
  nonMemberPrice: number | null;
  tooltip: string | null;
};
/** The full stored component (`club.price-item`), written back on every change. */
export type PriceItemData = PriceItemFields & { included: boolean };
export type AdminPriceItem = PriceItemFields & { incomplete: boolean };
export type AdminPriceList = { documentId: string; name: string; sectionId: string | null; items: AdminPriceItem[] };
export type AdminSection = { documentId: string; name: string; kind: 'school' | 'club'; priceNotes: string[] };
/** GET /api/club/prices and every Prețuri mutation answer with this. */
export type AdminPrices = { sections: AdminSection[]; lists: AdminPriceList[] };

export type RawAdminList = { documentId?: unknown; name?: unknown; section?: { documentId?: unknown } | null; items?: unknown };
export type RawAdminSection = { documentId?: unknown; name?: unknown; kind?: unknown; order?: unknown; priceNotes?: unknown };

export type ItemEdit =
  | { kind: 'add'; item: PriceItemFields }
  | { kind: 'update'; index: number; expectedName: string; item: PriceItemFields }
  | { kind: 'remove'; index: number; expectedName: string };
export type ItemEditResult =
  | { ok: true; items: PriceItemData[]; before: PriceItemData | null; after: PriceItemData | null }
  | { ok: false; error: string };

export const PRICE_ERRORS = {
  name: 'Numele este obligatoriu.',
  kind: 'Alege tipul.',
  sessions: 'Numărul de ședințe nu este valid.',
  price: 'Prețul nu este valid.',
  listName: 'Numele listei este obligatoriu.',
  listExists: 'Există deja o listă cu acest nume.',
  section: 'Alege secțiunea.',
  listMissing: 'Lista nu mai există.',
  sectionMissing: 'Secțiunea nu mai există.',
  stale: 'Lista s-a schimbat între timp. Reîncarcă pagina.',
  notes: 'Notițele nu sunt valide.',
} as const;

export const duplicateNameError = (name: string) => `Numele „${name}” este deja folosit în această secțiune.`;

const FIELDS = ['name', 'kind', 'sessions', 'memberPrice', 'nonMemberPrice', 'tooltip'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isEmpty = (v: unknown) => v === null || v === undefined;
const priceOrNull = (v: unknown) => (isPrice(v) ? v : null);

function itemInputError(body: Record<string, unknown>): string | null {
  if (!asText(body.name)) return PRICE_ERRORS.name;
  if (!isPriceItemKind(body.kind)) return PRICE_ERRORS.kind;
  if (!isEmpty(body.sessions) && !isCount(body.sessions)) return PRICE_ERRORS.sessions;
  const badPrice = [body.memberPrice, body.nonMemberPrice].some((p) => !isEmpty(p) && !isPrice(p));
  return badPrice ? PRICE_ERRORS.price : null;
}

/** The drawer's body, checked: name and kind required, counts and prices non-negative or empty. */
export function readPriceItemInput(raw: unknown): { ok: true; item: PriceItemFields } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const error = itemInputError(body);
  if (error) return { ok: false, error };
  return { ok: true, item: toItemFields(body) };
}

/** Any stored or posted item, as clean fields. */
export function toItemFields(raw: Record<string, unknown>): PriceItemFields {
  return {
    name: asText(raw.name),
    kind: isPriceItemKind(raw.kind) ? raw.kind : 'subscription',
    sessions: isCount(raw.sessions) ? raw.sessions : null,
    memberPrice: priceOrNull(raw.memberPrice),
    nonMemberPrice: priceOrNull(raw.nonMemberPrice),
    tooltip: asText(raw.tooltip) || null,
  };
}

/** Stored component rows as write-ready data (the row `id` is dropped; Strapi recreates the rows). */
export function toItemData(items: unknown): PriceItemData[] {
  if (!Array.isArray(items)) return [];
  return items.filter(isRecord).map((raw) => ({ ...toItemFields(raw), included: raw.included === true }));
}

function checkExpected(items: PriceItemData[], index: number, expectedName: string): PriceItemData | null {
  const current = items[index];
  return current && current.name === expectedName.trim() ? current : null;
}

/** Applies one drawer action to a list's items; refuses when the row changed since the page loaded. */
export function applyItemEdit(items: PriceItemData[], edit: ItemEdit): ItemEditResult {
  if (edit.kind === 'add') {
    const after = { ...edit.item, included: false };
    return { ok: true, items: [...items, after], before: null, after };
  }
  const before = checkExpected(items, edit.index, edit.expectedName);
  if (!before) return { ok: false, error: PRICE_ERRORS.stale };
  if (edit.kind === 'remove') return { ok: true, items: items.filter((_, i) => i !== edit.index), before, after: null };
  const after = { ...before, ...edit.item };
  return { ok: true, items: items.map((it, i) => (i === edit.index ? after : it)), before, after };
}

/** True when `name` would appear twice across one section's lists (case, spaces and diacritics ignored). */
export function nameClash(sectionLists: { items?: { name?: unknown }[] | null }[], name: string): boolean {
  return duplicateItemNames(sectionLists).some((d) => nameKey(d) === nameKey(name));
}

/** History payload: every edited field with its old and new value (null for a side that does not exist). */
export function fieldChanges(before: PriceItemFields | null, after: PriceItemFields | null): Record<string, FieldChange> {
  return changedFields<PriceItemFields>(FIELDS, before, after);
}

function toAdminSection(raw: RawAdminSection): AdminSection | null {
  const name = asText(raw.name);
  if (typeof raw.documentId !== 'string' || !name) return null;
  return { documentId: raw.documentId, name, kind: raw.kind === 'club' ? 'club' : 'school', priceNotes: asTextList(raw.priceNotes) };
}

function toAdminList(raw: RawAdminList): AdminPriceList | null {
  if (typeof raw.documentId !== 'string') return null;
  const sectionId = typeof raw.section?.documentId === 'string' ? raw.section.documentId : null;
  const items = toItemData(raw.items).map(({ included: _included, ...f }) => ({ ...f, incomplete: isIncomplete(f) }));
  return { documentId: raw.documentId, name: asText(raw.name), sectionId, items };
}

const rank = (s: RawAdminSection) => (typeof s.order === 'number' ? s.order : Number.MAX_SAFE_INTEGER);

/** Sections by `order`, then name; lists in the order given (the loader sorts them by creation). */
export function buildAdminPrices(sections: RawAdminSection[], lists: RawAdminList[]): AdminPrices {
  const sorted = [...sections].sort((a, b) => rank(a) - rank(b) || asText(a.name).localeCompare(asText(b.name), 'ro'));
  return {
    sections: sorted.map(toAdminSection).filter((s): s is AdminSection => s !== null),
    lists: lists.map(toAdminList).filter((l): l is AdminPriceList => l !== null),
  };
}

/** "Notițe subsol": a list of paragraphs; blanks dropped. null when the body is not a list of texts. */
export function readPriceNotes(raw: unknown): string[] | null {
  const notes = isRecord(raw) ? raw.priceNotes : undefined;
  if (!Array.isArray(notes) || notes.some((n) => typeof n !== 'string')) return null;
  return asTextList(notes);
}

/** "+ Listă nouă": a name and the section it belongs to. */
export function readNewListInput(raw: unknown): { ok: true; name: string; sectionId: string } | { ok: false; error: string } {
  const body = isRecord(raw) ? raw : {};
  const name = asText(body.name);
  const sectionId = asText(body.sectionId);
  if (!name) return { ok: false, error: PRICE_ERRORS.listName };
  if (!sectionId) return { ok: false, error: PRICE_ERRORS.section };
  return { ok: true, name, sectionId };
}
