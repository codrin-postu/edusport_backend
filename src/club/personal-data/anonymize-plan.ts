import type { ConfirmationRecord } from '../confirm/plan';
import { PERSONAL_DATA_COPY } from './copy';

/** What "Anonimizează" writes (spec 4). Pure: the services apply it inside one transaction per athlete. */
export const ATHLETE_PERSONAL_KEYS = ['name', 'firstName', 'lastName', 'birthDate', 'contactName', 'phone', 'email', 'notes'] as const;
export const REGISTRATION_NULLED_KEYS = [
  'parentName', 'email', 'phone', 'childBirthDate', 'childBirthDateParsed', 'childHeight', 'shirtSize', 'priorExperience', 'expectations',
  'relationshipOther', 'sourceOther', 'internalNote', 'lastSeason', 'extra', 'submissionKey', 'howHeard',
] as const;
export const REGISTRATION_KEPT_KEYS = [
  'registrationNumber', 'season', 'seasonRef', 'section', 'status', 'archived', 'submittedAt', 'level', 'relationship', 'source',
  'membershipAnswer', 'subscriptionChoice', 'gdprConsent', 'regulationsConsent', 'clubInterest', 'regulationsAgreement', 'privacyConsent', 'athlete',
] as const;

/** Keys whose values in Istoric and in a confirmation record are personal (spec 4, plus decided item 4). */
export const HISTORY_PERSONAL_KEYS: ReadonlySet<string> = new Set<string>([
  ...ATHLETE_PERSONAL_KEYS, ...REGISTRATION_NULLED_KEYS, 'childName', 'athleteName', 'recipient', 'documents',
]);

export const MAX_BULK = 200;
export type BulkAnonymizeResult = { anonymized: number; skipped: number; failed: number };

export type AthleteScrub = {
  name: string; firstName: null; lastName: null; birthDate: null; contactName: null; phone: null; email: null; notes: null;
  dataIncomplete: false; status: 'anonimizat'; anonymizedAt: string; profileId: null;
};

export const athleteScrub = (at: string): AthleteScrub => ({
  name: PERSONAL_DATA_COPY.anonymizedName, firstName: null, lastName: null, birthDate: null, contactName: null, phone: null, email: null, notes: null,
  dataIncomplete: false, status: 'anonimizat', anonymizedAt: at, profileId: null,
});

type Nulled = { [K in (typeof REGISTRATION_NULLED_KEYS)[number]]: null };
export type RegistrationScrub = Nulled & { childName: string; confirmation: ConfirmationRecord | null };

type Changes = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Changes => !!v && typeof v === 'object' && !Array.isArray(v);
const isPair = (v: unknown): v is Changes => isPlainObject(v) && 'from' in v && 'to' in v;
const scrubValue = (v: unknown): unknown => (isPair(v) ? { ...v, from: null, to: null } : null);
const walk = (v: unknown): unknown => (Array.isArray(v) ? v.map(walk) : isPlainObject(v) ? scrubChanges(v) : v);

/** Every value under a personal key becomes null (a pair keeps its shape); other keys kept; nested objects and arrays walked. */
export function scrubChanges(changes: Changes): Changes {
  return Object.fromEntries(Object.entries(changes).map(([key, v]) => [key, HISTORY_PERSONAL_KEYS.has(key) ? scrubValue(v) : walk(v)]));
}

export function registrationScrub(confirmation: ConfirmationRecord | null): RegistrationScrub {
  const nulled = Object.fromEntries(REGISTRATION_NULLED_KEYS.map((k) => [k, null])) as Nulled;
  const kept = confirmation ? (scrubChanges(confirmation) as ConfirmationRecord) : null;
  return { ...nulled, childName: PERSONAL_DATA_COPY.anonymizedChild, confirmation: kept };
}

/** Jobs not yet sent are cancelled; sent and failed keep their status (spec 4). */
export const scrubbedJobStatus = (status: string): string => (status === 'queued' ? 'cancelled' : status);

export const isAnonymized = (a: { status: string } | null | undefined): boolean => a?.status === 'anonimizat';

/** POST /api/club/athletes/anonymize body `{ documentIds }`: 1 to 200 non-empty ids, repeats dropped; anything else null (400). */
export function readAnonymizeIds(body: unknown): string[] | null {
  const raw = isPlainObject(body) ? body.documentIds : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BULK) return null;
  if (!raw.every((id) => typeof id === 'string' && id.trim() !== '')) return null;
  return [...new Set(raw as string[])];
}
