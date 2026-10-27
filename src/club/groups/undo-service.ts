import { checkMainGroup } from '../group-membership';
import { guarded, refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { P4_ACTIONS } from './history-lines';
import type { GroupStore, HistoryEntryRow } from './types';
import { readUndoRecord, undoLockTargets, undoRefusal, type LockTargets, type UndoKind, type UndoRecord, type UndoStep } from './undo';

/** POST /club/undo body `{ actionId }`: the toast's "Anulează" for every phase 4 action (spec 8.1, 8.2, W15). */
type Run<K extends UndoStep['op']> = (store: GroupStore, step: Extract<UndoStep, { op: K }>, actionId: string) => Promise<void>;
type Runners = { [K in UndoStep['op']]: Run<K> };

const RUN: Runners = {
  deleteMembership: (s, st) => s.deleteMembership(st.id),
  setMembership: (s, st) => s.updateMembership(st.id, { isMain: st.isMain, to: st.to }),
  createMembership: async (s, st) => {
    await s.createMembership(st.row);
  },
  setStatus: (s, st) => s.setAthleteStatus(st.athleteId, st.status),
  deleteEvent: (s, st) => s.deleteEvent(st.id),
  setEvent: (s, st) => s.updateEvent(st.id, { recurrence: st.recurrence, exceptions: st.exceptions }),
  createEvent: async (s, st) => {
    await s.createEvent(st.event);
  },
  cancelEmails: async (s, _st, actionId) => {
    await s.cancelEmailJobs(actionId);
  },
  setCurrentSeason: async (s, st) => {
    await s.setSeasonCurrent(st.otherId, false);
    await s.setSeasonCurrent(st.id, true);
  },
};

const runStep = (store: GroupStore, step: UndoStep, actionId: string): Promise<void> =>
  (RUN[step.op] as (s: GroupStore, st: UndoStep, id: string) => Promise<void>)(store, step, actionId);

export function readActionId(body: unknown): string | null {
  const v = isRecord(body) ? body.actionId : null;
  return typeof v === 'string' && v ? v : null;
}

async function lockTargets(store: GroupStore, t: LockTargets): Promise<void> {
  for (const id of t.seasons) await store.lockSeason(id);
  for (const id of t.athletes) await store.lockAthlete(id);
  for (const id of t.groups) await store.lockGroup(id);
  for (const id of t.events) await store.lockEvent(id);
}

/** Every athlete the steps touch must still exist (a merge deletes one): no write is safe on a missing row. */
async function targetsExist(store: GroupStore, t: LockTargets): Promise<boolean> {
  for (const id of t.athletes) if (!(await store.athlete(id))) return false;
  return true;
}

/** After the steps: one main per athlete and season (spec 8.1). Throws, so the transaction rolls back. */
async function assertOneMain(store: GroupStore, athleteIds: string[]): Promise<void> {
  for (const athleteId of athleteIds) {
    const rows = await store.memberships({ athleteId });
    for (const seasonId of new Set(rows.map((m) => m.seasonId))) {
      if (checkMainGroup(rows, seasonId).ok === false) throw new Error(`main group rule broken for ${athleteId}`);
    }
  }
}

const refusalText = (kind: UndoKind): string => (kind === 'season' ? GROUP_ERRORS.undoSeason : GROUP_ERRORS.undoGroup);
/** A season action is refused after ANY later group, athlete or season line (10.5: "anything changed since"); a group action, after one on its own subjects. */
const SEASON_WATCH: ReadonlySet<string> = new Set(['group', 'athlete', 'season']);

/** Lines newer than the action's own first line, split into the action's own (`actionId`) and the rest. The rest is what `undoRefusal` judges. */
async function linesAfter(store: GroupStore, entry: HistoryEntryRow, record: UndoRecord): Promise<{ own: HistoryEntryRow[]; later: HistoryEntryRow[] }> {
  const after = record.kind === 'group'
    ? await store.historyAfter(entry.seq, record.subjects)
    : (await store.historyAfter(entry.seq, null)).filter((h) => SEASON_WATCH.has(h.subjectType));
  const own = after.filter((h) => h.changes.actionId === entry.id);
  return { own, later: after.filter((h) => h.id !== entry.id && h.changes.actionId !== entry.id) };
}

async function filedAfter(store: GroupStore, record: UndoRecord): Promise<boolean> {
  const guard = record.registrationsAfter;
  return !!guard && (await store.registrationsFiledAfter(guard.seasonId, guard.at)) > 0;
}

const stripMeta = (changes: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(changes).filter(([k]) => k !== 'undo' && k !== 'actionId' && k !== 'undone'));

/** "Anulat: <line>" on every subject the action wrote to (3.7), then the action is marked undone (same transaction: a second undo is refused). */
async function writeUndone(ctx: GroupContext, entry: HistoryEntryRow, own: HistoryEntryRow[]): Promise<void> {
  for (const line of [entry, ...own]) {
    await ctx.store.record({ subjectType: line.subjectType, subjectId: line.subjectId, action: P4_ACTIONS.undone, changes: { undoneAction: line.action, undoneChanges: stripMeta(line.changes) }, actor: ctx.actor });
  }
  await ctx.store.setHistoryChanges(entry.id, { ...entry.changes, undone: true });
}

async function undoLocked(ctx: GroupContext, actionId: string): Promise<AdminResult<{ revalidate: boolean }>> {
  const first = await ctx.store.historyEntry(actionId);
  if (!first) return refuse(404, GROUP_ERRORS.notFound);
  const record = readUndoRecord(first.changes.undo);
  if (!record) return refuse(409, GROUP_ERRORS.undoGroup);
  const targets = undoLockTargets(record.steps);
  await lockTargets(ctx.store, targets);
  if (!(await targetsExist(ctx.store, targets))) return refuse(409, refusalText(record.kind));
  await ctx.store.lockHistoryEntry(actionId);
  const entry = await ctx.store.historyEntry(actionId);
  if (!entry) return refuse(404, GROUP_ERRORS.notFound);
  const { own, later } = await linesAfter(ctx.store, entry, record);
  if (undoRefusal(entry, later) || (await filedAfter(ctx.store, record))) return refuse(409, refusalText(record.kind));
  for (const step of [...record.steps].reverse()) await runStep(ctx.store, step, actionId);
  await assertOneMain(ctx.store, targets.athletes);
  await writeUndone(ctx, entry, own);
  return { ok: true, data: { revalidate: record.revalidate } };
}

export async function undoAction(ctx: GroupContext, body: unknown): Promise<AdminResult<{ undone: true }>> {
  const actionId = readActionId(body);
  if (!actionId) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[undo] ${actionId}`, () => ctx.store.transaction(() => undoLocked(ctx, actionId)));
  if (res.ok === false) return res;
  if (res.data.revalidate) ctx.revalidate();
  return { ok: true, data: { undone: true } };
}
