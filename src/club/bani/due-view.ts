import { PAYMENT_COPY } from '../presence/copy/payments';
import type { ClubDueRow, SchoolDueRow } from '../presence/money-api';
import { ron } from '../presence/money';
import { leftCells } from './format';
import type { PaymentFor } from '../presence/payments/rules';
import { startText } from '../presence/subscriptions/rules';

export type SchoolCells = { athlete: string; group: string; item: string; from: string; price: string; paid: string; left: string; advance: string | null };
export type ClubCells = { athlete: string; group: string; sessions: string; due: string; paid: string; left: string; advance: string | null };

export const schoolCells = (r: SchoolDueRow): SchoolCells => ({
  athlete: r.athleteName, group: r.groupName ?? '', item: r.itemName, from: PAYMENT_COPY.fromDate(startText(r.startsOn)),
  price: ron(r.price), paid: ron(r.paid), ...leftCells(r.left),
});

/** The abonament code shown before the item name (null when it has none). */
export const schoolCode = (r: SchoolDueRow): string | null => r.code ?? null;

export const clubCells = (r: ClubDueRow): ClubCells => ({
  athlete: r.athleteName, group: r.groupNames, sessions: PAYMENT_COPY.sessionsText(r.grup, r.uscat, r.lessons),
  due: ron(r.due), paid: ron(r.paid), ...leftCells(r.left),
});

/** The abonament of a Școala row, else the month's Club. */
export const payFor = (row: SchoolDueRow | ClubDueRow, month: string): PaymentFor =>
  'subscriptionId' in row ? { kind: 'abonament', subscriptionId: row.subscriptionId } : { kind: 'club_luna', month };
