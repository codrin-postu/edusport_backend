import { guarded, refuse, type AdminResult } from '../admin-result';
import type { HistoryEntryRow } from '../groups/types';
import { P4_ACTIONS } from '../groups/history-lines';
import { readActionId } from '../groups/undo-service';
import type { PresenceContext } from './context';
import { PRESENCE_ERRORS } from './copy';
import { guardOf } from './action-log';
import { overpayRefusal } from './payments/common';
import { paymentForOf } from './payments/rules';
import type { PresenceStore } from './store';
import { readViewUndo } from '../tables/views-undo';
import { presenceLockTargets, readPresenceRecord, type PresenceUndoRecord, type PresenceUndoStep } from './undo';

/** POST /club/undo body `{ actionId }` for a presence action: the toast's "Anulează" (spec 7.3). */
type Run<K extends PresenceUndoStep['op']> = (store: PresenceStore, step: Extract<PresenceUndoStep, { op: K }>) => Promise<void>;
type Runners = { [K in PresenceUndoStep['op']]: Run<K> };

const RUN: Runners = {
  deleteSubscription: (s, st) => s.deleteSubscription(st.id),
  setSubscription: (s, st) => s.updateSubscription(st.id, st.values),
  setAttendanceSlot: (s, st) => s.updateAttendance(st.id, { subscriptionId: st.subscriptionId, billing: st.billing }),
  deletePayment: (s, st) => s.deletePayment(st.id),
  setPayment: (s, st) => s.updatePayment(st.id, st.values),
  setAcs: (s, st) => s.setAcs(st.athleteId, st.seasonId, st.state),
  cancelPaymentEmail: async (s, st) => {
    await s.cancelPaymentEmailJob(st.paymentId);
    // A sender that claimed the job after the up-front check: the cancel could not stop it, so the undo rolls back.
    if ((await s.sentPaymentEmailJobs(st.paymentId)) > 0) throw new Error('the e-mail of this payment is already being sent');
  },
  deleteLesson: (s, st) => s.deleteLesson(st.id),
  createLesson: async (s, st) => {
    await s.createLesson(st.row);
  },
};

const runStep = (store: PresenceStore, step: PresenceUndoStep): Promise<void> => (RUN[step.op] as (s: PresenceStore, st: PresenceUndoStep) => Promise<void>)(store, step);

/** 'presence' or 'table-view' when the entry carries that undo record; anything else (or no entry) is left to the phase 4 undo. */
export async function undoKindOf(store: Pick<PresenceStore, 'historyEntry'>, body: unknown): Promise<'presence' | 'table-view' | 'other'> {
  const id = readActionId(body);
  const entry = id ? await store.historyEntry(id) : null;
  if (!entry) return 'other';
  if (readPresenceRecord(entry.changes.undo)) return 'presence';
  return readViewUndo(entry.changes.undo) ? 'table-view' : 'other';
}

const isUndone = (entry: HistoryEntryRow | null): boolean => entry?.changes.undone === true;

async function lockAll(store: PresenceStore, record: PresenceUndoRecord, actionId: string): Promise<void> {
  const t = presenceLockTargets(record);
  for (const id of t.athletes) await store.lockAthlete(id);
  for (const id of t.lessons) await store.lockLesson(id);
  for (const id of t.attendances) await store.lockAttendance(id);
  for (const id of t.subscriptions) await store.lockSubscription(id);
  for (const id of t.payments) await store.lockPayment(id);
  await store.lockHistoryEntry(actionId);
}

/** Every athlete the record refers to must still exist (a merge deletes one): no write is safe for a missing athlete. */
async function athletesExist(store: PresenceStore, record: PresenceUndoRecord): Promise<boolean> {
  for (const id of presenceLockTargets(record).athletes) if (!(await store.athlete(id))) return false;
  return true;
}

async function guardsHold(store: PresenceStore, record: PresenceUndoRecord): Promise<boolean> {
  for (const g of record.guards) if ((await guardOf(store, g.type, g.id)).stamp !== g.stamp) return false;
  for (const step of record.steps) if (step.op === 'cancelPaymentEmail' && (await store.sentPaymentEmailJobs(step.paymentId)) > 0) return false;
  return true;
}

const META = new Set(['undo', 'actionId', 'undone']);
const stripMeta = (changes: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(changes).filter(([k]) => !META.has(k)));

/** "Anulat: <line>" on every subject the action wrote to, then the action is marked undone (same transaction: a second undo is refused). */
async function writeUndone(ctx: PresenceContext, entry: HistoryEntryRow, record: PresenceUndoRecord): Promise<void> {
  const own = (await ctx.store.historyAfter(entry.seq, record.subjects)).filter((h) => h.changes.actionId === entry.id);
  for (const line of [entry, ...own]) {
    await ctx.store.record({ subjectType: line.subjectType, subjectId: line.subjectId, action: P4_ACTIONS.undone, changes: { undoneAction: line.action, undoneChanges: stripMeta(line.changes), undoneOf: entry.id }, actor: ctx.actor });
  }
  await ctx.store.setHistoryChanges(entry.id, { ...entry.changes, undone: true });
}

/** Putting a payment back (a cancelled one live again, a higher amount, another "Pentru") must still fit what is owed (DEC 2026-11-03 (3)); the athletes are locked. */
async function restoredOverpay(store: PresenceStore, record: PresenceUndoRecord): Promise<string | null> {
  for (const step of record.steps) {
    if (step.op !== 'setPayment') continue;
    const now = await store.payment(step.id);
    if (!now) continue;
    const after = { ...now, ...step.values };
    const growing = now.cancelled || after.amount > now.amount || JSON.stringify(paymentForOf(after)) !== JSON.stringify(paymentForOf(now));
    if (after.cancelled || !growing) continue;
    const over = await overpayRefusal(store, now.athleteId, paymentForOf(after), after.amount, step.id);
    if (over !== null) return over;
  }
  return null;
}

async function undoLocked(ctx: PresenceContext, actionId: string): Promise<AdminResult<{ undone: true }>> {
  const first = await ctx.store.historyEntry(actionId);
  if (!first) return refuse(404, PRESENCE_ERRORS.notFound);
  const record = readPresenceRecord(first.changes.undo);
  if (!record || isUndone(first)) return refuse(409, PRESENCE_ERRORS.undoChanged);
  await lockAll(ctx.store, record, actionId);
  const entry = await ctx.store.historyEntry(actionId);
  if (!entry) return refuse(404, PRESENCE_ERRORS.notFound);
  if (isUndone(entry) || !(await athletesExist(ctx.store, record)) || !(await guardsHold(ctx.store, record))) return refuse(409, PRESENCE_ERRORS.undoChanged);
  const over = await restoredOverpay(ctx.store, record);
  if (over !== null) return refuse(400, over);
  for (const step of [...record.steps].reverse()) await runStep(ctx.store, step);
  await writeUndone(ctx, entry, record);
  return { ok: true, data: { undone: true } };
}

export async function undoPresenceAction(ctx: PresenceContext, body: unknown): Promise<AdminResult<{ undone: true }>> {
  const actionId = readActionId(body);
  if (!actionId) return refuse(400, PRESENCE_ERRORS.invalid);
  return guarded(ctx.log, `[undo-presence] ${actionId}`, () => ctx.store.transaction(() => undoLocked(ctx, actionId)));
}
