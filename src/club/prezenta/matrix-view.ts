import type { MatrixCell, MatrixColumn, MatrixRow } from '../presence/attendance/api-types';

const WEEKDAYS = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'] as const;

/** "Lu 2", or "Lu 2, 18:00" when the group has two sessions on that day. */
export function columnHeader(c: MatrixColumn, sameDay: boolean): string {
  const [y, m, d] = c.date.split('-').map(Number);
  const head = `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
  return sameDay ? `${head}, ${c.startTime}` : head;
}

/** What a cell holds, for screen readers: "x" in the group, "U" dry-land. */
export function cellText(c: MatrixCell): '' | 'x' | 'x U' | 'U' {
  if (c.grup && c.uscat) return 'x U';
  if (c.grup) return 'x';
  return c.uscat ? 'U' : '';
}

/** "3/4" (present of listed sessions); a visitor has no list, only the count. */
export const totalText = (r: MatrixRow): string => (r.of === null ? String(r.present) : `${r.present}/${r.of}`);
