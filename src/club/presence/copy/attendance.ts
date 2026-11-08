import { MONTHS_SHORT } from '../../groups/dates';
import { longDate } from '../dates';

const BUCHAREST = 'Europe/Bucharest';
const dayPart = new Intl.DateTimeFormat('en-CA', { timeZone: BUCHAREST, year: 'numeric', month: '2-digit', day: '2-digit' });
const timePart = new Intl.DateTimeFormat('ro-RO', { timeZone: BUCHAREST, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "27 oct" */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "Salvată de Ana Admin, 27 oct 2026 17:52", the time in Bucharest. */
export function savedLine(savedBy: string, savedAt: string): string {
  const at = new Date(savedAt);
  return `Salvată de ${savedBy}, ${longDate(dayPart.format(at))} ${timePart.format(at)}`;
}

export const ATTENDANCE_ERRORS = { noCoach: 'Alege antrenorul.', inactive: 'Sportiv inactiv' };

export const sessionSavedToast = (groupName: string, date: string): string => `Prezență salvată: ${groupName}, ${shortDay(date)}.`;

export const EXISTING_SESSION = {
  title: 'Există deja o ședință salvată',
  open: 'Deschide prezența salvată',
  addAnother: 'Adaugă încă o ședință în ziua asta',
  savedBy: (name: string) => `Salvată de ${name}`,
};

export const REACTIVATE_DIALOG = {
  title: 'Sportiv inactiv',
  text: (name: string) => `${name} are statusul Inactiv. Reactivezi sportivul?`,
  keep: 'Salvează fără',
  reactivate: 'Reactivează și salvează',
};

export const LESSON_COPY = {
  saved: 'Salvat.',
  unchanged: 'Nicio modificare.',
  deleted: 'Lecție ștearsă.',
  deleteLink: 'Șterge lecția',
  deleteConfirm: (date: string) => `Ștergi lecția din ${shortDay(date)}?`,
};

export const CSV_HEADER = ['Antrenor', 'Ședințe grup', 'Lecții individuale', 'Ore'] as const;

export const COACH_CSV_HEADER = ['Data', 'Tip', 'Grupă sau sportiv', 'Ora', 'Durată', 'Ore'] as const;
