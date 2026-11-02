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
const ALL = MONEY_UI_COPY.plati.typeOptions[0];

export type PlatiQuery = { month: string; method: string | null; purpose: string | null };
export type PlatiCells = {
  date: string; athlete: string; purpose: string; method: string; amount: string; recordedBy: string; struck: boolean; mark: string | null;
};

const choices = (words: Record<string, string>): { value: string; label: string }[] => [
  { value: '', label: ALL }, ...Object.entries(words).map(([value, label]) => ({ value, label })),
];

/** "Perioadă": the last 24 months, newest first; "Metodă" and "Tip" start with "Toate" (C60). Single choice each; the "Toate" row clears. */
export function platiSections(q: PlatiQuery, today: string): FilterSection[] {
  const current = monthOf(today);
  const months = Array.from({ length: MONTHS_LISTED }, (_, i) => addMonths(current, -i)).map((value) => ({ value, label: monthTitle(value) }));
  const one = (key: string, label: string, options: FilterSection['options'], value: string | null): FilterSection => ({
    key, label, options, single: true, allLabel: null, selected: value !== null && options.some((o) => o.value === value) ? [value] : [],
  });
  return [
    one('month', MONEY_UI_COPY.plati.period, months, q.month),
    one('method', MONEY_UI_COPY.plati.method, choices(METHOD_WORDS), q.method),
    one('purpose', MONEY_UI_COPY.plati.type, choices(PURPOSE_WORDS), q.purpose),
  ];
}

export function platiCells(r: PaymentRowView): PlatiCells {
  return {
    date: listDate(r.paidOn), athlete: r.athleteName, purpose: r.purposeText,
    method: `${METHOD_WORDS[r.method]}${r.collectedAtRink ? PAYMENT_COPY.rink : ''}`,
    amount: ron(r.amount), recordedBy: r.recordedBy, struck: r.cancelled, mark: r.cancelled ? CANCELLED_MARK : null,
  };
}

/** A cancelled row has no menu (4.17). */
export const rowMenu = (r: PaymentRowView): ('edit' | 'cancel')[] => (r.cancelled ? [] : ['edit', 'cancel']);

export const totalLine = (list: PaymentList): string => MONEY_UI_COPY.plati.total(ron(list.total));
