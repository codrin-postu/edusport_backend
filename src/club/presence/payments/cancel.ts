import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { actorName } from '../lessons/create';
import type { PresenceUndoStep } from '../undo';
import { athleteLine, lockLinks, paymentLine, recordPaymentAction, revertFee, sameLink } from './common';

const UNCANCEL = { cancelled: false, cancelledAt: null, cancelledBy: null } as const;

async function cancelLocked(ctx: PresenceContext, id: string): Promise<ActionResult<{ cancelled: true }>> {
  const first = await ctx.store.payment(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  await lockLinks(ctx.store, [first]);
  await ctx.store.lockPayment(id);
  const p = await ctx.store.payment(id);
  if (!p) return refuse(404, PRESENCE_ERRORS.notFound);
  if (p.cancelled || !sameLink(p, first)) return refuse(409, PRESENCE_ERRORS.stale);
  const steps: PresenceUndoStep[] = [{ op: 'setPayment', id, values: UNCANCEL }];
  await ctx.store.updatePayment(id, { cancelled: true, cancelledAt: ctx.now().toISOString(), cancelledBy: await actorName(ctx) });
  await ctx.store.cancelPaymentEmailJob(id);
  const revert = await revertFee(ctx.store, p);
  if (revert) steps.push(revert.step);
  const changes = { amount: p.amount, paidOn: p.paidOn };
  const lines = [athleteLine(p.athleteId, P5_ACTIONS.paymentCancelled, changes), paymentLine(id, P5_ACTIONS.paymentCancelled, changes), ...(revert ? [revert.line] : [])];
  return done({ cancelled: true as const }, await recordPaymentAction(ctx, p.athleteId, id, lines, steps));
}

/** The row stays, struck through; a queued e-mail is cancelled and a fee's A.C.S. goes back when it was the last one (4.17, decided 7). */
export async function cancelPayment(ctx: PresenceContext, id: string): Promise<ActionResult<{ cancelled: true }>> {
  return guarded(ctx.log, `[payment-cancel] ${id}`, () => ctx.store.transaction(() => cancelLocked(ctx, id)));
}

