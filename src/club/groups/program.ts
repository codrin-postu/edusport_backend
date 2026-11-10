import { expandOccurrences } from '../../api/calendar-event/services/expand';
import { guarded, refuse, type AdminResult } from '../admin-result';
import { occurrenceKey } from '../presence/sessions';
import { isRecord } from '../narrow';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { EventSession, GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { asCalendarRow, classWrite, eventType, inputText, planDayChange, planDayEnd, readDayKey, readProgramInput, readSeriesInput, seasonOf, seriesWrite, type EventChange, type ProgramInput } from './program-plan';
import { isPastSeason } from './season-pick';
import { seasonBounds, seriesText, seriesView, type SeriesView } from './series';
import type { DayKey, EventRecord, EventWrite, GroupRecord, GroupStore, SeasonRecord, SectionRecord } from './types';
import type { UndoStep } from './undo';

/** The group's program (spec 6.3, W10): one transaction each, the group locked before the event, a group line, an undo, a website ping. */
type Placed = { group: GroupRecord; section: SectionRecord; season: SeasonRecord };

export const eventSnapshot = (e: EventRecord): EventWrite => ({
  title: e.title, type: e.type, description: e.description, groupId: e.groupId, recurrence: e.recurrence, exceptions: e.exceptions,
});

/** The active group, its section and the (not past) season that contains `date`. */
async function placeOn(store: GroupStore, groupId: string, date: string): Promise<AdminResult<Placed>> {
  const [group, sections, seasons] = await Promise.all([store.group(groupId), store.sections(), store.seasons()]);
  const section = sections.find((s) => s.id === group?.sectionId);
  const season = seasonOf(seasons, date);
  if (!group || !group.active || !section) return refuse(409, GROUP_ERRORS.stale);
  if (!season || isPastSeason(season, seasons)) return refuse(409, GROUP_ERRORS.stale);
  return { ok: true, data: { group, section, season } };
}

/** The season that contains `date` is locked first (seasons before groups before events); placeOn then reads it again and refuses a past one. */
async function lockSeasonOn(store: GroupStore, date: string): Promise<void> {
  const season = seasonOf(await store.seasons(), date);
  if (season) await store.lockSeason(season.id);
}

function addedLine(groupId: string, input: ProgramInput): Line {
  if (input.repeat === true) return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.programAdded, changes: { series: inputText(input.series) } };
  const { date, startTime, durationMin } = input.one;
  return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.classAdded, changes: { date, startTime, durationMin } };
}

async function addLocked(ctx: GroupContext, groupId: string, input: ProgramInput): Promise<ActionResult<{ eventId: string; date: string | null }>> {
  const date = input.repeat === true ? input.series.from : input.one.date;
  await lockSeasonOn(ctx.store, date);
  await ctx.store.lockGroup(groupId);
  const placed = await placeOn(ctx.store, groupId, date);
  if (placed.ok === false) return placed;
  const { group, section, season } = placed.data;
  if (input.repeat === true && input.series.until && (input.series.until < input.series.from || input.series.until > seasonBounds(season).end)) return refuse(400, GROUP_ERRORS.invalid);
  const type = eventType(section.kind);
  const write = input.repeat === true ? seriesWrite(group, type, input.series, seasonBounds(season).end) : classWrite(group, type, input.one);
  const eventId = await ctx.store.createEvent(write);
  const actionId = await recordAction(ctx.store, ctx.actor, [addedLine(group.id, input)], { kind: 'group', steps: [{ op: 'deleteEvent', id: eventId }], revalidate: true });
  return done({ eventId, date: input.repeat === true ? null : input.one.date }, actionId);
}

const pinged = <T>(ctx: GroupContext, res: ActionResult<T>): ActionResult<T> => {
  if (res.ok === true) ctx.revalidate();
  return res;
};

/** POST /club/groups/:id/program: "Program nou", a series ("Se repetă" on) or one class. */
export async function addProgram(ctx: GroupContext, groupId: string, body: unknown): Promise<ActionResult<{ eventId: string; date: string | null }>> {
  const read = readProgramInput(body);
  if (read.ok === false) return refuse(400, read.error);
  return pinged(ctx, await guarded(ctx.log, `[program] adding to ${groupId}`, () => ctx.store.transaction(() => addLocked(ctx, groupId, read.value))));
}

type LockedSeries = { e: EventRecord; series: SeriesView; group: GroupRecord };

/** The event read, its group locked, then the event, then both read again (lock order: groups before events). Null: gone or moved. */
export async function lockedEvent(store: GroupStore, eventId: string): Promise<EventRecord | null> {
  const first = await store.event(eventId);
  if (!first?.groupId) return null;
  await store.lockGroup(first.groupId);
  await store.lockEvent(eventId);
  const e = await store.event(eventId);
  return e && e.groupId === first.groupId ? e : null;
}

/** The series locked and read again; `from` must fall inside it and in a season that is not past. */
async function lockedSeries(store: GroupStore, eventId: string, from: string): Promise<AdminResult<LockedSeries>> {
  await lockSeasonOn(store, from);
  const e = await lockedEvent(store, eventId);
  const series = e ? seriesView(e) : null;
  if (!e || !series || !e.groupId) return refuse(409, GROUP_ERRORS.stale);
  if (from < series.from || from > series.to) return refuse(400, GROUP_ERRORS.invalid);
  const placed = await placeOn(store, e.groupId, from);
  return placed.ok === false ? placed : { ok: true, data: { e, series, group: placed.data.group } };
}

/** Applies an end or a delete of the old series; answers the step that takes it back. */
async function applyChange(store: GroupStore, e: EventRecord, change: EventChange): Promise<UndoStep> {
  if (change.op === 'delete') {
    await store.deleteEvent(e.id);
    return { op: 'createEvent', event: eventSnapshot(e) };
  }
  await store.updateEvent(e.id, { recurrence: change.recurrence, exceptions: change.exceptions });
  return { op: 'setEvent', id: e.id, recurrence: e.recurrence, exceptions: e.exceptions };
}

/** The rest event, then the new one; the steps that delete them again. */
async function createdSteps(store: GroupStore, rest: EventWrite | null, created: EventWrite): Promise<{ createdId: string; restId: string | null; undo: UndoStep[] }> {
  const restId = rest ? await store.createEvent(rest) : null;
  const createdId = await store.createEvent(created);
  return { createdId, restId, undo: [...(restId ? [{ op: 'deleteEvent' as const, id: restId }] : []), { op: 'deleteEvent' as const, id: createdId }] };
}

type Target = { id: string; write: EventWrite };

/** Is a class of this rule held on the date at the time (a moved-in date counts)? */
const heldBy = (t: Target, date: string, startTime: string): boolean =>
  expandOccurrences([asCalendarRow({ ...t.write, id: t.id })], [], date, date).some((o) => (o.status === 'scheduled' || o.status === 'override') && o.startTime === startTime);

/**
 * A session is keyed by its event (`eventId|date|time`). A split makes new events, so the saved sessions of `from` on that still match a class of a new event
 * move to it with a new key (nothing else would show them against their class, and a second save would bill the class twice). `before` was read before the old event could go.
 */
async function moveSessions(ctx: GroupContext, before: EventSession[], from: string, targets: Target[]): Promise<void> {
  for (const s of before.filter((x) => x.date >= from)) {
    const to = targets.find((t) => heldBy(t, s.date, s.startTime));
    if (to) await ctx.sessions.move(s.id, to.id, occurrenceKey(to.id, s.date, s.startTime));
  }
}

/** `day` is absent (the whole event) or a weekday key; anything else is invalid. */
const dayOf = (body: unknown): { ok: true; day: DayKey | null } | { ok: false } => {
  const raw = isRecord(body) ? body.day : undefined;
  if (raw === undefined || raw === null) return { ok: true, day: null };
  const day = readDayKey(raw);
  return day ? { ok: true, day } : { ok: false };
};

async function changeLocked(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const read = readSeriesInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const dayRead = dayOf(body);
  if (dayRead.ok === false) return refuse(400, GROUP_ERRORS.invalid);
  const day = dayRead.day;
  const found = await lockedSeries(ctx.store, eventId, read.value.from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  if (day && !e.recurrence.days.includes(day)) return refuse(400, GROUP_ERRORS.invalid);
  if (day && read.value.days.some((d) => e.recurrence.days.includes(d) && d !== day)) return refuse(400, GROUP_ERRORS.invalid);
  const plan = planDayChange(e, day, read.value, group.name);
  if (!plan.created) return refuse(409, GROUP_ERRORS.stale);
  const sessions = await ctx.sessions.ofEvent(e.id);
  const oldStep = await applyChange(ctx.store, e, plan.old);
  const steps = await createdSteps(ctx.store, plan.rest, plan.created);
  await moveSessions(ctx, sessions, read.value.from, [...(plan.rest && steps.restId ? [{ id: steps.restId, write: plan.rest }] : []), { id: steps.createdId, write: plan.created }]);
  const before = day ? { ...seriesText(series), days: [day] } : seriesText(series);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programChanged, changes: { from: read.value.from, before, after: inputText(read.value) } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [oldStep, ...steps.undo], revalidate: true });
  return done({ eventId: steps.createdId }, actionId);
}

/** PUT /club/program/:eventId: "Schimbă" from "Se aplică din" (W10). */
export async function changeProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] changing ${eventId}`, () => ctx.store.transaction(() => changeLocked(ctx, eventId, body))));
}

async function endLocked(ctx: GroupContext, eventId: string, from: string, day: DayKey | null): Promise<ActionResult<{ eventId: string }>> {
  const found = await lockedSeries(ctx.store, eventId, from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  if (day && !e.recurrence.days.includes(day)) return refuse(400, GROUP_ERRORS.invalid);
  const plan = planDayEnd(e, day, from);
  const sessions = await ctx.sessions.ofEvent(e.id);
  const step = await applyChange(ctx.store, e, plan.old);
  const restId = plan.rest ? await ctx.store.createEvent(plan.rest) : null;
  if (plan.rest && restId) await moveSessions(ctx, sessions, from, [{ id: restId, write: plan.rest }]);
  const shown = day ? { ...seriesText(series), days: [day] } : seriesText(series);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programEnded, changes: { from, series: shown } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [step, ...(restId ? [{ op: 'deleteEvent' as const, id: restId }] : [])], revalidate: true });
  return done({ eventId }, actionId);
}

/** POST /club/program/:eventId/end body `{ from }`: "Șterge programul" (W10). */
export async function endProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const from = isRecord(body) ? body.from : null;
  const dayRead = dayOf(body);
  if (!isIsoDate(from) || dayRead.ok === false) return refuse(400, GROUP_ERRORS.invalid);
  return pinged(ctx, await guarded(ctx.log, `[program] ending ${eventId}`, () => ctx.store.transaction(() => endLocked(ctx, eventId, from, dayRead.day))));
}

async function deleteLocked(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  const seen = await ctx.store.event(eventId);
  if (seen?.recurrence.freq === 'none' && seen.recurrence.singleDate) await lockSeasonOn(ctx.store, seen.recurrence.singleDate);
  const e = await lockedEvent(ctx.store, eventId);
  const date = e?.recurrence.freq === 'none' ? e.recurrence.singleDate : null;
  if (!e || !date || !e.groupId) return refuse(409, GROUP_ERRORS.stale);
  const placed = await placeOn(ctx.store, e.groupId, date);
  if (placed.ok === false) return placed;
  if ((await ctx.sessions.ofEvent(e.id)).length > 0) return refuse(409, GROUP_ERRORS.datePresence);
  await ctx.store.deleteEvent(e.id);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: e.groupId, action: P4_ACTIONS.classDeleted, changes: { date, startTime: e.recurrence.startTime } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [{ op: 'createEvent', event: eventSnapshot(e) }], revalidate: true });
  return done({ date }, actionId);
}

/** DELETE /club/program/:eventId: "Șterge ședința" of one class (W10). */
export async function deleteClass(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] deleting ${eventId}`, () => ctx.store.transaction(() => deleteLocked(ctx, eventId))));
}
