import type { FilterChoice } from '../ui-filters';
import { METHOD_WORDS, PURPOSE_WORDS } from '../presence/copy/core';
import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import { addMonths, listDate, monthOf, monthTitle } from '../presence/dates';
import type { PaymentList, PaymentRowView } from '../presence/money-api';
import { ron } from '../presence/money';

/** Same shape as the admin `FilterSection`. */
export type FilterSection = { key: string; label: string; options: FilterChoice[]; selected: string[]; single?: boolean; allLabel?: string | null };

const MONTHS_LISTED = 24;
const CANCELLED_MARK = 'anulată';

export type PlatiQuery = { month: string; method: string | null; purpose: string | null };
export type PlatiCells = {
  date: string; receipt: string; athlete: string; purpose: string; method: string; amount: string; recordedBy: string; struck: boolean; mark: string | null;
};

const choices = (words: Record<string, string>): { value: string; label: string }[] => Object.entries(words).map(([value, label]) => ({ value, label }));

/** "Perioadă": the last 24 months, newest first, always one chosen. "Metodă" and "Tip" start with the panel's own "Toate" row, which clears (C60), so they count in the Filtre badge. */
export function platiSections(q: PlatiQuery, today: string): FilterSection[] {
  const current = monthOf(today);
  const months = Array.from({ length: MONTHS_LISTED }, (_, i) => addMonths(current, -i)).map((value) => ({ value, label: monthTitle(value) }));
  const one = (key: string, label: string, options: FilterSection['options'], value: string | null, allLabel?: null): FilterSection => ({
    key, label, options, single: true, ...(allLabel === null ? { allLabel } : {}), selected: value !== null && options.some((o) => o.value === value) ? [value] : [],
  });
  return [
    one('month', MONEY_UI_COPY.plati.period, months, q.month, null),
    one('method', MONEY_UI_COPY.plati.method, choices(METHOD_WORDS), q.method),
    one('purpose', MONEY_UI_COPY.plati.type, choices(PURPOSE_WORDS), q.purpose),
  ];
}

/** Column headers of the Plăți list; the athlete's own table leaves out "Sportiv". */
export const platiColumns = (): string[] => [...MONEY_UI_COPY.plati.columns];

export function platiCells(r: PaymentRowView): PlatiCells {
  return {
    date: listDate(r.paidOn), receipt: r.receiptNo ?? '', athlete: r.athleteName, purpose: r.purposeText,
    method: `${METHOD_WORDS[r.method]}${r.collectedAtRink ? PAYMENT_COPY.rink : ''}`,
    amount: ron(r.amount), recordedBy: r.recordedBy, struck: r.cancelled, mark: r.cancelled ? CANCELLED_MARK : null,
  };
}

/** A cancelled row has no menu (4.17). */
export const rowMenu = (r: PaymentRowView): ('edit' | 'cancel')[] => (r.cancelled ? [] : ['edit', 'cancel']);

export const totalLine = (list: PaymentList): string => MONEY_UI_COPY.plati.total(ron(list.total));
