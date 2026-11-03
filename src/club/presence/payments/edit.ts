import { guarded, refuse, type AdminResult } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { P5_ACTIONS } from '../history-lines';
import type { PaymentRow, PaymentWrite } from '../types';
import type { PresenceUndoStep } from '../undo';
import {
  currentAcs, fieldsFor, overpayRefusal, linkIsValid, lockLinks, moveAcs, paymentLine, purposeTextOf, recordPaymentAction, revertFee, sameLink, writeOf, type AcsMove, type Fields,
} from './common';
import { acsOnFee, paymentFieldChanges, readPaymentInput, sameFor, type PaymentInput } from './rules';

/** A fee of another season (or a former fee) reverts the old season; a new fee sets its season Da (4.16, 4.17, C9). */
async function feeMoves(ctx: PresenceContext, p: PaymentRow, f: Fields): Promise<{ moves: AcsMove[]; acsBefore: PaymentWrite['acsBefore'] }> {
  const wasFee = p.purpose === 'cotizatie';
  const isFee = f.fields.purpose === 'cotizatie';
  if (wasFee && isFee && p.seasonId === f.season.id) return { moves: [], acsBefore: p.acsBefore };
  const moves: AcsMove[] = [];
  const reverted = wasFee ? await revertFee(ctx.store, p) : null;
  if (reverted) moves.push(reverted);
  if (!isFee) return { moves, acsBefore: null };
  const current = await currentAcs(ctx.store, p.athleteId, f.season.id);
  const { set, acsBefore } = acsOnFee(current);
  if (set) moves.push(await moveAcs(ctx.store, p.athleteId, f.season, current, 'da'));
  return { moves, acsBefore };
}

const OLD_KEYS = ['amount', 'paidOn', 'method', 'purpose', 'subscriptionId', 'lessonId', 'clubMonth', 'seasonId', 'collectedAtRink', 'note', 'acsBefore'] as const;
const oldValues = (p: PaymentRow): Partial<PaymentWrite> => Object.fromEntries(OLD_KEYS.map((k) => [k, p[k]]));

const afterOf = (p: PaymentRow, input: PaymentInput, f: Fields, acsBefore: PaymentWrite['acsBefore']): PaymentWrite =>
  ({ ...writeOf(p), amount: input.amount, paidOn: input.paidOn, method: input.method, note: input.note, ...f.fields, acsBefore });

type Loaded = { p: PaymentRow; f: Fields };

/** Athlete, then the old and new link, then the payment (7.1); the payment is read again after the locks. */
async function loadLocked(ctx: PresenceContext, id: string, input: PaymentInput): Promise<AdminResult<Loaded>> {
  const first = await ctx.store.payment(id);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  await ctx.store.lockAthlete(first.athleteId);
  const f = await fieldsFor(ctx.store, input.for, input.collectedAtRink, input.paidOn);
  if (!f) return refuse(400, PRESENCE_ERRORS.invalid);
  await lockLinks(ctx.store, [first, f.fields]);
  await ctx.store.lockPayment(id);
  const p = await ctx.store.payment(id);
  if (!p) return refuse(404, PRESENCE_ERRORS.notFound);
  const stale = p.cancelled || p.athleteId !== first.athleteId || !sameLink(p, first) || (!sameLink(p, f.fields) && !(await linkIsValid(ctx.store, p.athleteId, f.fields)));
  return stale ? refuse(409, PRESENCE_ERRORS.stale) : { ok: true, data: { p, f } };
}

async function editLocked(ctx: PresenceContext, id: string, input: PaymentInput): Promise<ActionResult<{ changed: boolean }>> {
  const loaded = await loadLocked(ctx, id, input);
  if (loaded.ok === false) return loaded;
  const { p, f } = loaded.data;
  // Only a higher amount or a new "Pentru" can overpay: a payment already over (older data) stays editable for its note, date and method.
  if (input.amount > p.amount || !sameFor(p, f.fields)) {
    const over = await overpayRefusal(ctx.store, p.athleteId, input.for, input.amount, id);
    if (over !== null) return refuse(400, over);
  }
  const { moves, acsBefore } = await feeMoves(ctx, p, f);
  const after = afterOf(p, input, f, acsBefore);
  const texts = { before: await purposeTextOf(ctx.store, p), after: await purposeTextOf(ctx.store, after) };
  const fields = paymentFieldChanges(p, after, texts);
  if (Object.keys(fields).length === 0 && sameFor(p, f.fields)) return done({ changed: false }, null);
  await ctx.store.updatePayment(id, { amount: after.amount, paidOn: after.paidOn, method: after.method, note: after.note, ...f.fields, acsBefore });
  const lines: Line[] = [paymentLine(id, P5_ACTIONS.paymentEdited, { fields }), ...moves.map((m) => m.line)];
  const steps: PresenceUndoStep[] = [{ op: 'setPayment', id, values: oldValues(p) }, ...moves.map((m) => m.step)];
  return done({ changed: true }, await recordPaymentAction(ctx, p.athleteId, id, lines, steps));
}

/** Sumă, Data, Metodă, Pentru, rink box and Notă; never the athlete, never the e-mail (4.17, C12, C34). */
export async function editPayment(ctx: PresenceContext, id: string, body: unknown): Promise<ActionResult<{ changed: boolean }>> {
  const read = readPaymentInput(body, ctx.today);
  if (read.ok === false) return refuse(read.status, read.error);
  return guarded(ctx.log, `[payment-edit] ${id}`, () => ctx.store.transaction(() => editLocked(ctx, id, read.value)));
}
