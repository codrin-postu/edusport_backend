import { parseBirthDate, roDate } from './birth-date';
import { REGISTRATION_FIELD_LABELS } from './history-text';
import { EDIT_TOASTS, PANEL_COPY } from './inscrieri-copy';
import { LEGACY_DATE_KEYS, LEGACY_LABELS, cellText, type InscriereRow, type ToastSpec } from './inscrieri-panel';
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OTHER,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER,
  SOURCE_OTHER_LABEL,
} from './registration-form-options';
import { RELATIONSHIP_EDIT_OPTIONS, isScriptFormRegistration } from './registration-panel';
import { BIRTH_DATE_ERROR, EMPTY_DATE, partsFromDisplay, partsToDisplay, type DateParts } from './ui-birth-date';

/**
 * "Editează" in the Date tab (spec 3.4): every answer in one form, the wish last under "Abonament".
 * Nr. înscriere, Trimis la and the consents are never edited. "De unde ați aflat" is editable
 * there too (plan header RESOLVED #6, option B): plan 3-2 Task 14 adds source/sourceOther to
 * EDITABLE_FIELDS. Pure; the admin form renders these fields.
 */
export type EditKind = 'text' | 'textarea' | 'height' | 'select' | 'birthDate' | 'bool';
export type EditOption = { value: string; label: string };
export type EditField = { key: string; label: string; kind: EditKind; options?: readonly EditOption[]; section?: 'abonament' };
export type EditDraft = { text: Record<string, string>; bools: Record<string, boolean>; birth: DateParts; birthTouched: boolean };
export type EditPatch = { patch: Record<string, unknown>; error: string | null };

const L = REGISTRATION_FIELD_LABELS;
const field = (key: string, kind: EditKind, label: string = L[key], options?: readonly EditOption[]): EditField =>
  options ? { key, label, kind, options } : { key, label, kind };
const LAST_SEASON_CHOICES: readonly EditOption[] = LAST_SEASON_OPTIONS.map((v) => ({ value: v, label: v }));
const SOURCE_CHOICES: readonly EditOption[] = SOURCE_OPTIONS.map((v) => ({ value: v, label: v }));

const SCRIPT_FIELDS: readonly EditField[] = [
  field('email', 'text'),
  field('parentName', 'text'),
  field('relationship', 'select', L.relationship, RELATIONSHIP_EDIT_OPTIONS),
  field('relationshipOther', 'text', RELATIONSHIP_OTHER_LABEL),
  field('phone', 'text'),
  field('childName', 'text'),
  field('childBirthDate', 'birthDate'),
  field('childHeight', 'height'),
  field('shirtSize', 'text'),
  field('lastSeason', 'select', L.lastSeason, LAST_SEASON_CHOICES),
  field('priorExperience', 'textarea'),
  field('expectations', 'textarea'),
  { ...field('membershipAnswer', 'select', L.membershipAnswer, MEMBERSHIP_OPTIONS), section: 'abonament' },
  { ...field('source', 'select', PANEL_COPY.abonament.source, SOURCE_CHOICES), section: 'abonament' },
  { ...field('sourceOther', 'text', SOURCE_OTHER_LABEL), section: 'abonament' },
];

const LEGACY_KIND: Readonly<Record<string, EditKind>> = { childBirthDate: 'birthDate', priorExperience: 'textarea', expectations: 'textarea' };

/** Old registrations (Needs decision 3, option A): their Date answers, then "Cum a aflat" and "Interes club" under "Abonament". */
const LEGACY_FIELDS: readonly EditField[] = [
  ...LEGACY_DATE_KEYS.map((key) => field(key, LEGACY_KIND[key] ?? 'text', LEGACY_LABELS[key])),
  { ...field('howHeard', 'text', LEGACY_LABELS.howHeard), section: 'abonament' },
  { ...field('clubInterest', 'bool', LEGACY_LABELS.clubInterest), section: 'abonament' },
];

export const editFields = (row: InscriereRow): readonly EditField[] => (isScriptFormRegistration(row) ? SCRIPT_FIELDS : LEGACY_FIELDS);

/** The "Alta" texts show only while their select is on the "Alta" / "Altele" answer (as the form). */
export const visibleFields = (fields: readonly EditField[], draft: EditDraft): EditField[] =>
  fields.filter(
    (f) =>
      (f.key !== 'relationshipOther' || draft.text.relationship === RELATIONSHIP_OTHER) &&
      (f.key !== 'sourceOther' || draft.text.source === SOURCE_OTHER),
  );

/** The stored text date in the picker: any readable form (spec 1.3), else empty. */
export function storedBirth(raw: unknown): DateParts {
  const parts = parseBirthDate(raw);
  return (parts && partsFromDisplay(roDate(parts))) || EMPTY_DATE;
}

export function initialDraft(row: InscriereRow, fields: readonly EditField[]): EditDraft {
  const draft: EditDraft = { text: {}, bools: {}, birth: storedBirth(row.childBirthDate), birthTouched: false };
  for (const f of fields) {
    if (f.kind === 'bool') draft.bools[f.key] = row[f.key] === true;
    else if (f.kind !== 'birthDate') draft.text[f.key] = cellText(row[f.key]);
  }
  return draft;
}

/** Untouched: no change, even for an unreadable stored date. Touched: a full date or the picker's error. */
function birthChange(row: InscriereRow, draft: EditDraft): EditPatch {
  if (!draft.birthTouched) return { patch: {}, error: null };
  const shown = partsToDisplay(draft.birth);
  if (!shown) return { patch: {}, error: BIRTH_DATE_ERROR };
  return { patch: shown === cellText(row.childBirthDate) ? {} : { childBirthDate: shown }, error: null };
}

function valueChange(row: InscriereRow, f: EditField, draft: EditDraft): Record<string, unknown> {
  if (f.kind === 'bool') {
    const next = draft.bools[f.key] === true;
    return next === (row[f.key] === true) ? {} : { [f.key]: next };
  }
  const next = (draft.text[f.key] ?? '').trim();
  return next === cellText(row[f.key]) ? {} : { [f.key]: next };
}

/** The PUT body: only the answers that changed. */
export function editPatch(row: InscriereRow, fields: readonly EditField[], draft: EditDraft): EditPatch {
  const birth = birthChange(row, draft);
  if (birth.error) return birth;
  const patch: Record<string, unknown> = { ...birth.patch };
  for (const f of visibleFields(fields, draft)) {
    if (f.kind !== 'birthDate') Object.assign(patch, valueChange(row, f, draft));
  }
  return { patch, error: null };
}

/** The toast after "Salvează", from the PUT answer `{ data, rebuild, changed }` (plan 3-2 Task 14). */
export function editToast(body: unknown): ToastSpec {
  const b = (body && typeof body === 'object' ? body : {}) as { changed?: unknown; rebuild?: { ok?: unknown } | null };
  if (Array.isArray(b.changed) && b.changed.length === 0) return { tone: 'info', text: EDIT_TOASTS.unchanged };
  if (b.rebuild?.ok === false) return { tone: 'warning', text: EDIT_TOASTS.rebuildFailed };
  return { tone: 'success', text: b.rebuild?.ok === true ? EDIT_TOASTS.rebuilt : EDIT_TOASTS.saved };
}
