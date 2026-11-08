import { ADMIN_ERRORS } from '../../athletes/errors';
import { refuse, type AdminResult } from '../../admin-result';
import { isCurrentMembership } from '../../group-membership';
import { currentSeason } from '../../groups/season-pick';
import { groupNameMap } from '../due/reads';
import type { AthleteSubscriptionCards, SubscriptionCard, SubscriptionUse } from '../money-api';
import type { PresenceStore } from '../store';
import { byUseOrder, subscriptionState, usedSlots } from '../subscriptions';
import type { AttendanceRow, SessionRow, SubscriptionRow } from '../types';

export const cmp = (x: string, y: string): number => (x === y ? 0 : x < y ? -1 : 1);

/** The used units of one abonament, numbered 1..n in use order: session date, start time, attendance id (4.3a). */
export function usesOf(
  sub: SubscriptionRow, atts: readonly AttendanceRow[], sessions: ReadonlyMap<string, SessionRow>, groupNames: ReadonlyMap<string, string>,
): SubscriptionUse[] {
  return atts
    .filter((a) => a.subscriptionId === sub.id && sessions.has(a.sessionId))
    .map((a) => ({ a, s: sessions.get(a.sessionId) as SessionRow }))
    .sort((x, y) => cmp(x.s.date, y.s.date) || cmp(x.s.startTime, y.s.startTime) || cmp(x.a.id, y.a.id))
    .map(({ a, s }, i) => ({ unit: i + 1, sessionId: a.sessionId, date: s.date, startTime: s.startTime, groupName: groupNames.get(s.groupId) ?? '' }));
}

/** Groups of the season: current memberships, the main one first. */
async function groupRows(store: PresenceStore, athleteId: string, seasonId: string | null): Promise<{ name: string; main: boolean }[]> {
  const seasonOf = seasonId ?? currentSeason(await store.seasons())?.id ?? null;
  if (seasonOf === null) return [];
  const names = groupNameMap(await store.groups());
  const memberships = await store.memberships({ athleteId, seasonId: seasonOf });
  return memberships
    .filter(isCurrentMembership)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain))
    .flatMap((m) => {
      const name = names.get(m.groupId);
      return name === undefined ? [] : [{ name, main: m.isMain }];
    });
}

/** The one current abonament (the one P5 4.10 would use today: started, active, in use order) and every other card (newest start first), each with its dated units (4.4). */
export async function readAthleteSubscriptionCards(
  store: PresenceStore, athleteId: string, seasonId: string | null, today: string,
): Promise<AdminResult<AthleteSubscriptionCards>> {
  if (!(await store.athlete(athleteId))) return refuse(404, ADMIN_ERRORS.notFound);
  const subs = await store.subscriptions({ athleteId });
  const atts = subs.length > 0 ? await store.attendances({ subscriptionIds: subs.map((s) => s.id) }) : [];
  const sessionIds = [...new Set(atts.map((a) => a.sessionId))];
  const sessions = new Map((sessionIds.length > 0 ? await store.sessions({ ids: sessionIds }) : []).map((s) => [s.id, s] as const));
  const names = groupNameMap(await store.groups());
  const used = usedSlots(atts);
  const cards = subs.map((s): SubscriptionCard => {
    const count = used.get(s.id) ?? 0;
    return {
      id: s.id, code: s.code, label: s.itemName, startsOn: s.startsOn, validUntil: s.validUntil, state: subscriptionState(s, count, today),
      used: count, slots: s.slots, uses: usesOf(s, atts, sessions, names),
    };
  });
  const pick = subs.filter((s) => s.startsOn <= today && cards.find((c) => c.id === s.id)?.state === 'activ').sort(byUseOrder)[0];
  const current = cards.find((c) => c.id === pick?.id) ?? null;
  const others = cards.filter((c) => c !== current).sort((a, b) => cmp(b.startsOn, a.startsOn) || cmp(a.id, b.id));
  return { ok: true, data: { groups: await groupRows(store, athleteId, seasonId), current, others } };
}
