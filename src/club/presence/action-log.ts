import { sumMoney } from './money';
import { usedSlots } from './subscriptions';
import { acsStamp, attendanceStamp, lessonSeriesStamp, lessonStamp, paymentStamp, subscriptionStamp, type GuardType, type PresenceGuard, type PresenceUndoRecord } from './undo';
import { subjectsOf, type Line } from '../groups/action-log';
import type { PresenceStore } from './store';

/** Writes the lines; the first carries the undo record, the others its id (`actionId`). Answers the action id. */
export async function recordPresenceAction(store: PresenceStore, actor: string, lines: Line[], undo: Omit<PresenceUndoRecord, 'kind' | 'subjects'>): Promise<string> {
  const [first, ...rest] = lines;
  const record: PresenceUndoRecord = { kind: 'presence', ...undo, subjects: subjectsOf(lines) };
  const ref = await store.recordAction({ ...first, changes: { ...first.changes, undo: record }, actor });
  for (const line of rest) await store.record({ ...line, changes: { ...line.changes, actionId: ref.id }, actor });
  return ref.id;
}

/** Lines of an action with no undo. */
export async function recordPresenceLines(store: PresenceStore, actor: string, lines: Line[]): Promise<void> {
  for (const line of lines) await store.record({ ...line, actor });
}

/** Slots an abonament has used: the attendance rows that point at it. */
const usedOf = async (store: PresenceStore, subscriptionId: string): Promise<number> =>
  usedSlots(await store.attendances({ subscriptionIds: [subscriptionId] })).get(subscriptionId) ?? 0;

async function stampOf(store: PresenceStore, type: GuardType, id: string): Promise<string | null> {
  switch (type) {
    case 'subscription': return subscriptionStamp(await store.subscription(id), await usedOf(store, id));
    case 'payment': return paymentStamp(await store.payment(id));
    case 'acs': {
      const [athleteId, seasonId] = id.split(':');
      return acsStamp(athleteId, seasonId, (await store.acsRows({ athleteId, seasonId }))[0]?.state ?? null);
    }
    case 'attendance': return attendanceStamp((await store.attendances({ ids: [id] }))[0] ?? null);
    case 'lessonSeries': {
      const row = await store.lessonSeries(id);
      return lessonSeriesStamp(row, row ? (await store.lessons({ seriesId: id })).map((l) => l.id) : []);
    }
    case 'lesson': {
      const paid = (await store.payments({ lessonId: id })).filter((p) => !p.cancelled).map((p) => p.amount);
      return lessonStamp(await store.lesson(id), sumMoney(paid));
    }
  }
}

/** The row's stamp now. Writers call it after their writes, inside the transaction. */
export async function guardOf(store: PresenceStore, type: GuardType, id: string): Promise<PresenceGuard> {
  return { type, id, stamp: await stampOf(store, type, id) };
}
