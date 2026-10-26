import { asText } from '../narrow';
import { MEMBERSHIP_YES } from '../registration-form-options';
import { formatBirthDate, formatDay, formatFee, monthYear, relationshipLabel } from './format';
import type { DocumentKind, DocumentSeason, DocumentValues } from './types';

/** The registration fields the documents print, as read from the database (anything may be missing on old rows). */
export type RegistrationRow = {
  documentId: string;
  registrationNumber?: unknown;
  parentName?: unknown;
  phone?: unknown;
  email?: unknown;
  relationship?: unknown;
  relationshipOther?: unknown;
  childName?: unknown;
  childBirthDate?: unknown;
  membershipAnswer?: unknown;
  submittedAt?: unknown;
  season?: unknown;
};

const orNull = (v: unknown) => asText(v) || null;

/** Season, period and fee: the only values a blank form prints. */
export function seasonValues(season: DocumentSeason | null): Pick<DocumentValues, 'season' | 'periodStart' | 'periodEnd' | 'fee'> {
  return {
    season: season?.label ?? null,
    periodStart: monthYear(season?.startMonth),
    periodEnd: monthYear(season?.endMonth),
    fee: formatFee(season?.membershipFee),
  };
}

/** A blank form: season, period and fee printed, everything else a line for paper (DECISIONS 2026-10-05). */
export function blankValues(season: DocumentSeason | null): DocumentValues {
  const none = { registrationNumber: null, parentName: null, phone: null, email: null, relationship: null };
  return { ...none, childName: null, birthDate: null, date: null, ...seasonValues(season) };
}

/** What a registration's documents print. Only form answers are used; address and CNP are never stored. */
export function registrationValues(row: RegistrationRow, season: DocumentSeason | null): DocumentValues {
  const values = {
    ...seasonValues(season),
    registrationNumber: orNull(row.registrationNumber),
    parentName: orNull(row.parentName),
    phone: orNull(row.phone),
    email: orNull(row.email),
    relationship: relationshipLabel(asText(row.relationship), asText(row.relationshipOther)),
    childName: orNull(row.childName),
    birthDate: formatBirthDate(asText(row.childBirthDate)),
    date: formatDay(asText(row.submittedAt)),
  };
  return { ...values, season: values.season ?? orNull(row.season) };
}

/** The Acord for every registration; the Cerere de adeziune only when the membership answer is Da. */
export function documentKindsFor(row: RegistrationRow): DocumentKind[] {
  return row.membershipAnswer === MEMBERSHIP_YES ? ['acord', 'adeziune'] : ['acord'];
}
