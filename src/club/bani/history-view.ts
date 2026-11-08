import { countWords } from '../ro-count';
import type { HistoryPay } from '../presence/attendance/api-types';
import { HISTORY_COPY, CARD_COPY } from '../presence/copy/prezenta-ui';
import { weekdayDateText } from './date-text';

/** "42 de prezențe în sezonul 2026-2027" (S48). */
export const historyCount = (total: number, seasonLabel: string): string => `${countWords(total, 'prezență', 'prezențe')} în sezonul ${seasonLabel}`;

/** "Vin 6 noi, 18:00"; the year is added outside the current one. */
export const historyDate = (date: string, time: string, today: string): string => `${weekdayDateText(date, today)}, ${time}`;

/** The label of a "Plată" cell, the code beside it and one tone for every unit row. */
export function payView(pay: HistoryPay): { label: string; code: string | null; tone: 'unit' | 'paid' | 'unpaid' } {
  if (pay.kind === 'unit') return { label: `${CARD_COPY.unit(pay.unit)}/${pay.slots}`, code: pay.code, tone: 'unit' };
  return pay.kind === 'paid' ? { label: HISTORY_COPY.paid, code: null, tone: 'paid' } : { label: HISTORY_COPY.unpaid, code: null, tone: 'unpaid' };
}
