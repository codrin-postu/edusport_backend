import type { MembershipRow } from '../athletes/store';
import { byGroupOrder, orderedSections, sectionLabel } from '../groups/sections';
import { METHOD_WORDS, PURPOSE_WORDS } from '../presence/copy/core';
import { addMonths, monthOf, monthRange } from '../presence/dates';
import { clubMonths, isClubAttendance, schoolDue, type ClubMonth } from '../presence/due/settlement';
import { sumMoney } from '../presence/money';
import { subscriptionState, usedSlots } from '../presence/subscriptions';
import type { AttendanceRow, LessonRow, PaymentMethod, PaymentPurpose, PaymentRow, SubscriptionRow } from '../presence/types';
import type { MoneySources } from './sources';
import type { Money4, MoneyCards, MoneyOverview, SectionBlock, TallyRow } from './types';

const EXPIRING_DAYS = 13;
const live = (payments: readonly PaymentRow[]): PaymentRow[] => payments.filter((p) => !p.cancelled);
const inMonth = (date: string, month: string): boolean => monthOf(date) === month;

/** Today for the current month, the month's last day for any other (S26). */
export const referenceDay = (month: string, today: string): string => (month === monthOf(today) ? today : monthRange(month).to);

function plusDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function groupedBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

const collectedIn = (payments: readonly PaymentRow[], month: string): number => sumMoney(live(payments).filter((p) => inMonth(p.paidOn, month)).map((p) => p.amount));

/** The state of an abonament on a day: only its attendances up to that day count, and a cancellation counts from its date. */
function activeOn(src: MoneySources, day: string): SubscriptionRow[] {
  const used = usedSlots(src.attendances.filter((a) => a.sessionDate <= day));
  return src.subscriptions.filter((s) => {
    const cancelled = s.cancelled && (s.cancelledAt === null || s.cancelledAt.slice(0, 10) <= day);
    return s.startsOn <= day && subscriptionState({ ...s, cancelled }, used.get(s.id) ?? 0, day) === 'activ';
  });
}

const isCurrentOn = (m: MembershipRow, day: string): boolean => (m.from === null || m.from <= day) && (!m.to || m.to >= day);

function schoolAthletesOn(src: MoneySources, day: string): number {
  const schools = new Set(src.sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const schoolGroups = new Set(src.groups.filter((g) => g.sectionId !== null && schools.has(g.sectionId)).map((g) => g.id));
  return new Set(src.memberships.filter((m) => schoolGroups.has(m.groupId) && isCurrentOn(m, day)).map((m) => m.athleteId)).size;
}

/** The month block of each athlete who owes or paid that month, as De încasat (Club part) builds it (5.11). */
function clubBlocks(src: MoneySources, month: string): Map<string, ClubMonth> {
  const attendances = groupedBy(src.attendances, (a) => a.athleteId);
  const lessons = groupedBy(src.lessons, (l) => l.athleteId);
  const payments = groupedBy(src.payments, (p) => p.athleteId);
  const groupNames = new Map(src.groups.map((g) => [g.id, g.name] as const));
  const blocks = new Map<string, ClubMonth>();
  for (const a of src.athletes) {
    const block = clubMonths({
      attendances: attendances.get(a.id) ?? [], lessons: lessons.get(a.id) ?? [], payments: payments.get(a.id) ?? [], groupNames, startDate: src.startDate,
    }).find((m) => m.month === month);
    if (block && (block.due > 0 || block.paid > 0)) blocks.set(a.id, block);
  }
  return blocks;
}

type DueFigures = Pick<MoneyCards, 'left' | 'due' | 'unpaidAthletes'>;

/** De încasat for the month: Rămas of both parts, De plătit plus Preț of both parts, athletes with Rămas above 0 (S25). */
function dueFigures(src: MoneySources, blocks: Map<string, ClubMonth>): DueFigures {
  const school = schoolDue(src.subscriptions, src.payments);
  const club = [...blocks.entries()];
  const owing = new Set([...school.filter((r) => r.left > 0).map((r) => r.athleteId), ...club.filter(([, b]) => b.left > 0).map(([id]) => id)]);
  return {
    left: sumMoney([...school.map((r) => r.left), ...club.map(([, b]) => b.left)]),
    due: sumMoney([...school.map((r) => r.price), ...club.map(([, b]) => b.due)]),
    unpaidAthletes: owing.size,
  };
}

type Line = { date: string; groupId: string | null; amount: number };
type Totals = Map<string, { due: number; paid: number }>;

function add(totals: Totals, groupId: string | null, due: number, paid: number): void {
  if (groupId === null) return;
  const cur = totals.get(groupId) ?? { due: 0, paid: 0 };
  totals.set(groupId, { due: sumMoney([cur.due, due]), paid: sumMoney([cur.paid, paid]) });
}

/** The athlete's main group on a date (a main membership current on it). */
function mainGroupOn(memberships: readonly MembershipRow[], athleteId: string, date: string): string | null {
  return memberships.find((m) => m.athleteId === athleteId && m.isMain && isCurrentOn(m, date))?.groupId ?? null;
}

/** The month's lines of one athlete in the order of the De încasat detail: attendances by date then id, then lessons, stable by date. */
function monthLines(atts: readonly AttendanceRow[], lessons: readonly LessonRow[], month: string, mainOn: (date: string) => string | null): Line[] {
  const rows = atts.filter((a) => isClubAttendance(a) && inMonth(a.sessionDate, month)).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.id.localeCompare(b.id));
  const held = lessons.filter((l) => l.state === 'saved' && l.present === true && inMonth(l.date, month));
  return [
    ...rows.map((a) => ({ date: a.sessionDate, groupId: a.groupId, amount: a.amount })),
    ...held.map((l) => ({ date: l.date, groupId: mainOn(l.date), amount: l.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Club part: the month's payments (whenever made) pay its lines oldest first (S27). */
function addClubMonth(totals: Totals, lines: readonly Line[], paid: number): void {
  let rest = paid;
  for (const line of lines) {
    const part = Math.min(line.amount, Math.max(rest, 0));
    rest = sumMoney([rest, -part]);
    add(totals, line.groupId, line.amount, part);
  }
}

function addClubParts(totals: Totals, src: MoneySources, month: string, blocks: Map<string, ClubMonth>): void {
  const attendances = groupedBy(src.attendances, (a) => a.athleteId);
  const lessons = groupedBy(src.lessons, (l) => l.athleteId);
  for (const [athleteId, block] of blocks) {
    const lines = monthLines(attendances.get(athleteId) ?? [], lessons.get(athleteId) ?? [], month, (d) => mainGroupOn(src.memberships, athleteId, d));
    addClubMonth(totals, lines, block.paid);
  }
}

/** Școala part: abonamente starting in the month (cancelled ones out), on the main group at the start date, with what was paid for them (S27). */
function addSchoolParts(totals: Totals, src: MoneySources, month: string): void {
  const paidFor = groupedBy(live(src.payments).filter((p) => p.purpose === 'abonament' && p.subscriptionId !== null), (p) => p.subscriptionId ?? '');
  for (const s of src.subscriptions) {
    if (s.cancelled || s.price === null || !inMonth(s.startsOn, month)) continue;
    add(totals, mainGroupOn(src.memberships, s.athleteId, s.startsOn), s.price, sumMoney((paidFor.get(s.id) ?? []).map((p) => p.amount)));
  }
}

const money4 = (due: number, paid: number): Money4 => ({ due, paid, left: sumMoney([due, -paid]), percent: due === 0 ? null : Math.round((paid / due) * 100) });

function sectionBlocks(src: MoneySources, totals: Totals): SectionBlock[] {
  return orderedSections(src.sections).map((section) => {
    const groups = src.groups.filter((g) => g.sectionId === section.id && (g.active || totals.has(g.id))).sort(byGroupOrder)
      .map((g) => ({ groupId: g.id, groupName: g.name, totals: money4(totals.get(g.id)?.due ?? 0, totals.get(g.id)?.paid ?? 0) }));
    const due = sumMoney(groups.map((g) => g.totals.due));
    return { sectionId: section.id, sectionName: sectionLabel(section, src.sections), totals: money4(due, sumMoney(groups.map((g) => g.totals.paid))), groups };
  }).filter((b) => b.groups.length > 0);
}

function tally<K extends string>(payments: readonly PaymentRow[], keys: Record<K, string>, of: (p: PaymentRow) => K): TallyRow[] {
  return (Object.keys(keys) as K[]).map((key) => {
    const rows = payments.filter((p) => of(p) === key);
    return { key, label: keys[key], paid: sumMoney(rows.map((p) => p.amount)), count: rows.length };
  });
}

/** The month overview: pure over the sources, nothing stored (S24). */
export function moneyOverview(src: MoneySources, month: string, today: string): MoneyOverview {
  const day = referenceDay(month, today);
  const blocks = clubBlocks(src, month);
  const active = activeOn(src, day);
  const totals: Totals = new Map();
  addClubParts(totals, src, month, blocks);
  addSchoolParts(totals, src, month);
  const paid = live(src.payments).filter((p) => inMonth(p.paidOn, month));
  return {
    month,
    cards: {
      collected: collectedIn(src.payments, month), collectedPrev: collectedIn(src.payments, addMonths(month, -1)), ...dueFigures(src, blocks),
      activeSubscriptions: active.length, schoolAthletes: schoolAthletesOn(src, day),
      expiring: active.filter((s) => s.validUntil >= day && s.validUntil <= plusDays(day, EXPIRING_DAYS)).length,
    },
    bySection: sectionBlocks(src, totals),
    byMethod: tally<PaymentMethod>(paid, METHOD_WORDS, (p) => p.method),
    byPurpose: tally<PaymentPurpose>(paid, PURPOSE_WORDS, (p) => p.purpose),
  };
}
