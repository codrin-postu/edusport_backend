import { createHash } from 'node:crypto';
import { addDays } from '../../groups/dates';
import type { CalendarItem } from '../sportiv/api-types';
import { NOTICE_COPY } from './copy';
import type { NoticeRow } from './store';

/** Cancelled or moved sessions inside this many days from today go into the automatic message. */
export const NOTICE_WINDOW_DAYS = 14;

const timeOf = (t: string | null): string => (t ? `${t} ` : '');

/**
 * The rows of one account's automatic message: cancelled items dated today..today+14 and moved items whose planned or new date is in that window.
 * A moved row carries the planned date and time. Sorted by date, then by the text (which starts with the time). Pure.
 */
export function autoRows(items: { athleteFirstName: string; item: CalendarItem }[], manyAthletes: boolean, today: string): NoticeRow[] {
  const last = addDays(today, NOTICE_WINDOW_DAYS);
  const inWindow = (date: string): boolean => date >= today && date <= last;
  const rows: NoticeRow[] = [];
  for (const { athleteFirstName, item } of items) {
    const who = manyAthletes ? `, ${athleteFirstName}` : '';
    if (item.cancelled) {
      if (inWindow(item.date)) rows.push({ date: item.date, text: `${timeOf(item.startTime)}${item.title}${who}`, reason: item.reason });
    } else if (item.movedFrom && (inWindow(item.movedFrom.date) || inWindow(item.date))) {
      rows.push({
        date: item.movedFrom.date, text: `${timeOf(item.movedFrom.startTime)}${item.title}${who}`,
        reason: NOTICE_COPY.movedTo(item.date, item.startTime ?? ''),
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text, 'ro'));
}

export const autoTitle = (rows: NoticeRow[], anyMoved: boolean): string => (anyMoved ? NOTICE_COPY.titleMoved(rows.length) : NOTICE_COPY.title(rows.length));

/** The identity of a change set: the same rows give the same key. */
export const autoKey = (rows: NoticeRow[]): string => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
