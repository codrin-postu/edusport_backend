import type { Audience } from '../../price-item';
import { offeredItems, priceFor } from '../../price-item';
import { isCurrentMembership } from '../../group-membership';
import { MONTHS_SHORT } from '../../groups/dates';
import type { GroupRecord, SectionRecord } from '../../groups/types';
import type { MembershipRow } from '../../athletes/store';
import { subscriptionValidUntil } from '../../subscription';
import { longDate } from '../dates';
import { byUseOrder, slotCandidates, subscriptionState } from '../subscriptions';
import type { AttendanceRow, PriceListRecord, SubscriptionRow, SubscriptionWrite } from '../types';

export type OfferedItem = { itemKey: string; itemName: string; slots: number; price: number; priceListId: string; listName: string };
export type CoverRow = { attendanceId: string; date: string; groupId: string; groupName: string; priceListId: string | null };
export type AbonamentBar = { subscriptionId: string; itemName: string; slots: number; used: number; validUntil: string };

/** Price lists that belong to a school section. */
export function schoolListIds(lists: readonly PriceListRecord[], sections: readonly SectionRecord[]): Set<string> {
  const schools = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  return new Set(lists.filter((l) => l.sectionId !== null && schools.has(l.sectionId)).map((l) => l.id));
}

/** C22: the athlete's main school group's list on the date; with no school group, every school list. */
export function listsForAthlete(lists: PriceListRecord[], schoolIds: Set<string>, mainSchoolListId: string | null): PriceListRecord[] {
  const school = lists.filter((l) => schoolIds.has(l.id));
  return mainSchoolListId === null ? school : school.filter((l) => l.id === mainSchoolListId);
}

/** Subscription items with a session count, at the audience's price only. */
export function offeredSubscriptionItems(list: PriceListRecord, audience: Audience): OfferedItem[] {
  const items = list.items.filter((i) => i.kind === 'subscription' && i.sessions !== null && i.sessions > 0);
  return offeredItems(items, audience).map((i) => ({
    itemKey: i.name, itemName: i.name, slots: i.sessions as number, price: priceFor(i, audience) as number, priceListId: list.id, listName: list.name,
  }));
}

const byDate = (a: CoverRow, b: CoverRow): number => a.date.localeCompare(b.date) || a.attendanceId.localeCompare(b.attendanceId);

/** The athlete's own "Fără abonament" rows, oldest first (C23). */
export function coverCandidates(rows: readonly AttendanceRow[], groups: readonly GroupRecord[]): CoverRow[] {
  return rows
    .filter((r) => r.billing === 'fara_abonament')
    .map((r) => {
      const group = groups.find((g) => g.id === r.groupId);
      return { attendanceId: r.id, date: r.sessionDate, groupId: r.groupId, groupName: group?.name ?? '', priceListId: group?.priceListId ?? null };
    })
    .sort(byDate);
}

const ofList = (rows: readonly CoverRow[], priceListId: string): CoverRow[] => rows.filter((r) => r.priceListId === priceListId);

/** The oldest rows of the list, as many as the slots. */
export function defaultCover(rows: readonly CoverRow[], priceListId: string, slots: number): string[] {
  return ofList(rows, priceListId).slice(0, slots).map((r) => r.attendanceId);
}

export function checkCover(ids: readonly string[], rows: readonly CoverRow[], priceListId: string, slots: number): boolean {
  if (new Set(ids).size !== ids.length || ids.length > slots) return false;
  const allowed = new Set(ofList(rows, priceListId).map((r) => r.attendanceId));
  return ids.every((id) => allowed.has(id));
}

export function subscriptionWrite(i: {
  athleteId: string; seasonId: string; item: OfferedItem; audience: Audience; startsOn: string; actor: string; now: string;
}): SubscriptionWrite {
  return {
    athleteId: i.athleteId, seasonId: i.seasonId, priceListId: i.item.priceListId, validIn: [], itemName: i.item.itemName, price: i.item.price,
    audience: i.audience, slots: i.item.slots, startsOn: i.startsOn, validUntil: subscriptionValidUntil(i.startsOn, 0), extendedWeeks: 0,
    cancelled: false, cancelledAt: null, cancelledBy: null, purchasedAt: i.now, recordedBy: i.actor,
  };
}

/** Active today, bought on a school list (5.9, C77). */
export function extendableIds(subs: readonly SubscriptionRow[], used: Map<string, number>, schoolIds: Set<string>, today: string): string[] {
  return subs.filter((s) => schoolIds.has(s.priceListId) && subscriptionState(s, used.get(s.id) ?? 0, today) === 'activ').map((s) => s.id);
}

/** Changes whenever one of the rows is extended, cancelled or swapped; the same for any read order. */
export function extendKey(subs: readonly SubscriptionRow[]): string {
  return [...subs].sort((a, b) => a.id.localeCompare(b.id)).map((s) => `${s.id}:${s.extendedWeeks}:${s.validUntil}:${s.cancelled ? 1 : 0}`).join('|');
}

export function extendedValues(sub: SubscriptionRow, weeks: number): { extendedWeeks: number; validUntil: string } {
  const extendedWeeks = sub.extendedWeeks + weeks;
  return { extendedWeeks, validUntil: subscriptionValidUntil(sub.startsOn, extendedWeeks) };
}

export function barOf(sub: SubscriptionRow, used: Map<string, number>): AbonamentBar {
  return { subscriptionId: sub.id, itemName: sub.itemName, slots: sub.slots, used: used.get(sub.id) ?? 0, validUntil: sub.validUntil };
}

/** The abonament a Școala attendance today would use, on the given lists (every list the abonamente are valid on when none given). */
export function currentSubscription(subs: SubscriptionRow[], used: Map<string, number>, listIds: readonly string[], today: string): SubscriptionRow | null {
  const lists = listIds.length > 0 ? [...listIds] : [...new Set(subs.flatMap((s) => [s.priceListId, ...s.validIn]))];
  const found = new Map<string, SubscriptionRow>();
  for (const listId of lists) {
    for (const s of slotCandidates(subs, used, listId, today)) found.set(s.id, s);
  }
  return [...found.values()].sort(byUseOrder)[0] ?? null;
}

/** School price lists of the groups the athlete is in now, the main group's first. */
export function athleteListIdsToday(
  memberships: readonly MembershipRow[], groups: readonly GroupRecord[], schoolIds: Set<string>, seasonId: string | null, athleteId: string,
): string[] {
  if (seasonId === null) return [];
  const own = memberships.filter((m) => m.athleteId === athleteId && m.seasonId === seasonId && isCurrentMembership(m)).sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const ids = own.map((m) => groups.find((g) => g.id === m.groupId)?.priceListId ?? null).filter((id): id is string => id !== null && schoolIds.has(id));
  return [...new Set(ids)];
}

/** "27 oct" */
export function startText(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "5/8, 23 noi 2026" */
export const abonamentCellText = (bar: AbonamentBar): string => `${bar.used}/${bar.slots}, ${longDate(bar.validUntil)}`;
