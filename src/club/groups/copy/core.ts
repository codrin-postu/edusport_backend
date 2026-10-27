import { ADMIN_ERRORS } from '../../athletes/errors';
import { ARROW } from '../../history-text';
import { countWords } from '../../ro-count';

/** The arrow the spec writes as "->": the one of the phase 3 history lines. */
export { ARROW };

export const athletesText = (n: number): string => countWords(n, 'sportiv', 'sportivi');
export const groupsText = (n: number): string => countWords(n, 'grupă', 'grupe');
export const seriesCountText = (n: number): string => countWords(n, 'program', 'programe');
const ageText = (age: number | null): string | null => (age === null ? null : countWords(age, 'an', 'ani'));

export const GROUP_ERRORS = {
  ...ADMIN_ERRORS,
  nameTaken: 'Există deja o grupă cu acest nume.',
  pickGroup: 'Alege grupa.',
  undoGroup: 'Nu se mai poate anula. Grupa s-a schimbat între timp.',
  undoSeason: 'Nu se mai poate anula. Sezonul s-a schimbat între timp.',
  loadFailed: 'Nu am putut încărca datele.',
} as const;

export const GROUP_TOASTS = {
  undo: 'Anulează',
  undone: 'Anulat.',
  created: (name: string) => `Grupă creată: ${name}.`,
  saved: 'Salvat.',
  unchanged: 'Nicio modificare.',
  deleted: (name: string) => `Grupă ștearsă: ${name}.`,
  allocated: (group: string, name: string) => `Sportiv alocat în ${group}: ${name}.`,
  allocatedAll: (n: number) => (n === 1 ? '1 sportiv alocat în grupa propusă.' : `${athletesText(n)} alocați în grupele propuse.`),
  moved: (group: string, name: string) => `Sportiv mutat în ${group}: ${name}.`,
  addedAlso: (group: string, name: string) => `Sportiv adăugat și în ${group}: ${name}.`,
  removed: (group: string, name: string) => `Sportiv scos din ${group}: ${name}.`,
  added: (n: number) => (n === 1 ? '1 sportiv adăugat în grupă.' : `${athletesText(n)} adăugați în grupă.`),
} as const;

/** Istoric lines of the group roster and the athlete (spec 3.7). Program, break and season lines: `history-lines.ts`. */
export const GROUP_LINES = {
  created: 'Grupă creată.',
  deleted: (name: string) => `Grupă ștearsă: ${name}.`,
  memberAdded: (name: string) => `Sportiv adăugat: ${name}.`,
  memberAllocated: (name: string) => `Sportiv alocat: ${name}.`,
  movedTo: (group: string, name: string) => `Mutat în ${group}: ${name}.`,
  movedFrom: (group: string, name: string) => `Mutat din ${group}: ${name}.`,
  mainChanged: (from: string, to: string) => `Grupa principală schimbată: ${from} ${ARROW} ${to}`,
  memberRemoved: (name: string) => `Sportiv scos: ${name}.`,
  athleteMoved: (from: string, to: string) => `Mutat din ${from} în ${to}`,
  athleteRemoved: (group: string) => `Scos din grupa ${group}`,
  undone: (line: string) => `Anulat: ${line}`,
  yes: 'Da',
  no: 'Nu',
} as const;

/** Field labels of "Editează grupa" and "Editează pauza" lines (`<Câmp>: "<vechi>" -> "<nou>"`). */
export const FIELD_LABELS = {
  name: 'Nume',
  priceList: 'Listă de prețuri',
  coaches: 'Antrenori',
  programPublic: 'Program public',
  label: 'Nume',
  startDate: 'De la',
  endDate: 'Până la',
  isCurrent: 'Curent',
} as const;

export type SourceKind = 'registration' | 'previous' | 'added';

/** "Fără grupă" second line (5.3, W30): "Înscriere Școală, 12 ani", "Din 2026-2027, 12 ani", "Adăugat în Sportivi, 13 ani". */
export function sourceLine(kind: SourceKind, previousSeason: string | null, age: number | null): string {
  const lead = kind === 'registration' ? 'Înscriere Școală' : kind === 'previous' ? `Din ${previousSeason ?? ''}` : 'Adăugat în Sportivi';
  return [lead, ageText(age)].filter(Boolean).join(', ');
}
