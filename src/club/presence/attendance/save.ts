import { guarded, refuse } from '../../admin-result';
import { done, type ActionResult } from '../../groups/action-log';
import { UniqueKeyError } from '../store';
import type { AthleteRow } from '../../athletes/store';
import { recordPresenceLines } from '../action-log';
import { audienceFor } from '../billing';
import type { PresenceContext } from '../context';
import { ATTENDANCE_ERRORS, sessionSavedToast } from '../copy/attendance';
import { PRESENCE_ERRORS } from '../copy/core';
import { actorName, coachesExist } from '../lessons/create';
import { usedSlots } from '../subscriptions';
import type { AttendanceRow, SessionRow, SessionWrite, SubscriptionRow } from '../types';
import type { InactiveAthlete, SessionSaved, SessionSaveBody } from './api-types';
import { rosterOn } from './roster';
import { saveLines } from './save-lines';
import { isTicked, planRows, readSaveBody, type RowPlan } from './save-plan';
import { resolveScope, type SaveScope } from './save-target';

export { respondSave } from './http';

export type SaveOutcome = ActionResult<SessionSaved> | { ok: false; status: 409; error: string; inactive: InactiveAthlete[] };
type People = { rows: AttendanceRow[]; athletes: Map<string, AthleteRow> };

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
const targetTag = (b: SessionSaveBody): string => b.id ?? b.occurrence ?? `added ${b.added?.groupId ?? ''}`;
const isEmpty = (p: RowPlan): boolean => p.creates.length + p.updates.length + p.deletes.length === 0;

/** The people a save touches, locked in id order after the session (7.1); anything outside the locked set means the rows moved meanwhile. */
async function lockPeople(ctx: PresenceContext, session: SessionRow | null, tickedIds: string[]): Promise<People | null> {
  const { store } = ctx;
  const first = session ? await store.attendances({ sessionIds: [session.id] }) : [];
  const ids = [...new Set([...first.map((r) => r.athleteId), ...tickedIds])].sort();
  for (const id of ids) await store.lockAthlete(id);
  const rows = session ? await store.attendances({ sessionIds: [session.id] }) : [];
  if (rows.some((r) => !ids.includes(r.athleteId))) return null;
  return { rows, athletes: new Map((await store.athletes()).map((a) => [a.id, a])) };
}

/** Abonamente of the ticked athletes, locked in id order; the slots they have used, read under the locks (4.10). */
async function slotState(ctx: PresenceContext, scope: SaveScope, tickedIds: string[]): Promise<{ subs: SubscriptionRow[]; used: Map<string, number> }> {
  if (scope.kind !== 'school') return { subs: [], used: new Map() };
  const mine = (await ctx.store.subscriptions()).filter((s) => tickedIds.includes(s.athleteId));
  for (const id of mine.map((s) => s.id).sort()) await ctx.store.lockSubscription(id);
  const subs = (await ctx.store.subscriptions()).filter((s) => tickedIds.includes(s.athleteId));
  const rows = subs.length > 0 ? await ctx.store.attendances({ subscriptionIds: subs.map((s) => s.id) }) : [];
  return { subs, used: usedSlots(rows) };
}

async function newSession(ctx: PresenceContext, scope: SaveScope, b: SessionSaveBody): Promise<SessionRow | null> {
  const { target } = scope;
  const at = ctx.now().toISOString();
  const write: SessionWrite = {
    groupId: target.groupId, seasonId: scope.season.id, date: target.date, startTime: target.startTime, durationMin: target.durationMin, source: target.source,
    eventId: target.eventId, occurrenceKey: target.occurrenceKey, outsideSchedule: target.outsideSchedule, coachIds: b.coachIds,
    savedBy: await actorName(ctx), savedAt: at, firstSavedAt: at,
  };
  try {
    return { ...write, id: await ctx.store.createSession(write) };
  } catch (err) {
    if (err instanceof UniqueKeyError) return null;
    throw err;
  }
}

async function applyPlan(ctx: PresenceContext, plan: RowPlan): Promise<void> {
  for (const id of plan.deletes) await ctx.store.deleteAttendance(id);
  for (const u of plan.updates) await ctx.store.updateAttendance(u.id, u.data);
  for (const row of plan.creates) await ctx.store.createAttendance(row);
}

function inactiveAsked(b: SessionSaveBody, rows: AttendanceRow[], tickedIds: string[], athletes: Map<string, AthleteRow>): InactiveAthlete[] {
  const rowed = new Set(rows.map((r) => r.athleteId));
  return tickedIds
    .filter((id) => !rowed.has(id) && athletes.get(id)?.status === 'inactiv' && !b.reactivate.includes(id) && !b.keepInactive.includes(id))
    .map((id) => ({ id, name: athletes.get(id)?.name ?? '' }));
}

async function saveLocked(ctx: PresenceContext, scope: SaveScope, b: SessionSaveBody): Promise<SaveOutcome> {
  const { store } = ctx;
  let session = scope.target.session;
  if (session) {
    await store.lockSession(session.id);
    session = await store.session(session.id);
    if (!session) return refuse(404, PRESENCE_ERRORS.notFound);
  }
  const tickedIds = b.ticks.filter((t) => isTicked(scope.kind, t)).map((t) => t.athleteId).sort();
  const people = await lockPeople(ctx, session, tickedIds);
  if (!people) return refuse(409, PRESENCE_ERRORS.conflict);
  if (tickedIds.some((id) => { const a = people.athletes.get(id); return !a || a.status === 'anonimizat'; })) return refuse(400, PRESENCE_ERRORS.invalid);
  const inactive = inactiveAsked(b, people.rows, tickedIds, people.athletes);
  if (inactive.length > 0) return { ok: false, status: 409, error: ATTENDANCE_ERRORS.inactive, inactive };
  return writeSave(ctx, scope, b, session, people, tickedIds);
}

async function planFor(ctx: PresenceContext, scope: SaveScope, b: SessionSaveBody, sessionId: string, people: People, tickedIds: string[]): Promise<{ plan: RowPlan; listed: string[] }> {
  const { store } = ctx;
  const slots = await slotState(ctx, scope, tickedIds);
  const listed = rosterOn(await store.memberships(), scope.group.id, scope.season.id, scope.target.date);
  const list = scope.group.priceListId ? ((await store.priceListRecords()).find((l) => l.id === scope.group.priceListId) ?? null) : null;
  const acs = await store.acsRows({ seasonId: scope.season.id });
  const plan = planRows({
    sessionId, kind: scope.kind, listed, existing: people.rows, ticks: b.ticks, list, ...slots, date: scope.target.date,
    audience: (id) => audienceFor(acs, id, scope.season.id),
  });
  return { plan, listed };
}

async function writeSave(ctx: PresenceContext, scope: SaveScope, b: SessionSaveBody, saved: SessionRow | null, people: People, tickedIds: string[]): Promise<SaveOutcome> {
  const session = saved ?? (await newSession(ctx, scope, b));
  if (!session) return refuse(409, PRESENCE_ERRORS.conflict);
  const created = saved === null;
  const { plan, listed } = await planFor(ctx, scope, b, session.id, people, tickedIds);
  const reactivated = plan.added.filter((id) => b.reactivate.includes(id) && people.athletes.get(id)?.status === 'inactiv');
  const coachesChanged = !created && !sameSet(session.coachIds, b.coachIds);
  const toast = sessionSavedToast(scope.group.name, scope.target.date);
  if (isEmpty(plan) && !coachesChanged && !created && reactivated.length === 0) return done({ sessionId: session.id, toast }, null);
  await applyPlan(ctx, plan);
  for (const id of reactivated) await ctx.store.setAthleteStatus(id, 'activ');
  if (!created) await ctx.store.updateSession(session.id, { coachIds: coachesChanged ? b.coachIds : session.coachIds, savedBy: await actorName(ctx), savedAt: ctx.now().toISOString() });
  await recordPresenceLines(ctx.store, ctx.actor, saveLines({
    sessionId: session.id, groupName: scope.group.name, date: scope.target.date, created, plan, coachIds: b.coachIds, coachesFrom: coachesChanged ? session.coachIds : null,
    present: people.rows.length - plan.deletes.length + plan.creates.length, listed: listed.length, reactivated,
  }));
  return done({ sessionId: session.id, toast }, null);
}

/** Saves a session's presence (spec 5.3, 4.4 to 4.13, 4.22): creates the session when missing, then adds, removes and reprices rows. No undo (C46). */
export async function saveSession(ctx: PresenceContext, body: unknown): Promise<SaveOutcome> {
  const b = readSaveBody(body);
  if (!b || new Set(b.ticks.map((t) => t.athleteId)).size !== b.ticks.length) return refuse(400, PRESENCE_ERRORS.invalid);
  if (b.coachIds.length === 0) return refuse(400, ATTENDANCE_ERRORS.noCoach);
  const outcome = await guarded<{ value: SessionSaved; actionId: string | null }>(ctx.log, `[attendance] save ${targetTag(b)}`, async () => {
    if (!(await coachesExist(ctx.store, b.coachIds))) return refuse(400, PRESENCE_ERRORS.invalid);
    const scope = await resolveScope(ctx.store, b);
    if ('ok' in scope) return scope;
    return ctx.store.transaction(() => saveLocked(ctx, scope, b));
  });
  return outcome;
}
