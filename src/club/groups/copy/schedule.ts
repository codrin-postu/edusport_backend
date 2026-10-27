import { dayMonth } from '../dates';

/** Group program copy (spec 6.3, 7.1, 7.2, 11). */
export const SCHEDULE_ERRORS = {
  noDays: 'Alege cel puțin o zi.',
  endBeforeStart: 'Data de sfârșit trebuie să fie după data de început.',
  groupEvent: (group: string) => `Evenimentul aparține grupei ${group}. Se schimbă din pagina grupei.`,
} as const;

export const SCHEDULE_TOASTS = {
  programAdded: 'Program adăugat.',
  classAdded: (date: string) => `Ședință adăugată: ${dayMonth(date)}.`,
  programChanged: 'Program schimbat.',
  programEnded: 'Program șters.',
  classDeleted: 'Ședință ștearsă.',
  dateCancelled: (date: string) => `Ședința din ${dayMonth(date)} a fost anulată.`,
  dateMoved: (date: string) => `Ședința din ${dayMonth(date)} a fost mutată.`,
  dateKept: (date: string) => `Ședința din ${dayMonth(date)} se ține.`,
  breakSaved: 'Pauză salvată.',
  breakDeleted: 'Pauză ștearsă.',
} as const;

/** "Durată": 15 to 240 minutes in steps of 5, 50 by default (W10). */
export const DURATION = { min: 15, max: 240, step: 5, initial: 50 } as const;
export const durationLabel = (minutes: number): string => `${minutes} min`;
