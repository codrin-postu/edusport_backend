import type { GroupRecord, SeasonRecord } from '../groups/types';
import { seasonBounds } from '../groups/series';
import { kindOf } from '../presence/attendance/panel';
import { byUseOrder, isValidForList, pickSubscription, usedSlots } from '../presence/subscriptions';
import type { PresenceStore } from '../presence/store';
import type { AbonamentShort } from './sportiv/api-types';

/** Dates of the athlete's presences in a season: a group or dry-land mark (uscat counts as grup) and a present lesson, as the coach card counts `presence.season`. */
export async function seasonPresenceDates(store: PresenceStore, athleteId: string, season: SeasonRecord): Promise<{ group: string[]; groupSessionIds: string[]; lessons: string[] }> {
  const { start, end } = seasonBounds(season);
  const [attendances, lessons] = await Promise.all([store.attendances({ athleteId, from: start, to: end }), store.lessons({ athleteId, from: start, to: end })]);
  const ticked = attendances.filter((r) => r.grup || r.uscat);
  return {
    group: ticked.map((r) => r.sessionDate), groupSessionIds: ticked.map((r) => r.sessionId),
    lessons: lessons.filter((l) => l.state === 'saved' && l.present === true).map((l) => l.date),
  };
}

/**
 * The abonament the athlete would use today in the first Școala group of `groups` (priced), as the next class number and the slots; null without one.
 * `keepFull`: an abonament valid today with every slot used is shown as the last class (8 of 8) instead of nothing.
 */
export async function abonamentShort(
  store: PresenceStore, athleteId: string, groups: GroupRecord[], today: string, keepFull = false,
): Promise<{ abonament: AbonamentShort; group: GroupRecord } | null> {
  const school = (await Promise.all(groups.map(async (g) => ((await kindOf(store, g.sectionId)) === 'school' && g.priceListId ? g : null)))).find((g) => g !== null);
  if (!school || !school.priceListId) return null;
  const subs = await store.subscriptions({ athleteId });
  const used = usedSlots(subs.length > 0 ? await store.attendances({ subscriptionIds: subs.map((s) => s.id) }) : []);
  const list = school.priceListId;
  let sub = pickSubscription(subs, used, list, today);
  if (!sub && keepFull) {
    sub = subs.filter((s) => !s.cancelled && isValidForList(s, list) && s.startsOn <= today && today <= s.validUntil).sort(byUseOrder).at(-1) ?? null;
  }
  if (!sub) return null;
  const next = Math.min((used.get(sub.id) ?? 0) + 1, sub.slots);
  return { abonament: { code: sub.code, next, slots: sub.slots, validUntil: sub.validUntil }, group: school };
}
