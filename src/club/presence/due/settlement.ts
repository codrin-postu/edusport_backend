import type { MembershipRow } from '../../athletes/store';
import { isCurrentMembership } from '../../group-membership';
import type { GroupRecord } from '../../groups/types';
import { monthOf } from '../dates';
import { sumMoney } from '../money';
import type { AttendanceRow, Charge, LessonRow, PaymentRow, SubscriptionRow } from '../types';

export type ClubLine = { date: string; groupName: string | null; charges: Charge[]; lesson: { price: number | null } | null };
export type ClubMonth = {
  month: string; grup: number; uscat: number; lessons: number; due: number; paid: number; left: number; groupIds: string[]; lines: ClubLine[];
};
export type SchoolDue = { subscriptionId: string; athleteId: string; itemName: string; startsOn: string; price: number; paid: number; left: number };

export const isClubAttendance = (a: Pick<AttendanceRow, 'billing'>): boolean => a.billing === 'club' || a.billing === 'inclus' || a.billing === 'fara_pret';

const live = (payments: readonly PaymentRow[]): PaymentRow[] => payments.filter((p) => !p.cancelled);
const byDate = (a: { date: string }, b: { date: string }): number => a.date.localeCompare(b.date);

/** Present, saved lessons only. */
const heldLessons = (lessons: readonly LessonRow[]): LessonRow[] => lessons.filter((l) => l.state === 'saved' && l.present === true);

function monthsWithActivity(club: readonly AttendanceRow[], held: readonly LessonRow[], paymentMonths: readonly string[]): string[] {
  return [...new Set([...club.map((a) => monthOf(a.sessionDate)), ...held.map((l) => monthOf(l.date)), ...paymentMonths])];
}

/** Months of the non-cancelled Club and lesson payments; a lesson payment counts in its lesson's month. */
function paymentMonths(payments: readonly PaymentRow[], lessons: readonly LessonRow[]): { club: Map<string, number[]>; lesson: Map<string, number[]> } {
  const club = new Map<string, number[]>();
  const lesson = new Map<string, number[]>();
  const add = (map: Map<string, number[]>, month: string, amount: number): void => void map.set(month, [...(map.get(month) ?? []), amount]);
  for (const p of live(payments)) {
    const lessonDate = lessons.find((l) => l.id === p.lessonId)?.date;
    if (p.purpose === 'club_luna' && p.clubMonth) add(club, p.clubMonth, p.amount);
    if (p.purpose === 'lectie' && lessonDate) add(lesson, monthOf(lessonDate), p.amount);
  }
  return { club, lesson };
}

type Paid = ReturnType<typeof paymentMonths>;

function monthBlock(month: string, club: readonly AttendanceRow[], held: readonly LessonRow[], paid: Paid, groupNames: ReadonlyMap<string, string>): ClubMonth {
  const rows = club.filter((a) => monthOf(a.sessionDate) === month).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.id.localeCompare(b.id));
  const lessons = held.filter((l) => monthOf(l.date) === month);
  const due = sumMoney([...rows.map((a) => a.amount), ...lessons.map((l) => l.amount)]);
  const settled = sumMoney([...(paid.club.get(month) ?? []), ...(paid.lesson.get(month) ?? [])]);
  const lines: ClubLine[] = [
    ...rows.map((a) => ({ date: a.sessionDate, groupName: groupNames.get(a.groupId) ?? null, charges: a.charges, lesson: null })),
    ...lessons.map((l) => ({ date: l.date, groupName: null, charges: [], lesson: { price: l.price } })),
  ].sort(byDate);
  return {
    month, grup: rows.filter((a) => a.grup).length, uscat: rows.filter((a) => a.uscat).length, lessons: lessons.length, due, paid: settled,
    left: sumMoney([due, -settled]), groupIds: [...new Set(rows.map((a) => a.groupId))], lines,
  };
}

export function clubMonths(i: {
  attendances: AttendanceRow[]; lessons: LessonRow[]; payments: PaymentRow[]; groupNames: ReadonlyMap<string, string>; startDate: string | null;
}): ClubMonth[] {
  const club = i.attendances.filter(isClubAttendance);
  const held = heldLessons(i.lessons);
  const paid = paymentMonths(i.payments, i.lessons);
  const earliest = i.startDate === null ? null : monthOf(i.startDate);
  const months = monthsWithActivity(club, held, [...paid.club.keys(), ...paid.lesson.keys()]).filter((m) => earliest === null || m >= earliest);
  return months.sort().reverse().map((month) => monthBlock(month, club, held, paid, i.groupNames));
}

/** Not cancelled, priced, price minus non-cancelled payments above 0; by start date (4.14). */
export function schoolDue(subs: readonly SubscriptionRow[], payments: readonly PaymentRow[]): SchoolDue[] {
  const rows: SchoolDue[] = [];
  for (const s of subs) {
    if (s.cancelled || s.price === null) continue;
    const paid = sumMoney(live(payments).filter((p) => p.purpose === 'abonament' && p.subscriptionId === s.id).map((p) => p.amount));
    const left = sumMoney([s.price, -paid]);
    if (left > 0) rows.push({ subscriptionId: s.id, athleteId: s.athleteId, itemName: s.itemName, startsOn: s.startsOn, price: s.price, paid, left });
  }
  return rows.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.subscriptionId.localeCompare(b.subscriptionId));
}

/** The main group of each athlete with a current membership in the season. */
export function mainGroupToday(memberships: readonly MembershipRow[], groups: readonly GroupRecord[], seasonId: string | null): Map<string, GroupRecord> {
  const map = new Map<string, GroupRecord>();
  if (seasonId === null) return map;
  for (const m of memberships) {
    const group = groups.find((g) => g.id === m.groupId);
    if (m.seasonId === seasonId && m.isMain && isCurrentMembership(m) && group) map.set(m.athleteId, group);
  }
  return map;
}
