import { createHash } from 'node:crypto';
import { addDays } from '../../groups/dates';
import type { CalendarItem } from '../sportiv/api-types';
import { NOTICE_COPY } from './copy';
import type { NoticeRow } from './store';

/** Cancelled or moved sessions inside this many days from today go into the automatic message. */
export const NOTICE_WINDOW_DAYS = 14;

const timeOf = (t: string | null): string => (t ? `${t} ` : '');

/** A break as the calendar names it: its sessions are cancelled with the label as the reason. */
export type BreakSpan = { label: string; startDate: string; endDate: string };
export type AutoSource = { athleteFirstName: string; item: CalendarItem };
type Entry = { row: NoticeRow; until: string };

const breakOf = (item: CalendarItem, breaks: BreakSpan[]): BreakSpan | undefined =>
  item.cancelled ? breaks.find((b) => b.label === item.reason && b.startDate <= item.date && item.date <= b.endDate) : undefined;

/** Per break: the first date it cancels for the account; a break enters the window by that date and then brings all its sessions. */
function firstDates(items: AutoSource[], breaks: BreakSpan[]): Map<BreakSpan, string> {
  const first = new Map<BreakSpan, string>();
  for (const { item } of items) {
    const b = breakOf(item, breaks);
    const known = b ? first.get(b) : undefined;
    if (b && (known === undefined || item.date < known)) first.set(b, item.date);
  }
  return first;
}

function entryOf({ athleteFirstName, item }: AutoSource, many: boolean): Entry {
  const who = many ? `, ${athleteFirstName}` : '';
  if (item.cancelled) return { row: { date: item.date, text: `${timeOf(item.startTime)}${item.title}${who}`, reason: item.reason }, until: item.date };
  const from = item.movedFrom as NonNullable<CalendarItem['movedFrom']>;
  return {
    row: { date: from.date, text: `${timeOf(from.startTime)}${item.title}${who}`, reason: NOTICE_COPY.movedTo(item.date, item.startTime ?? '') },
    until: item.date > from.date ? item.date : from.date,
  };
}

/**
 * The account's automatic message: cancelled items and moved items (by planned or new date) in today..today+14, and every session of a break
 * whose first affected date is in that window, however far it runs (so the message does not change as later dates come into the window).
 * A moved row carries the planned date and time; `lastDate` is the latest planned or new date. Sorted by date, then text. Pure.
 */
export function autoPlan(items: AutoSource[], manyAthletes: boolean, today: string, breaks: BreakSpan[] = []): { rows: NoticeRow[]; lastDate: string | null } {
  const last = addDays(today, NOTICE_WINDOW_DAYS);
  const inWindow = (date: string): boolean => date >= today && date <= last;
  const first = firstDates(items, breaks);
  const entered = ({ item }: AutoSource): boolean => {
    const b = breakOf(item, breaks);
    if (b) return (first.get(b) ?? last) <= last;
    return item.cancelled ? inWindow(item.date) : !!item.movedFrom && (inWindow(item.movedFrom.date) || inWindow(item.date));
  };
  const entries = items.filter(entered).map((s) => entryOf(s, manyAthletes));
  entries.sort((a, b) => a.row.date.localeCompare(b.row.date) || a.row.text.localeCompare(b.row.text, 'ro'));
  const lastDate = entries.reduce<string | null>((m, e) => (m === null || e.until > m ? e.until : m), null);
  return { rows: entries.map((e) => e.row), lastDate };
}

export const autoTitle = (rows: NoticeRow[], anyMoved: boolean): string => (anyMoved ? NOTICE_COPY.titleMoved(rows.length) : NOTICE_COPY.title(rows.length));

/** The identity of a change set: the same rows give the same key. */
export const autoKey = (rows: NoticeRow[]): string => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
