import { addDays } from '../../groups/dates';
import { currentSeason } from '../../groups/season-pick';
import type { SubscriptionStateFilter, SubscriptionQuery, SubscriptionListPage, SubscriptionListRow } from '../money-api';
import { byId, groupNameMap } from '../due/reads';
import { mainGroupToday } from '../due/settlement';
import type { PresenceStore } from '../store';
import { byUseOrder, subscriptionState, usedSlots } from '../subscriptions';
import type { SubscriptionRow, SubscriptionState } from '../types';
import { barOf } from './rules';

const FILTERS: readonly SubscriptionStateFilter[] = ['toate', 'active', 'expira14', 'epuizate', 'expirate', 'anulate'];
const STATE_OF: Record<Exclude<SubscriptionStateFilter, 'toate'>, SubscriptionState> = { active: 'activ', expira14: 'activ', epuizate: 'epuizat', expirate: 'expirat', anulate: 'anulat' };
/** "Expiră în 14 zile": active, `validUntil` from today to today + 13 (S22). */
const EXPIRING_DAYS = 13;

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
  const soonest = addDays(today, EXPIRING_DAYS);
  const rows: SubscriptionListRow[] = current
    .map((s) => {
      const count = used.get(s.id) ?? 0;
      return { s, count, state: subscriptionState(s, count, today), main: mains.get(s.athleteId) ?? null };
    })
    .filter((r) => (want === null || r.state === want) && (query.state !== 'expira14' || (r.s.validUntil >= today && r.s.validUntil <= soonest)) && (query.groupId === null || r.main?.id === query.groupId))
    .sort((a, b) => a.s.validUntil.localeCompare(b.s.validUntil) || a.s.id.localeCompare(b.s.id))
    .map((r) => ({
      subscriptionId: r.s.id, athleteId: r.s.athleteId, athleteName: athleteOf.get(r.s.athleteId)?.name ?? '', groupName: r.main?.name ?? null, code: r.s.code,
      slots: r.s.slots, used: r.count, validUntil: r.s.validUntil, expired: today > r.s.validUntil, state: r.state,
      canCancel: r.state !== 'anulat' && !paidPoints.has(r.s.id),
    }));
  const schoolIds = new Set(sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const groupOptions = groups.filter((g) => g.active && g.sectionId !== null && schoolIds.has(g.sectionId)).map((g) => ({ value: g.id, label: g.name }));
  return { rows, groups: groupOptions };
}
