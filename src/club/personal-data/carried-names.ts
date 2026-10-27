import type { AthleteRow, ClubStore, HistoryRow, RegistrationRow } from '../athletes/store';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { isRecord } from '../narrow';
import { nameWords } from '../person-match';

const sides = (v: unknown): unknown[] => (isRecord(v) && 'from' in v ? [v.from, v.to] : [v]);

/** A name as matching compares it: case, diacritics and word order ignored; '' when there is none. */
export const nameKey = (raw: unknown): string => [...nameWords(raw)].sort().join(' ');

/** Every value stored under `key` at any depth, both sides of an old/new pair. */
export function valuesUnder(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value.flatMap((v) => valuesUnder(v, key));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => (k === key ? sides(v) : valuesUnder(v, key)));
}

/** Registrations named by the child's "created-from-registrations" lines that are no longer linked to it. */
async function createdFromRegistrations(store: ClubStore, own: HistoryRow[], linked: RegistrationRow[]): Promise<RegistrationRow[]> {
  const known = new Set(linked.map((r) => r.id));
  const ids = own
    .filter((h) => h.action === HISTORY_ACTIONS.createdFromRegistrations)
    .flatMap((h) => valuesUnder(h.changes, 'documentId'))
    .filter((id): id is string => typeof id === 'string' && !known.has(id));
  const rows = await Promise.all([...new Set(ids)].map((id) => store.registration(id)));
  return rows.filter((r): r is RegistrationRow => r !== null);
}

/**
 * Every name the child has carried, normalized: the current one, the `name` values in its own Istoric (not the
 * "Nu e același copil" lines, which name the other child), its registrations' child name and confirmation records,
 * and the child-name edits in their Istoric.
 */
export async function carriedNames(store: ClubStore, athlete: AthleteRow, registrations: RegistrationRow[]): Promise<Set<string>> {
  const own = await store.history(SUBJECT.athlete, athlete.id);
  const registrationHistory = (await Promise.all(registrations.map((r) => store.history(SUBJECT.registration, r.id)))).flat();
  const all = [...registrations, ...(await createdFromRegistrations(store, own, registrations))];
  const raw = [
    athlete.name,
    ...own.filter((h) => h.action !== HISTORY_ACTIONS.duplicateDismissed).flatMap((h) => valuesUnder(h.changes, 'name')),
    ...all.flatMap((r) => [r.childName, ...valuesUnder(r.confirmation, 'name')]),
    ...registrationHistory.flatMap((h) => valuesUnder(h.changes, 'childName')),
  ];
  return new Set(raw.map(nameKey).filter(Boolean));
}
