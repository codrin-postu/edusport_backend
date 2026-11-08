import { MONTHS_SHORT } from '../groups/dates';
import { listDate } from '../presence/dates';

const yearOf = (date: string): string => date.slice(0, 4);

/** "2 noi", with the year ("2 noi 2025") when it is not the current one. */
export function dayMonthText(date: string, today: string): string {
  const base = `${Number(date.slice(8, 10))} ${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}`;
  return yearOf(date) === yearOf(today) ? base : `${base} ${yearOf(date)}`;
}

/** "Lun 2 noi", with the year when it is not the current one. */
export function weekdayDateText(date: string, today: string): string {
  return yearOf(date) === yearOf(today) ? listDate(date) : `${listDate(date)} ${yearOf(date)}`;
}
