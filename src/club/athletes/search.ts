import { isoDate, parseBirthDate } from '../birth-date';
import { nameWords, normalizePhone, withinOneEdit } from '../person-match';
import type { AthleteRow, RegistrationRow } from './store';

/**
 * Athlete search (spec 5 and 4.1): name and parent words in any order, without diacritics, a word may be typed
 * partly or with one wrong letter; phone digits; e-mail and registration number as text; a readable birth date.
 */
export type SearchSubject = { names: (string | null)[]; phone: string | null; texts: (string | null)[]; birthDate: string | null };

type WordTest = (q: string, word: string) => boolean;

const wholeWord: WordTest = (q, word) => word === q;
const wordStart: WordTest = (q, word) => word.startsWith(q);
const wordHit: WordTest = (q, word) => wordStart(q, word) || (q.length >= 4 && withinOneEdit(q, word));

/** Every typed word passes `test` against some word of one same name. */
function everyWord(words: string[], names: (string | null)[], test: WordTest): boolean {
  if (words.length === 0) return false;
  return names.some((name) => {
    const own = nameWords(name);
    return words.every((q) => own.some((w) => test(q, w)));
  });
}

const namesHit = (query: string, names: (string | null)[]): boolean => everyWord(nameWords(query), names, wordHit);

function phoneHit(query: string, phone: string | null): boolean {
  if (!/^[\d\s+().-]+$/.test(query)) return false;
  const digits = normalizePhone(query);
  return digits.length >= 3 && normalizePhone(phone).includes(digits);
}

function textHit(query: string, texts: (string | null)[]): boolean {
  const q = query.toLowerCase();
  return q.length >= 3 && texts.some((t) => (t ?? '').toLowerCase().includes(q));
}

function dateHit(query: string, birthDate: string | null): boolean {
  const parts = parseBirthDate(query);
  return parts !== null && isoDate(parts) === birthDate;
}

export function matchesQuery(subject: SearchSubject, raw: string): boolean {
  const query = raw.trim();
  if (!query) return true;
  return namesHit(query, subject.names) || phoneHit(query, subject.phone) || textHit(query, subject.texts) || dateHit(query, subject.birthDate);
}

/** Per athlete: its name and contact, plus the parents and numbers of its linked registrations. */
export function searchSubjects(athletes: AthleteRow[], registrations: RegistrationRow[]): Map<string, SearchSubject> {
  const linked = new Map<string, RegistrationRow[]>();
  for (const r of registrations) if (r.athleteId) linked.set(r.athleteId, [...(linked.get(r.athleteId) ?? []), r]);
  return new Map(athletes.map((a) => {
    const regs = linked.get(a.id) ?? [];
    return [a.id, { names: [a.name, a.contactName, ...regs.map((r) => r.parentName)], phone: a.phone, texts: [a.email, ...regs.map((r) => r.number)], birthDate: a.birthDate }];
  }));
}

/**
 * Order of the search rows: 0 every typed word is a whole name word, 1 every typed word begins a name word,
 * 2 anything else (one wrong letter, phone, e-mail, number, birth date). Exact and prefix names come before typos.
 */
export function queryRank(subject: SearchSubject, raw: string): number {
  const words = nameWords(raw);
  if (everyWord(words, subject.names, wholeWord)) return 0;
  return everyWord(words, subject.names, wordStart) ? 1 : 2;
}
