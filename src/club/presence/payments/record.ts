import { guarded, refuse, type AdminResult } from '../../admin-result';
import { done, type ActionResult, type Line } from '../../groups/action-log';
import { safely } from '../../athletes/matches';
import type { AthleteRow } from '../../athletes/store';
import { isAnonymized } from '../../personal-data/anonymize-plan';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceContext } from '../context';
import { PRESENCE_ERRORS } from '../copy';
import { actorName } from '../lessons/create';
import type { PresenceUndoStep } from '../undo';
import type { PaymentRow, PaymentWrite } from '../types';
import { paymentEmailJob } from '../../../email/payment-email';
import { athleteLine, currentAcs, fieldsFor, linkIsValid, lockLinks, moveAcs, paymentLine, purposeTextOf, recordPaymentAction, type Fields } from './common';
import { acsOnFee, readNewPayment, sameFor, type NewPaymentInput, type PaymentInput, type PurposeFields } from './rules';

import type { PaymentResult } from './views';
export type { PaymentResult } from './views';
export type PaymentDraft = { athlete: AthleteRow; input: PaymentInput; sendEmail: boolean };
export type PaymentWritten = { paymentId: string; lines: Line[]; steps: PresenceUndoStep[]; emailQueued: boolean; duplicate: boolean };

const DUPLICATE_WINDOW_MS = 10_000;

const contactEmail = (a: AthleteRow): string | null => (a.email && a.email.trim() !== '' ? a.email.trim() : null);

/** The same payment recorded again within 10 s by the same admin (decided 1): a double click. */
async function findDuplicate(ctx: PresenceContext, row: PaymentWrite, fields: PurposeFields): Promise<PaymentRow | null> {
  const nowMs = ctx.now().getTime();
  const recent = (await ctx.store.payments({ athleteId: row.athleteId })).filter((p) =>
    !p.cancelled && p.amount === row.amount && p.method === row.method && p.paidOn === row.paidOn && sameFor(p, fields) && p.recordedBy === row.recordedBy
    && nowMs - Date.parse(p.recordedAt) < DUPLICATE_WINDOW_MS);
  return recent[0] ?? null;
}

type Fee = { lines: Line[]; steps: PresenceUndoStep[]; acsBefore: PaymentWrite['acsBefore'] };

/** A fee sets A.C.S. Da for its season; the state before is kept (4.16). */
async function applyFee(ctx: PresenceContext, athleteId: string, f: Fields): Promise<Fee> {
  if (f.fields.purpose !== 'cotizatie') return { lines: [], steps: [], acsBefore: null };
  const current = await currentAcs(ctx.store, athleteId, f.season.id);
  const { set, acsBefore } = acsOnFee(current);
  if (!set) return { lines: [], steps: [], acsBefore };
  const move = await moveAcs(ctx.store, athleteId, f.season, current, 'da');
  return { lines: [move.line], steps: [move.step], acsBefore };
}

async function queueEmail(ctx: PresenceContext, d: PaymentDraft, paymentId: string, row: PaymentWrite, purposeLabel: string): Promise<void> {
  const recipient = contactEmail(d.athlete) as string;
  const payload = { athleteName: d.athlete.name ?? '', amount: row.amount, method: row.method, paidOn: row.paidOn, purposeText: purposeLabel };
  const jobId = await ctx.store.createPaymentEmailJob(paymentEmailJob({ recipient, paymentId, payload }, ctx.now()));
  await ctx.store.updatePayment(paymentId, { emailJobId: jobId });
}

const recordedLines = (athleteId: string, paymentId: string, row: PaymentWrite, purposeLabel: string, fee: Line[]): Line[] => {
  const changes = { amount: row.amount, method: row.method, purposeText: purposeLabel };
  return [...fee, athleteLine(athleteId, P5_ACTIONS.paymentRecorded, changes), paymentLine(paymentId, P5_ACTIONS.paymentRecorded, changes)];
};

async function newRow(ctx: PresenceContext, d: PaymentDraft, f: Fields): Promise<PaymentWrite> {
  const { input } = d;
  return {
    athleteId: d.athlete.id, amount: input.amount, method: input.method, paidOn: input.paidOn, ...f.fields, note: input.note, sendEmail: d.sendEmail,
    emailJobId: null, acsBefore: null, recordedBy: await actorName(ctx), recordedAt: ctx.now().toISOString(), cancelled: false, cancelledAt: null, cancelledBy: null,
  };
}

/** Inside a transaction, the athlete already locked; locks the linked lesson or subscription, then writes. Used by Task 5. */
export async function writePaymentLocked(ctx: PresenceContext, d: PaymentDraft): Promise<AdminResult<PaymentWritten>> {
  const { athlete, input } = d;
  if (isAnonymized(athlete)) return refuse(409, PRESENCE_ERRORS.stale);
  const f = await fieldsFor(ctx.store, input.for, input.collectedAtRink, input.paidOn);
  if (!f) return refuse(400, PRESENCE_ERRORS.invalid);
  await lockLinks(ctx.store, [f.fields]);
  if (!(await linkIsValid(ctx.store, athlete.id, f.fields))) return refuse(409, PRESENCE_ERRORS.stale);
  if (d.sendEmail && contactEmail(athlete) === null) return refuse(409, PRESENCE_ERRORS.stale);
  const row = await newRow(ctx, d, f);
  const same = await findDuplicate(ctx, row, f.fields);
  if (same) return { ok: true, data: { paymentId: same.id, lines: [], steps: [], emailQueued: false, duplicate: true } };
  const fee = await applyFee(ctx, athlete.id, f);
  const paymentId = await ctx.store.createPayment({ ...row, acsBefore: fee.acsBefore });
  const label = await purposeTextOf(ctx.store, f.fields);
  if (d.sendEmail) await queueEmail(ctx, d, paymentId, row, label);
  const steps: PresenceUndoStep[] = [{ op: 'deletePayment', id: paymentId }, ...fee.steps, ...(d.sendEmail ? [{ op: 'cancelPaymentEmail' as const, paymentId }] : [])];
  return { ok: true, data: { paymentId, lines: recordedLines(athlete.id, paymentId, row, label, fee.lines), steps, emailQueued: d.sendEmail, duplicate: false } };
}

async function recordLocked(ctx: PresenceContext, body: NewPaymentInput, queued: { id: string | null }): Promise<ActionResult<PaymentResult>> {
  await ctx.store.lockAthlete(body.athleteId);
  const athlete = await ctx.store.athlete(body.athleteId);
  if (!athlete) return refuse(404, PRESENCE_ERRORS.notFound);
  const { athleteId: _athleteId, sendEmail, ...input } = body;
  const written = await writePaymentLocked(ctx, { athlete, input, sendEmail });
  if (written.ok === false) return written;
  const w = written.data;
  const value = { paymentId: w.paymentId, amount: input.amount, athleteName: athlete.name ?? '' };
  if (w.duplicate) return done(value, null);
  queued.id = w.emailQueued ? w.paymentId : null;
  return done(value, await recordPaymentAction(ctx, athlete.id, w.paymentId, w.lines, w.steps));
}

export async function recordPayment(ctx: PresenceContext, body: unknown): Promise<ActionResult<PaymentResult>> {
  const read = readNewPayment(body, ctx.today);
  if (read.ok === false) return refuse(read.status, read.error);
  const queued: { id: string | null } = { id: null };
  const result = await guarded(ctx.log, '[payment-record]', () => ctx.store.transaction(() => recordLocked(ctx, read.value, queued)));
  const emailId = queued.id;
  if (result.ok && emailId !== null) await safely(async () => ctx.paymentEmails(emailId), ctx.log, 'payment e-mail attempt');
  return result;
}
