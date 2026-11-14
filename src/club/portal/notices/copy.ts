import { countWords } from '../../ro-count';

const WEEKDAYS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'] as const;
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;

/** "Vin 20 noi": the three-letter words of the portal date blocks. */
export function shortDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

const MOVED_PREFIX = 'Mutată: ';

/** A row written by `movedTo`. */
export const isMovedReason = (reason: string | null): boolean => reason !== null && reason.startsWith(MOVED_PREFIX);

/** Texts of the automatic messages (spec 3). */
export const NOTICE_COPY = {
  title: (n: number): string => countWords(n, 'ședință anulată', 'ședințe anulate'),
  titleMoved: (n: number): string => countWords(n, 'ședință anulată sau mutată', 'ședințe anulate sau mutate'),
  movedTo: (date: string, time: string): string => `${MOVED_PREFIX}${shortDay(date)}, ${time}`,
} as const;
