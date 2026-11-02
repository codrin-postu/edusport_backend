import { isCurrentMembership } from '../../group-membership';
import { currentSeason } from '../../groups/season-pick';
import type { SubscriptionStateFilter, SubscriptionQuery, SubscriptionListPage, SubscriptionListRow, AthleteSubscriptions } from '../money-api';
import { byId, groupNameMap } from '../due/reads';
import { mainGroupToday } from '../due/settlement';
import type { PresenceStore } from '../store';
import { byUseOrder, subscriptionState, usedSlots } from '../subscriptions';
import type { SubscriptionRow, SubscriptionState } from '../types';
import { barOf } from './rules';

const FILTERS: readonly SubscriptionStateFilter[] = ['toate', 'active', 'epuizate', 'expirate', 'anulate'];
const STATE_OF: Record<Exclude<SubscriptionStateFilter, 'toate'>, SubscriptionState> = { active: 'activ', epuizate: 'epuizat', expirate: 'expirat', anulate: 'anulat' };

/** Abonamente list query: state defaults to Active, group is the main group today (5.9). */
export function readSubscriptionQuery(q: Record<string, unknown>): SubscriptionQuery {
  const state = FILTERS.find((f) => f === q.state) ?? 'active';
  const groupId = typeof q.groupId === 'string' && q.groupId !== '' ? q.groupId : null;
  return { state, groupId };
}

/** Slots used per abonament, from one attendance read (C7). */
async function usedFor(store: PresenceStore, subs: readonly SubscriptionRow[]): Promise<Map<string, number>> {
  if (subs.length === 0) return new Map();
  return usedSlots(await store.attendances({ subscriptionIds: subs.map((s) => s.id) }));
}

/** Abonamente of the current season, sorted by expiry (5.9). Cancel is hidden once a non-cancelled payment points to it (C58, C75). */
export async function listSubscriptions(store: PresenceStore, q: Record<string, unknown>, today: string): Promise<SubscriptionListPage> {
  const query = readSubscriptionQuery(q);
  const seasons = await store.seasons();
  const seasonId = currentSeason(seasons)?.id ?? null;
  const [subs, athletes, groups, sections, payments, memberships] = await Promise.all([
    store.subscriptions(), store.athletes(), store.groups(), store.sections(), store.payments(),
    seasonId === null ? Promise.resolve([]) : store.memberships({ seasonId }),
  ]);
  const current = subs.filter((s) => s.seasonId === seasonId);
  const used = await usedFor(store, current);
  const mains = mainGroupToday(memberships, groups, seasonId);
  const athleteOf = byId(athletes);
  const paidPoints = new Set(payments.filter((p) => !p.cancelled && p.subscriptionId !== null).map((p) => p.subscriptionId));
  const want = query.state === 'toate' ? null : STATE_OF[query.state];
  const rows: SubscriptionListRow[] = current
    .map((s) => {
      const count = used.get(s.id) ?? 0;
      return { s, count, state: subscriptionState(s, count, today), main: mains.get(s.athleteId) ?? null };
    })
    .filter((r) => (want === null || r.state === want) && (query.groupId === null || r.main?.id === query.groupId))
    .sort((a, b) => a.s.validUntil.localeCompare(b.s.validUntil) || a.s.id.localeCompare(b.s.id))
    .map((r) => ({
      subscriptionId: r.s.id, athleteId: r.s.athleteId, athleteName: athleteOf.get(r.s.athleteId)?.name ?? '', groupName: r.main?.name ?? null,
      slots: r.s.slots, used: r.count, validUntil: r.s.validUntil, expired: today > r.s.validUntil, state: r.state,
      canCancel: r.state !== 'anulat' && !paidPoints.has(r.s.id),
    }));
  const schoolIds = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const groupOptions = groups.filter((g) => g.active && g.sectionId !== null && schoolIds.has(g.sectionId)).map((g) => ({ value: g.id, label: g.name }));
  return { rows, groups: groupOptions };
}

/** The athlete's Abonamente tab: groups of the season (the current one when none is given), active bars, the rest as earlier (5.7). */
export async function athleteSubscriptions(store: PresenceStore, athleteId: string, seasonId: string | null, today: string): Promise<AthleteSubscriptions | null> {
  if (!(await store.athlete(athleteId))) return null;
  const subs = await store.subscriptions({ athleteId });
  const seasonOf = seasonId ?? currentSeason(await store.seasons())?.id ?? null;
  const memberships = seasonOf === null ? [] : await store.memberships({ athleteId, seasonId: seasonOf });
  const groups = groupNameMap(await store.groups());
  const used = await usedFor(store, subs);
  const stateOf = (s: SubscriptionRow): SubscriptionState => subscriptionState(s, used.get(s.id) ?? 0, today);
  const groupRows = memberships
    .filter(isCurrentMembership)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain))
    .flatMap((m) => {
      const name = groups.get(m.groupId);
      return name === undefined ? [] : [{ name, main: m.isMain }];
    });
  const bars = subs.filter((s) => stateOf(s) === 'activ').sort(byUseOrder).map((s) => barOf(s, used));
  const earlier = subs
    .filter((s) => stateOf(s) !== 'activ')
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.id.localeCompare(b.id))
    .map((s) => ({ itemName: s.itemName, startsOn: s.startsOn, validUntil: s.validUntil, used: used.get(s.id) ?? 0, slots: s.slots, state: stateOf(s) }));
  return { groups: groupRows, bars, earlier };
}
