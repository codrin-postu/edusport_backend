/** Dates and times as phase 4 shows them (spec 3.7, 6.3, 6.5). Pure: ISO 'YYYY-MM-DD' and 'HH:mm' in, Romanian text out. */
export const MONTHS_LONG = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'] as const;
export const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;
/** Indexed like `getUTCDay()`: 0 is Sunday. */
export const WEEKDAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');
const utc = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toIso = (dt: Date): string => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toIso(utc(v)) === v;
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function addDays(iso: string, n: number): string {
  const dt = utc(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toIso(dt);
}

export const weekdayIndex = (iso: string): number => utc(iso).getUTCDay();
export const weekdayName = (iso: string): string => WEEKDAYS[weekdayIndex(iso)];
export const capitalized = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** "14 noiembrie" */
export const dayMonth = (iso: string): string => `${utc(iso).getUTCDate()} ${MONTHS_LONG[utc(iso).getUTCMonth()]}`;
/** "4 oct 2026" */
export const shortDate = (iso: string): string => `${utc(iso).getUTCDate()} ${MONTHS_SHORT[utc(iso).getUTCMonth()]} ${utc(iso).getUTCFullYear()}`;
/** Strapi times arrive as "HH:mm:ss.SSS". */
export const hhmm = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) : null);
export const minutesOf = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const timeOf = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const addMinutes = (t: string, n: number): string => timeOf(minutesOf(t) + n);
export const minutesBetween = (start: string, end: string): number => minutesOf(end) - minutesOf(start);
export const clampDate = (iso: string, lo: string, hi: string): string => (iso < lo ? lo : iso > hi ? hi : iso);
