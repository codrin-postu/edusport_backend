import { changedFields, type FieldChange } from './admin-result';
import { ADMIN_ERRORS } from './athletes/errors';
import { isoDate, partsFromIso, readPickedDate, roDate } from './birth-date';
import { collapseSpaces } from './person-match';

/** The athlete's private data (spec 1.1, 6.2). One full name; birth date as ISO; empty = null. */
export type AthleteStatus = 'nou' | 'activ' | 'inactiv' | 'anonimizat';
export const ATHLETE_STATUSES: readonly AthleteStatus[] = ['nou', 'activ', 'inactiv', 'anonimizat'];
export const ATHLETE_FIELDS = ['name', 'birthDate', 'contactName', 'phone', 'email'] as const;
export type AthleteField = (typeof ATHLETE_FIELDS)[number];
export type AthleteValues = { [K in AthleteField]: string | null };

/** Date tab labels (spec 6.2). */
export const ATHLETE_FIELD_LABELS: Record<AthleteField, string> = {
  name: 'Nume și prenume',
  birthDate: 'Data nașterii',
  contactName: 'Persoana de contact',
  phone: 'Telefon',
  email: 'E-mail',
};

/** The words of the hint "Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail." */
export const MISSING_FIELD_WORDS: Record<AthleteField, string> = {
  name: 'nume',
  birthDate: 'data nașterii',
  contactName: 'persoana de contact',
  phone: 'telefon',
  email: 'e-mail',
};

export const isAthleteField = (v: unknown): v is AthleteField => (ATHLETE_FIELDS as readonly unknown[]).includes(v);

export function pickAthleteValues(source: AthleteValues): AthleteValues {
  return { name: source.name, birthDate: source.birthDate, contactName: source.contactName, phone: source.phone, email: source.email };
}

export const missingFields = (v: AthleteValues): AthleteField[] => ATHLETE_FIELDS.filter((f) => !v[f]);
export const isDataIncomplete = (v: AthleteValues): boolean => missingFields(v).length > 0;
export const missingText = (fields: readonly AthleteField[]): string => fields.map((f) => MISSING_FIELD_WORDS[f]).join(', ');

export function athleteChanges(before: AthleteValues, after: AthleteValues): Record<string, FieldChange> {
  return changedFields(ATHLETE_FIELDS, before, after);
}

export function birthDateForPicker(iso: string | null): string | null {
  const parts = partsFromIso(iso);
  return parts ? roDate(parts) : null;
}

/** Display text of a stored value: birth date as ZZ.LL.AAAA, empty as blank. */
export function athleteValueText(field: AthleteField, value: string | null): string {
  return field === 'birthDate' ? birthDateForPicker(value) ?? '' : value ?? '';
}

export type AthleteInput = { ok: true; values: AthleteValues } | { ok: false; error: string };
type BirthRead = { ok: true; value: string | null } | { ok: false };

function readBirthDate(raw: unknown, required: boolean): BirthRead {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return required ? { ok: false } : { ok: true, value: null };
  const parts = readPickedDate(text);
  return parts ? { ok: true, value: isoDate(parts) } : { ok: false };
}

const textOrNull = (v: unknown) => collapseSpaces(v) || null;

/** The Date tab's "Editează" or the "Adaugă sportiv" form: name always required, birth date required when adding (gaps #41). */
export function readAthleteInput(body: unknown, mode: 'edit' | 'add'): AthleteInput {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const name = collapseSpaces(b.name);
  if (!name) return { ok: false, error: ADMIN_ERRORS.nameRequired };
  const birth = readBirthDate(b.birthDate, mode === 'add');
  if (birth.ok === false) return { ok: false, error: ADMIN_ERRORS.birthDate };
  return { ok: true, values: { name, birthDate: birth.value, contactName: textOrNull(b.contactName), phone: textOrNull(b.phone), email: textOrNull(b.email) } };
}
