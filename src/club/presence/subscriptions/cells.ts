import { seasonOfDate } from '../dates';
import type { PresenceStore } from '../store';
import type { SubscriptionRow } from '../types';
import { athleteListIdsToday, barOf, currentSubscription, schoolListIds, type AbonamentBar } from './rules';
import { usedOf } from './used';

function byAthlete(subs: readonly SubscriptionRow[]): Map<string, SubscriptionRow[]> {
  const out = new Map<string, SubscriptionRow[]>();
  for (const s of subs) out.set(s.athleteId, [...(out.get(s.athleteId) ?? []), s]);
  return out;
}

/** Sportivi "Abonament" (5.13, C65): the abonament 4.10 would use today, for each athlete who has one. */
export async function abonamentCells(store: PresenceStore, today: string): Promise<Map<string, AbonamentBar>> {
  const [subs, memberships, groups, lists, sections, seasons] = await Promise.all([
    store.subscriptions(), store.memberships(), store.groups(), store.priceListRecords(), store.sections(), store.seasons(),
  ]);
  const used = await usedOf(store, subs);
  const school = schoolListIds(lists, sections);
  const seasonId = seasonOfDate(seasons, today)?.id ?? null;
  const cells = new Map<string, AbonamentBar>();
  for (const [athleteId, own] of byAthlete(subs)) {
    const current = currentSubscription(own, used, athleteListIdsToday(memberships, groups, school, seasonId, athleteId), today);
    if (current) cells.set(athleteId, barOf(current, used));
  }
  return cells;
}
