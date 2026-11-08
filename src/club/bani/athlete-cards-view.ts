import { monthName, monthOf } from '../presence/dates';
import type { SubscriptionUse } from '../presence/money-api';
import { CARD_COPY } from '../presence/copy/prezenta-ui';
import { dayMonthText, weekdayDateText } from './date-text';

/** "Școala noiembrie": the month of the start date (S47). */
export const cardName = (startsOn: string): string => `Școala ${monthName(monthOf(startsOn))}`;

/** "1 noi - 30 noi"; a date outside the current year carries its year. */
export const cardPeriod = (startsOn: string, validUntil: string, today: string): string =>
  `${dayMonthText(startsOn, today)} - ${dayMonthText(validUntil, today)}`;

export const cardCount = (used: number, slots: number): string => `${used}/${slots}`;

/** One flag per slot, true for a used one. */
export const segments = (used: number, slots: number): boolean[] => Array.from({ length: slots }, (_, i) => i < used);

/** A row of the dated list: "Ședința 1" | "Lun 2 noi, 17:00" | group. */
export const useRow = (u: SubscriptionUse, today: string): { title: string; when: string; group: string } => ({
  title: CARD_COPY.unit(u.unit), when: `${weekdayDateText(u.date, today)}, ${u.startTime}`, group: u.groupName,
});
