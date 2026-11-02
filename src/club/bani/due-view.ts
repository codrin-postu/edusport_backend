import { MONEY_UI_COPY } from '../presence/copy/money-ui';
import { PAYMENT_COPY } from '../presence/copy/payments';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../presence/money-api';
import { ron } from '../presence/money';
import type { PaymentFor } from '../presence/payments/rules';
import { startText } from '../presence/subscriptions/rules';
import { platiSections, type FilterSection } from './plati-view';

export type SchoolCells = { athlete: string; group: string; item: string; from: string; price: string; paid: string; left: string };
export type ClubCells = { athlete: string; group: string; sessions: string; due: string; paid: string; left: string };

export const schoolCells = (r: SchoolDueRow): SchoolCells => ({
  athlete: r.athleteName, group: r.groupName ?? '', item: r.itemName, from: PAYMENT_COPY.fromDate(startText(r.startsOn)),
  price: ron(r.price), paid: ron(r.paid), left: ron(r.left),
});

export const clubCells = (r: ClubDueRow): ClubCells => ({
  athlete: r.athleteName, group: r.groupNames, sessions: PAYMENT_COPY.sessionsText(r.grup, r.uscat, r.lessons),
  due: ron(r.due), paid: ron(r.paid), left: ron(r.left),
});

/** A part with no rows is hidden; both empty shows the empty text (C76). */
export function dueParts(p: DuePage): { school: boolean; club: boolean; empty: boolean } {
  const school = p.school.length > 0;
  const club = p.club.length > 0;
  return { school, club, empty: !school && !club };
}

/** The abonament of a Școala row, else the month's Club. */
export const payFor = (row: SchoolDueRow | ClubDueRow, month: string): PaymentFor =>
  'subscriptionId' in row ? { kind: 'abonament', subscriptionId: row.subscriptionId } : { kind: 'club_luna', month };

/** "Luna": the Plăți month options, the current month first (C76). */
export function dueSections(month: string, today: string): FilterSection[] {
  const [months] = platiSections({ month, method: null, purpose: null }, today);
  return [{ ...months, label: MONEY_UI_COPY.due.month }];
}
