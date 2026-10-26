import { isoDate, parseBirthDate } from './birth-date';
import { nameWords, normalizeEmail, normalizePhone, sameName, shareNameWord } from './person-match';

/**
 * Is this child already in the club (spec 2.1)? Levels are never shown as words; Sigur and Probabil show
 * "Sportiv existent", Alt copil shows nothing. Inactive athletes are compared too. Never auto-merges.
 */
export type MatchLevel = 'sigur' | 'probabil' | 'alt-copil';
export type StoredMatchLevel = 'sigur' | 'probabil';
/** Name as written, birth date as ISO (null when missing or unreadable), contact as typed. */
export type PersonFacts = { name: string; birthDate: string | null; phone: string | null; email: string | null };
export type AthleteFacts = PersonFacts & { id: string; updatedAt: string };
export type Candidate = { athleteId: string; level: StoredMatchLevel };

const textOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

export function registrationFacts(r: { childName?: unknown; childBirthDate?: unknown; phone?: unknown; email?: unknown }): PersonFacts {
  const birth = parseBirthDate(r.childBirthDate);
  return { name: textOrNull(r.childName) ?? '', birthDate: birth ? isoDate(birth) : null, phone: textOrNull(r.phone), email: textOrNull(r.email) };
}

function sharesContact(a: PersonFacts, b: PersonFacts): boolean {
  const phone = normalizePhone(a.phone);
  const email = normalizeEmail(a.email);
  return (phone !== '' && phone === normalizePhone(b.phone)) || (email !== '' && email === normalizeEmail(b.email));
}

/**
 * Same normalized name: diacritics, case and word order ignored, no typo allowed. The only rule Sigur
 * and the deploy grouping (plan Task 10) may use for "same child"; a typo match is at most Probabil.
 */
export function sameNameExact(a: unknown, b: unknown): boolean {
  const left = [...nameWords(a)].sort();
  const right = [...nameWords(b)].sort();
  return left.length > 0 && left.length === right.length && left.every((word, i) => word === right[i]);
}

/** Same birth date: Sigur needs the exact name; a typo match, or a shared contact and a common name
 * word, is Probabil. */
function sameDateLevel(child: PersonFacts, athlete: PersonFacts): MatchLevel | null {
  if (sameNameExact(child.name, athlete.name)) return 'sigur';
  if (sameName(child.name, athlete.name)) return 'probabil';
  return sharesContact(child, athlete) && shareNameWord(child.name, athlete.name) ? 'probabil' : null;
}

export function matchLevel(child: PersonFacts, athlete: PersonFacts): MatchLevel | null {
  if (child.birthDate !== null && child.birthDate === athlete.birthDate) return sameDateLevel(child, athlete);
  if (athlete.birthDate === null && sameName(child.name, athlete.name)) return 'probabil';
  return sharesContact(child, athlete) ? 'alt-copil' : null;
}

const RANK: Record<StoredMatchLevel, number> = { sigur: 2, probabil: 1 };
const isStored = (level: MatchLevel | null): level is StoredMatchLevel => level === 'sigur' || level === 'probabil';

/** Sigur and Probabil only: highest level first, then the most recently updated athlete. */
export function rankCandidates(child: PersonFacts, athletes: AthleteFacts[]): Candidate[] {
  const found: (Candidate & { updatedAt: string })[] = [];
  for (const a of athletes) {
    const level = matchLevel(child, a);
    if (isStored(level)) found.push({ athleteId: a.id, level, updatedAt: a.updatedAt });
  }
  found.sort((x, y) => RANK[y.level] - RANK[x.level] || y.updatedAt.localeCompare(x.updatedAt));
  return found.map(({ athleteId, level }) => ({ athleteId, level }));
}

export function bestMatch(child: PersonFacts, athletes: AthleteFacts[]): Candidate | null {
  return rankCandidates(child, athletes)[0] ?? null;
}

/** Possible duplicates at deploy (spec 2.3, P8): Sigur or Probabil, or one side without a birth date and the names agree. */
export function duplicateLevel(a: PersonFacts, b: PersonFacts): StoredMatchLevel | null {
  const level = matchLevel(a, b);
  if (isStored(level)) return level;
  return a.birthDate === null && sameName(a.name, b.name) ? 'probabil' : null;
}
