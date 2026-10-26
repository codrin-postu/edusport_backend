import { ATHLETE_FIELDS, athleteValueText, type AthleteField, type AthleteValues } from '../athlete-data';
import { isoDate, parseBirthDate } from '../birth-date';
import { collapseSpaces, normalizeEmail, normalizePhone } from '../person-match';

/** "Compară" (panel) and "Compară și actualizează" (window), spec 3.3 and 4.2. */
export type RegistrationPerson = { childName: string; childBirthDate: string; parentName: string; phone: string; email: string };
export type ComparisonRow = { field: AthleteField; label: string; athlete: string; registration: string; differs: boolean; defaultUpdate: boolean };

export const COMPARE_LABELS: Record<AthleteField, string> = { name: 'Nume', birthDate: 'Data nașterii', contactName: 'Părinte', phone: 'Telefon', email: 'E-mail' };
const NEVER_BY_DEFAULT: readonly AthleteField[] = ['name', 'birthDate'];

export function registrationValues(r: RegistrationPerson): AthleteValues {
  const birth = parseBirthDate(r.childBirthDate);
  return {
    name: collapseSpaces(r.childName) || null,
    birthDate: birth ? isoDate(birth) : null,
    contactName: collapseSpaces(r.parentName) || null,
    phone: collapseSpaces(r.phone) || null,
    email: collapseSpaces(r.email) || null,
  };
}

function differs(field: AthleteField, a: string | null, b: string | null): boolean {
  if (field === 'phone') return normalizePhone(a) !== normalizePhone(b);
  if (field === 'email') return normalizeEmail(a) !== normalizeEmail(b);
  return (a ?? '') !== (b ?? '');
}

function registrationText(field: AthleteField, r: RegistrationPerson, values: AthleteValues): string {
  if (field === 'birthDate' && !values.birthDate) return collapseSpaces(r.childBirthDate);
  return athleteValueText(field, values[field]);
}

/** Ticked by default: every differing field except name and birth date, and never an empty registration value (N3). */
export function comparisonRows(athlete: AthleteValues, r: RegistrationPerson): ComparisonRow[] {
  const values = registrationValues(r);
  return ATHLETE_FIELDS.map((field) => {
    const differ = differs(field, athlete[field], values[field]);
    return {
      field,
      label: COMPARE_LABELS[field],
      athlete: athleteValueText(field, athlete[field]),
      registration: registrationText(field, r, values),
      differs: differ,
      defaultUpdate: differ && !NEVER_BY_DEFAULT.includes(field) && values[field] !== null,
    };
  });
}

export const defaultUpdateFields = (rows: ComparisonRow[]): AthleteField[] => rows.filter((r) => r.defaultUpdate).map((r) => r.field);
