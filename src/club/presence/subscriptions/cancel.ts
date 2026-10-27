import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import { guardOf, recordPresenceAction } from '../action-log';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy/core';
import { P5_ACTIONS } from '../history-lines';
import { actorName } from '../lessons/create';
import type { PresenceStore } from '../store';
import type { PresenceUndoStep } from '../undo';

const UNCANCEL = { cancelled: false, cancelledAt: null, cancelledBy: null } as const;

const idsOf = async (store: PresenceStore, subscriptionId: string): Promise<string[]> =>
  (await store.attendances({ subscriptionIds: [subscriptionId] })).map((r) => r.id).sort();

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

async function cancelLocked(ctx: PresenceContext, id: string): Promise<ActionResult<{ cancelled: true }>> {
  const first = await ctx.store.subscription(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const rowIds = await idsOf(ctx.store, id);
  for (const rowId of rowIds) await ctx.store.lockAttendance(rowId);
  await ctx.store.lockSubscription(id);
  const sub = await ctx.store.subscription(id);
  if (!sub) return refuse(404, PRESENCE_ERRORS.notFound);
  const live = (await ctx.store.payments({ subscriptionId: id })).some((p) => !p.cancelled);
  if (sub.cancelled || live || !sameIds(rowIds, await idsOf(ctx.store, id))) return refuse(409, PRESENCE_ERRORS.stale);
  await ctx.store.updateSubscription(id, { cancelled: true, cancelledAt: ctx.now().toISOString(), cancelledBy: await actorName(ctx) });
  const steps: PresenceUndoStep[] = [{ op: 'setSubscription', id, values: UNCANCEL }];
  for (const rowId of rowIds) {
    await ctx.store.updateAttendance(rowId, { subscriptionId: null, billing: 'fara_abonament' });
    steps.push({ op: 'setAttendanceSlot', id: rowId, subscriptionId: id, billing: 'slot' });
  }
  const guards = [await guardOf(ctx.store, 'subscription', id)];
  for (const rowId of rowIds) guards.push(await guardOf(ctx.store, 'attendance', rowId));
  const line = { subjectType: SUBJECT.subscription, subjectId: id, action: P5_ACTIONS.subscriptionCancelled };
  return done({ cancelled: true as const }, await recordPresenceAction(ctx.store, ctx.actor, [line], { steps, athletes: [sub.athleteId], guards }));
}

/** The row stays, "anulat"; its covered rows go back to "Fără abonament". Refused while a payment still points at it (4.8a, C75). */
export async function cancelSubscription(ctx: PresenceContext, subscriptionId: string): Promise<ActionResult<{ cancelled: true }>> {
  return guarded(ctx.log, `[subscription-cancel] ${subscriptionId}`, () => ctx.store.transaction(() => cancelLocked(ctx, subscriptionId)));
}
