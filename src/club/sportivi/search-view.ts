import type { AthleteCard } from '../athletes/api-types';

/** The search of "Caută alt sportiv" (spec 4.1), reused by "Adaugă sportiv" (6.7) and the merge (6.6). Pure. */

export const SEARCH_COPY = { placeholder: 'Nume, data nașterii, părinte sau telefon', newAthlete: 'Sportiv nou' } as const;

export const ADD_COPY = {
  title: 'Adaugă sportiv',
  name: 'Nume complet',
  birth: 'Data nașterii',
  contact: 'Persoana de contact',
  phone: 'Telefon',
  email: 'E-mail',
  optional: 'Opțional',
  submit: 'Adaugă sportiv',
  cancel: 'Anulează',
} as const;

export type SearchResult = { q: string; cards: AthleteCard[] };

export const searchUrl = (q: string): string => `/api/club/athletes/search?q=${encodeURIComponent(q.trim())}`;

/**
 * Second line of a result row: birth date, last group with its season, parent, separated by commas (gaps #1).
 * Same format as the confirm window's `cardDetailLine` (`src/club/inscrieri-panel.ts`, merged on `feat/athletes`
 * after this branch's base `fe6ab36`): "<name> <season>". Built directly here, not imported, since the base lacks that file.
 */
const groupLine = (g: AthleteCard['lastGroup']): string | null => (g ? `${g.name} ${g.season}` : null);

export const cardSubline = (c: AthleteCard): string => [c.birthDate, groupLine(c.lastGroup), c.contactName].filter(Boolean).join(', ');

export const withoutAthlete = (cards: AthleteCard[], id: string | undefined): AthleteCard[] => (id ? cards.filter((c) => c.documentId !== id) : cards);

/** "Sportiv nou" always under the results, so a close-name match can still be added (Needs decision 2, RESOLVED option B). */
export const showNewRow = (result: SearchResult | null): boolean => result !== null;

export const noResultsText = (result: SearchResult): string => `Niciun sportiv găsit pentru "${result.q}".`;
