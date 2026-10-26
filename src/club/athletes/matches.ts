import { birthDateSortKey } from '../birth-date';
import { bestMatch, registrationFacts, type AthleteFacts } from '../matching';
import type { AthleteRow, ClubStore, RegistrationPatch, RegistrationRow } from './store';

/** The saved match of every registration (spec 2.2): at submit, on edit, after any athlete change, at deploy. */
export type MatchUpdate = { registrationId: string; patch: RegistrationPatch };

export const athleteFacts = (a: AthleteRow): AthleteFacts => ({ id: a.id, name: a.name ?? '', birthDate: a.birthDate, phone: a.phone, email: a.email, updatedAt: a.updatedAt });

/** A linked registration keeps no match: the "Sportiv existent" line is only for unconfirmed ones (gaps #16, P6). */
function matchPatch(r: RegistrationRow, facts: AthleteFacts[]): RegistrationPatch | null {
  const best = r.athleteId ? null : bestMatch(registrationFacts(r), facts);
  const next = { matchAthleteId: best?.athleteId ?? null, matchLevel: best?.level ?? null, childBirthDateParsed: birthDateSortKey(r.childBirthDate) };
  const same = next.matchAthleteId === r.matchAthleteId && next.matchLevel === r.matchLevel && next.childBirthDateParsed === r.childBirthDateParsed;
  return same ? null : next;
}

export function planMatchUpdates(registrations: RegistrationRow[], athletes: AthleteRow[]): MatchUpdate[] {
  const facts = athletes.map(athleteFacts);
  return registrations.flatMap((r) => {
    const patch = matchPatch(r, facts);
    return patch ? [{ registrationId: r.id, patch }] : [];
  });
}

export async function refreshAllMatches(store: ClubStore): Promise<number> {
  const [registrations, athletes] = await Promise.all([store.registrations(), store.athletes()]);
  const updates = planMatchUpdates(registrations, athletes);
  for (const u of updates) await store.updateRegistration(u.registrationId, u.patch);
  return updates.length;
}

export async function refreshRegistrationMatch(store: ClubStore, id: string): Promise<void> {
  const [registration, athletes] = await Promise.all([store.registration(id), store.athletes()]);
  const [update] = registration ? planMatchUpdates([registration], athletes) : [];
  if (update) await store.updateRegistration(id, update.patch);
}

/** Matching and its history are a convenience after the real write: a failure is logged, never thrown. */
export async function safely(work: () => Promise<unknown>, log: (message: string) => void, what: string): Promise<void> {
  try {
    await work();
  } catch (err) {
    log(`[athletes] ${what} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
