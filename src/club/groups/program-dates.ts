import { guarded, refuse, type AdminResult } from '../admin-result';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { lockedEvent } from './program';
import { isClassDate, planDateMode, readDateMode, seasonOf, wantsEmail, type DateMode } from './program-plan';
import { nextClass, recipients, schedulePayload, scheduleJobs, type Change } from './schedule-mail';
import { isPastSeason } from './season-pick';
import { seasonBounds } from './series';
import type { EventRecord, ExceptionRow, GroupRecord, GroupStore, SeasonRecord } from './types';
import type { UndoStep } from './undo';

/** Per date "Ține / Anulează / Mută" (spec 6.3, 6.5, W7, W12, W13). */
export type DateAnswer = { mode: DateMode['mode']; date: string; emails: number };
type Spot = { e: EventRecord; group: GroupRecord; season: SeasonRecord };

const inBreak = (store: GroupStore, date: string): Promise<boolean> => store.breaks().then((list) => list.some((b) => b.startDate <= date && date <= b.endDate));

/** The season of the date locked first (a concurrent season switch waits), then read again: it must still be a season that is not past. */
async function lockedSeason(store: GroupStore, date: string): Promise<SeasonRecord | null> {
  const first = seasonOf(await store.seasons(), date);
  if (!first) return null;
  await store.lockSeason(first.id);
  const seasons = await store.seasons();
  const season = seasonOf(seasons, date);
  return season && season.id === first.id && !isPastSeason(season, seasons) ? season : null;
}

/** The locked season, then the event (group first), its group; the date must be a class date outside a Pauză. */
async function spotOf(store: GroupStore, eventId: string, date: string): Promise<AdminResult<Spot>> {
  const season = await lockedSeason(store, date);
  const e = season ? await lockedEvent(store, eventId) : null;
  const group = e?.groupId ? await store.group(e.groupId) : null;
  if (!e || !group || !season) return refuse(409, GROUP_ERRORS.stale);
  if (!isClassDate(e, date) || (await inBreak(store, date))) return refuse(400, GROUP_ERRORS.invalid);
  return { ok: true, data: { e, group, season } };
}

function dateLine(groupId: string, date: string, m: DateMode, emails: number): Line {
  const base = { subjectType: GROUP_SUBJECT, subjectId: groupId };
  if (m.mode === 'keep') return { ...base, action: P4_ACTIONS.dateKept, changes: { date } };
  if (m.mode === 'remove') return { ...base, action: P4_ACTIONS.dateRemoved, changes: { date } };
  if (m.mode === 'cancel') return { ...base, action: P4_ACTIONS.dateCancelled, changes: { date, reason: m.reason, emails } };
  return { ...base, action: P4_ACTIONS.dateMoved, changes: { date, newDate: m.newDate, newStartTime: m.newStartTime, reason: m.reason, emails } };
}

const canonical = (rows: ExceptionRow[]): string[] => rows.map((r) => JSON.stringify(r, Object.keys(r).sort())).sort();
/** The same exceptions whatever their order: re-saving an unchanged state is a no-op. */
const same = (a: ExceptionRow[], b: ExceptionRow[]): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

async function addressesOf(store: GroupStore, spot: Spot): Promise<string[]> {
  const [athletes, memberships] = await Promise.all([store.athletes(), store.memberships({ groupId: spot.group.id, seasonId: spot.season.id })]);
  return recipients(athletes, memberships, spot.group.id, spot.season.id);
}

/** F2: the payload comes from the event as it was before the write (the old date and time), never from a re-read. */
async function queueEmails(ctx: GroupContext, spot: Spot, date: string, change: Change, addresses: string[], actionId: string): Promise<void> {
  const [events, breaks] = await Promise.all([ctx.store.events({ groupId: spot.group.id }), ctx.store.breaks()]);
  const next = change.mode === 'cancel' ? nextClass(events, breaks, spot.group.id, date, seasonBounds(spot.season).end) : null;
  const payload = schedulePayload(spot.group.name, spot.e, date, change, next);
  await ctx.store.createEmailJobs(scheduleJobs(addresses, payload, spot.group.id, actionId, ctx.now()));
}

async function dateLocked(ctx: GroupContext, eventId: string, date: string, m: DateMode, notify: boolean): Promise<ActionResult<DateAnswer>> {
  const found = await spotOf(ctx.store, eventId, date);
  if (found.ok === false) return found;
  const spot = found.data;
  if (m.mode === 'remove' && (await ctx.hasSavedSession(spot.group.id, date))) return refuse(409, GROUP_ERRORS.datePresence);
  const exceptions = planDateMode(spot.e, date, m);
  if (!exceptions) return refuse(400, GROUP_ERRORS.invalid);
  if (same(spot.e.exceptions, exceptions)) return done({ mode: m.mode, date, emails: 0 }, null);
  const change: Change | null = m.mode === 'keep' || m.mode === 'remove' ? null : m;
  const addresses = change && notify ? await addressesOf(ctx.store, spot) : [];
  await ctx.store.updateEvent(spot.e.id, { exceptions });
  const steps: UndoStep[] = [{ op: 'setEvent', id: spot.e.id, recurrence: spot.e.recurrence, exceptions: spot.e.exceptions }];
  if (addresses.length) steps.push({ op: 'cancelEmails' });
  const actionId = await recordAction(ctx.store, ctx.actor, [dateLine(spot.group.id, date, m, addresses.length)], { kind: 'group', steps, revalidate: true });
  if (change && addresses.length) await queueEmails(ctx, spot, date, change, addresses, actionId);
  return done({ mode: m.mode, date, emails: addresses.length }, actionId);
}

/** PUT /club/program/:eventId/dates/:date body `{ mode, newDate, newStartTime, reason, notifyParents }`. */
export async function setDate(ctx: GroupContext, eventId: string, date: string, body: unknown): Promise<ActionResult<DateAnswer>> {
  const m = readDateMode(body);
  if (!m || !isIsoDate(date)) return refuse(400, GROUP_ERRORS.invalid);
  const res = await guarded(ctx.log, `[program] date ${date} of ${eventId}`, () => ctx.store.transaction(() => dateLocked(ctx, eventId, date, m, wantsEmail(body))));
  if (res.ok === true && res.data.actionId) {
    ctx.revalidate();
    if (res.data.value.emails > 0) ctx.emails(res.data.actionId);
  }
  return res;
}
