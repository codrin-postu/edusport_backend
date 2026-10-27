import { checkMainGroup } from '../group-membership';
import { guarded, refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { P4_ACTIONS } from './history-lines';
import { seasonOf } from './program-plan';
import { isPastSeason } from './season-pick';
import type { GroupStore, HistoryEntryRow } from './types';
import { NO_CARRY_PORTS, readUndoRecord, undoLockTargets, undoRefusal, type CarryPorts, type LockTargets, type UndoKind, type UndoRecord, type UndoStep } from './undo';

/** POST /club/undo body `{ actionId }`: the toast's "Anulează" for every phase 4 action (spec 8.1, 8.2, W15). */
type Run<K extends UndoStep['op']> = (store: GroupStore, step: Extract<UndoStep, { op: K }>, actionId: string, ports: CarryPorts) => Promise<void>;
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
    // A sender that claimed a job after the up-front check: the cancel could not stop it, so the undo rolls back.
    if ((await s.sentEmailJobs(actionId)) > 0) throw new Error('an e-mail of this change is already being sent');
  },
  setCurrentSeason: async (s, st) => {
    await s.setSeasonCurrent(st.otherId, false);
    await s.setSeasonCurrent(st.id, true);
  },
  uncarry: (_s, st, _id, p) => p.uncarry(st.subscriptionId, st.priceListId),
};

const runStep = (store: GroupStore, step: UndoStep, actionId: string, ports: CarryPorts): Promise<void> =>
  (RUN[step.op] as (s: GroupStore, st: UndoStep, id: string, p: CarryPorts) => Promise<void>)(store, step, actionId, ports);

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

/**
 * Every athlete, membership and event the steps refer to must still exist (a merge deletes an athlete; an undone remove or "Schimbă"
 * re-creates its row under a new id): no write is safe on a missing row. Read after the locks.
 */
async function targetsExist(store: GroupStore, t: LockTargets, steps: UndoStep[]): Promise<boolean> {
  for (const id of t.athletes) if (!(await store.athlete(id))) return false;
  for (const step of steps) {
    if ((step.op === 'deleteMembership' || step.op === 'setMembership') && !(await store.membership(step.id))) return false;
    if ((step.op === 'deleteEvent' || step.op === 'setEvent') && !(await store.event(step.id))) return false;
  }
  return true;
}

/** The season a date falls in, as an id list. */
async function seasonIdOn(store: GroupStore, date: string | null | undefined): Promise<string[]> {
  const season = date ? seasonOf(await store.seasons(), date) : null;
  return season ? [season.id] : [];
}

/** The seasons a group action wrote in (its membership rows' seasons, the seasons of its events' dates), read before the locks. */
async function groupSeasonIds(store: GroupStore, steps: UndoStep[]): Promise<string[]> {
  const ids: string[] = [];
  for (const step of steps) {
    if (step.op === 'createMembership') ids.push(step.row.seasonId);
    else if (step.op === 'deleteMembership' || step.op === 'setMembership') ids.push(...[(await store.membership(step.id))?.seasonId ?? '']);
    else if (step.op === 'createEvent') ids.push(...(await seasonIdOn(store, step.event.recurrence.singleDate ?? step.event.recurrence.seasonStart)));
    else if (step.op === 'deleteEvent' || step.op === 'setEvent') {
      const r = (await store.event(step.id))?.recurrence;
      ids.push(...(await seasonIdOn(store, r ? r.singleDate ?? r.seasonStart : null)));
    }
  }
  return ids.filter(Boolean);
}

/** A group action is not taken back into a season that is past by now (W5). */
async function inPastSeason(store: GroupStore, seasonIds: string[]): Promise<boolean> {
  const seasons = await store.seasons();
  return seasonIds.some((id) => {
    const season = seasons.find((s) => s.id === id);
    return !!season && isPastSeason(season, seasons);
  });
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
  const undone = await undoneActions(store, after);
  const belongsToUndone = (h: HistoryEntryRow): boolean => undone.has(h.id) || undone.has(String(h.changes.actionId)) || undone.has(String(h.changes.undoneOf));
  return { own, later: after.filter((h) => h.id !== entry.id && h.changes.actionId !== entry.id && !belongsToUndone(h)) };
}

/** Ids of the already undone actions that `lines` belong to (their own lines, or the "Anulat" lines their undo wrote): a net zero change. */
async function undoneActions(store: GroupStore, lines: HistoryEntryRow[]): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const h of lines) {
    for (const v of [h.id, h.changes.actionId, h.changes.undoneOf]) if (typeof v === 'string' && v) ids.add(v);
  }
  const undone = new Set<string>();
  for (const id of ids) if ((await store.historyEntry(id))?.changes.undone === true) undone.add(id);
  return undone;
}

/** A change's e-mail that already went out cannot be taken back: its undo is refused. */
async function mailSent(store: GroupStore, record: UndoRecord, actionId: string): Promise<boolean> {
  return record.steps.some((s) => s.op === 'cancelEmails') && (await store.sentEmailJobs(actionId)) > 0;
}

/** A carried list that an attendance used since cannot be taken back (7.3). */
async function carryTaken(ports: CarryPorts, record: UndoRecord): Promise<boolean> {
  for (const step of record.steps) if (step.op === 'uncarry' && (await ports.carryUsed(step.subscriptionId, step.priceListId))) return true;
  return false;
}

async function filedAfter(store: GroupStore, record: UndoRecord): Promise<boolean> {
  const guard = record.registrationsAfter;
  return !!guard && (await store.registrationsFiledAfter(guard.seasonId, guard.at)) > 0;
}

const stripMeta = (changes: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(changes).filter(([k]) => k !== 'undo' && k !== 'actionId' && k !== 'undone'));

/** "Anulat: <line>" on every subject the action wrote to (3.7), then the action is marked undone (same transaction: a second undo is refused). */
async function writeUndone(ctx: GroupContext, entry: HistoryEntryRow, own: HistoryEntryRow[]): Promise<void> {
  for (const line of [entry, ...own]) {
    await ctx.store.record({ subjectType: line.subjectType, subjectId: line.subjectId, action: P4_ACTIONS.undone, changes: { undoneAction: line.action, undoneChanges: stripMeta(line.changes), undoneOf: entry.id }, actor: ctx.actor });
  }
  await ctx.store.setHistoryChanges(entry.id, { ...entry.changes, undone: true });
}

async function undoLocked(ctx: GroupContext, actionId: string, ports: CarryPorts): Promise<AdminResult<{ revalidate: boolean }>> {
  const first = await ctx.store.historyEntry(actionId);
  if (!first) return refuse(404, GROUP_ERRORS.notFound);
  const record = readUndoRecord(first.changes.undo);
  if (!record) return refuse(409, GROUP_ERRORS.undoGroup);
  const base = undoLockTargets(record.steps, record.subjects, record.kind);
  // A group action takes the season lock of its own season first (seasons > athletes > groups > events > the entry).
  const groupSeasons = record.kind === 'group' ? [...new Set(await groupSeasonIds(ctx.store, record.steps))].sort() : [];
  const targets: LockTargets = { ...base, seasons: [...new Set([...base.seasons, ...groupSeasons])].sort() };
  await lockTargets(ctx.store, targets);
  if (record.kind === 'group' && (await inPastSeason(ctx.store, groupSeasons))) return refuse(409, GROUP_ERRORS.stale);
  if (!(await targetsExist(ctx.store, targets, record.steps))) return refuse(409, refusalText(record.kind));
  await ctx.store.lockHistoryEntry(actionId);
  const entry = await ctx.store.historyEntry(actionId);
  if (!entry) return refuse(404, GROUP_ERRORS.notFound);
  const { own, later } = await linesAfter(ctx.store, entry, record);
  if (undoRefusal(entry, later) || (await filedAfter(ctx.store, record)) || (await mailSent(ctx.store, record, actionId)) || (await carryTaken(ports, record))) return refuse(409, refusalText(record.kind));
  for (const step of [...record.steps].reverse()) await runStep(ctx.store, step, actionId, ports);
  await assertOneMain(ctx.store, targets.athletes);
  await writeUndone(ctx, entry, own);
  return { ok: true, data: { revalidate: record.revalidate } };
}

export async function undoAction(ctx: GroupContext, body: unknown, ports: CarryPorts = NO_CARRY_PORTS): Promise<AdminResult<{ undone: true }>> {
  const actionId = readActionId(body);
  if (!actionId) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[group-undo] ${actionId}`, () => ctx.store.transaction(() => undoLocked(ctx, actionId, ports)));
  if (res.ok === false) return res;
  if (res.data.revalidate) ctx.revalidate();
  return { ok: true, data: { undone: true } };
}
