import type { CarryInput, CarryOutcome, MoveCarry } from '../../groups/members';
import { NO_CARRY } from '../../groups/members';
import type { CarryPorts } from '../../groups/undo';
import { SUBJECT } from '../../subjects';
import { seasonOfDate } from '../dates';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceStore } from '../store';
import type { PriceListRecord, SubscriptionRow } from '../types';
import { carryList } from './carry';
import { usedOf } from './used';
import { athleteListIdsToday, barOf, currentSubscription, schoolListIds, type AbonamentBar } from './rules';

export type MovePreview = { bar: AbonamentBar | null; carries: boolean };
type Lists = { fromListId: string; to: PriceListRecord };

/** School group to school group on two different lists (5.12): the only move that can carry. */
async function listsOfMove(store: PresenceStore, fromGroupId: string, toGroupId: string | null): Promise<Lists | null> {
  if (toGroupId === null) return null;
  const [from, to, lists, sections] = await Promise.all([store.group(fromGroupId), store.group(toGroupId), store.priceListRecords(), store.sections()]);
  const school = schoolListIds(lists, sections);
  const [fromListId, toListId] = [from?.priceListId ?? null, to?.priceListId ?? null];
  if (fromListId === null || toListId === null || fromListId === toListId || !school.has(fromListId) || !school.has(toListId)) return null;
  const target = lists.find((l) => l.id === toListId);
  return target ? { fromListId, to: target } : null;
}

async function carryable(store: PresenceStore, athleteId: string, lists: Lists, today: string): Promise<SubscriptionRow[]> {
  const subs = await store.subscriptions({ athleteId });
  return carryList({ subs, used: await usedOf(store, subs), ...lists, today });
}

const lineOf = (sub: SubscriptionRow, listName: string) =>
  ({ subjectType: SUBJECT.subscription, subjectId: sub.id, action: P5_ACTIONS.subscriptionCarried, changes: { listName } });

/** Locks the carried abonamente (sorted, after the athlete), reads them again and adds the new list to each. */
async function carryLocked(store: PresenceStore, i: CarryInput): Promise<CarryOutcome> {
  const lists = await listsOfMove(store, i.fromGroupId, i.toGroupId);
  if (!lists) return NO_CARRY(i);
  const ids = (await carryable(store, i.athleteId, lists, i.today)).map((s) => s.id).sort();
  for (const id of ids) await store.lockSubscription(id);
  const subs = (await carryable(store, i.athleteId, lists, i.today)).filter((s) => ids.includes(s.id)).sort((a, b) => a.id.localeCompare(b.id));
  for (const s of subs) await store.updateSubscription(s.id, { validIn: [...s.validIn, lists.to.id] });
  return {
    lines: subs.map((s) => lineOf(s, lists.to.name)),
    steps: subs.map((s) => ({ op: 'uncarry', subscriptionId: s.id, priceListId: lists.to.id, athleteId: i.athleteId })),
    carried: subs.length,
  };
}

async function uncarry(store: PresenceStore, subscriptionId: string, priceListId: string): Promise<void> {
  const sub = await store.subscription(subscriptionId);
  if (!sub) throw new Error(`no abonament ${subscriptionId} to take the carry off`);
  await store.updateSubscription(subscriptionId, { validIn: sub.validIn.filter((id) => id !== priceListId) });
}

/** An attendance with the abonament in a group on the carried list. */
async function carryUsed(store: PresenceStore, subscriptionId: string, priceListId: string): Promise<boolean> {
  const onList = new Set((await store.groups()).filter((g) => g.priceListId === priceListId).map((g) => g.id));
  return (await store.attendances({ subscriptionIds: [subscriptionId] })).some((a) => onList.has(a.groupId));
}

export function presenceCarry(store: PresenceStore): { carry: MoveCarry; ports: CarryPorts } {
  return {
    carry: (i) => store.transaction(() => carryLocked(store, i)),
    ports: {
      lockSubscription: (subscriptionId) => store.transaction(() => store.lockSubscription(subscriptionId)),
      subscriptionExists: async (subscriptionId) => (await store.subscription(subscriptionId)) !== null,
      uncarry: (subscriptionId, priceListId) => store.transaction(() => uncarry(store, subscriptionId, priceListId)),
      carryUsed: (subscriptionId, priceListId) => carryUsed(store, subscriptionId, priceListId),
    },
  };
}

/** The abonament the move window shows (decided 9) and whether the move carries it (5.12). */
export async function movePreview(store: PresenceStore, i: { athleteId: string; fromGroupId: string; toGroupId: string | null }, today: string): Promise<MovePreview> {
  const [subs, memberships, groups, lists, sections, seasons] = await Promise.all([
    store.subscriptions({ athleteId: i.athleteId }), store.memberships({ athleteId: i.athleteId }), store.groups(), store.priceListRecords(), store.sections(), store.seasons(),
  ]);
  const used = await usedOf(store, subs);
  const listIds = athleteListIdsToday(memberships, groups, schoolListIds(lists, sections), seasonOfDate(seasons, today)?.id ?? null, i.athleteId);
  const current = currentSubscription(subs, used, listIds, today);
  if (!current) return { bar: null, carries: false };
  const moved = await listsOfMove(store, i.fromGroupId, i.toGroupId);
  return { bar: barOf(current, used), carries: !!moved && carryList({ subs, used, ...moved, today }).some((s) => s.id === current.id) };
}
