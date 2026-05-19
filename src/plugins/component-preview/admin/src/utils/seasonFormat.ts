export const MONTH_LABELS = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

const MONTH_LABELS_LOWER = MONTH_LABELS.map((m) => m.toLowerCase());

export function formatRomanianDate(iso: string | undefined | null): string {
  if (!iso || typeof iso !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  const [, y, m, d] = match;
  const monthIdx = Number(m) - 1;
  if (monthIdx < 0 || monthIdx > 11) return '';
  return `${Number(d)} ${MONTH_LABELS_LOWER[monthIdx]} ${y}`;
}

export function formatYearMonth(iso: string | undefined | null): string {
  if (!iso || typeof iso !== 'string') return '';
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  return match ? `${match[1]}-${match[2]}` : '';
}

export function parseYearMonth(value: unknown): { year: number; month: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}/.test(value)) return null;
  const [y, m] = value.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function parseISODate(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}
