/**
 * Children's birth dates (spec 1.3). The registration keeps free text; the athlete keeps a date.
 * Readable: ZZ.LL.AAAA, Z.L.AAAA, ZZ/LL/AAAA, ZZ-LL-AAAA, AAAA-LL-ZZ, "14 martie 2016". Anything else
 * is unreadable and blocks a confirmation (spec 4.7). Pure; the admin UI imports it too.
 */
export type DateParts = { year: number; month: number; day: number };

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

type Reader = (text: string) => DateParts | null;

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function numeric(pattern: RegExp, order: 'dmy' | 'ymd'): Reader {
  return (text) => {
    const m = pattern.exec(text);
    if (!m) return null;
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return order === 'dmy' ? { day: a, month: b, year: c } : { year: a, month: b, day: c };
  };
}

const longMonth: Reader = (text) => {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text);
  if (!m) return null;
  const month = RO_MONTHS.indexOf(deaccent(m[2].toLowerCase())) + 1;
  return month > 0 ? { day: Number(m[1]), month, year: Number(m[3]) } : null;
};

const READERS: Reader[] = [
  numeric(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, 'dmy'),
  numeric(/^(\d{2})\/(\d{2})\/(\d{4})$/, 'dmy'),
  numeric(/^(\d{2})-(\d{2})-(\d{4})$/, 'dmy'),
  numeric(/^(\d{4})-(\d{2})-(\d{2})$/, 'ymd'),
  longMonth,
];

export function isRealDate(p: DateParts): boolean {
  if (p.year < 1900 || p.month < 1 || p.month > 12 || p.day < 1) return false;
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return date.getUTCMonth() === p.month - 1 && date.getUTCDate() === p.day;
}

export function parseBirthDate(raw: unknown): DateParts | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  for (const read of READERS) {
    const parts = read(text);
    if (parts) return isRealDate(parts) ? parts : null;
  }
  return null;
}

/** What the zi / lună / an picker sends (admin edits): ZZ.LL.AAAA only. */
export function readPickedDate(raw: unknown): DateParts | null {
  const m = typeof raw === 'string' ? /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw.trim()) : null;
  if (!m) return null;
  const parts = { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
  return isRealDate(parts) ? parts : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (p: DateParts): string => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
export const roDate = (p: DateParts): string => `${pad(p.day)}.${pad(p.month)}.${p.year}`;

export function partsFromIso(iso: unknown): DateParts | null {
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isRealDate(parts) ? parts : null;
}

export function birthDateSortKey(raw: unknown): string | null {
  const parts = parseBirthDate(raw);
  return parts ? isoDate(parts) : null;
}

export function ageOn(birth: DateParts, today: DateParts): number {
  const before = today.month < birth.month || (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (before ? 1 : 0);
}

const ageOrNull = (birth: DateParts | null, today: DateParts): number | null => {
  const age = birth ? ageOn(birth, today) : -1;
  return age >= 0 ? age : null;
};

/** "Vârstă": blank (null) when the date is missing, unreadable or in the future. */
export const ageFromText = (raw: unknown, today: DateParts): number | null => ageOrNull(parseBirthDate(raw), today);
export const ageFromIso = (iso: unknown, today: DateParts): number | null => ageOrNull(partsFromIso(iso), today);

export function todayInBucharest(now: Date = new Date()): DateParts {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** The website's year range (spec 9): from 25 years ago to 2 years ago. */
export function birthYearRange(today: DateParts): { min: number; max: number } {
  return { min: today.year - 25, max: today.year - 2 };
}

/** Ascending; a stored year outside the range stays selectable (P14). */
export function birthYearOptions(today: DateParts, stored: number | null): number[] {
  const { min, max } = birthYearRange(today);
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const extra = stored !== null && (stored < min || stored > max) ? [stored] : [];
  return [...extra, ...years].sort((a, b) => a - b);
}
