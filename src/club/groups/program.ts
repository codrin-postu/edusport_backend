import { guarded, refuse, type AdminResult } from '../admin-result';
import { isRecord } from '../narrow';
import { done, recordAction, type ActionResult, type Line } from './action-log';
import type { GroupContext } from './context';
import { GROUP_ERRORS } from './copy';
import { isIsoDate } from './dates';
import { GROUP_SUBJECT, P4_ACTIONS } from './history-lines';
import { classWrite, eventType, inputText, planChange, planEnd, readProgramInput, readSeriesInput, seasonOf, seriesWrite, type EventChange, type ProgramInput } from './program-plan';
import { isPastSeason } from './season-pick';
import { seasonBounds, seriesText, seriesView, type SeriesView } from './series';
import type { EventRecord, EventWrite, GroupRecord, GroupStore, SeasonRecord, SectionRecord } from './types';
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

function addedLine(groupId: string, input: ProgramInput): Line {
  if (input.repeat === true) return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.programAdded, changes: { series: inputText(input.series) } };
  const { date, startTime, durationMin } = input.one;
  return { subjectType: GROUP_SUBJECT, subjectId: groupId, action: P4_ACTIONS.classAdded, changes: { date, startTime, durationMin } };
}

async function addLocked(ctx: GroupContext, groupId: string, input: ProgramInput): Promise<ActionResult<{ eventId: string; date: string | null }>> {
  await ctx.store.lockGroup(groupId);
  const placed = await placeOn(ctx.store, groupId, input.repeat === true ? input.series.from : input.one.date);
  if (placed.ok === false) return placed;
  const { group, section, season } = placed.data;
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
async function lockedEvent(store: GroupStore, eventId: string): Promise<EventRecord | null> {
  const first = await store.event(eventId);
  if (!first?.groupId) return null;
  await store.lockGroup(first.groupId);
  await store.lockEvent(eventId);
  const e = await store.event(eventId);
  return e && e.groupId === first.groupId ? e : null;
}

/** The series locked and read again; `from` must fall inside it and in a season that is not past. */
async function lockedSeries(store: GroupStore, eventId: string, from: string): Promise<AdminResult<LockedSeries>> {
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

async function changeLocked(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const read = readSeriesInput(body);
  if (read.ok === false) return refuse(400, read.error);
  const found = await lockedSeries(ctx.store, eventId, read.value.from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  const plan = planChange(e, read.value, group.name);
  const oldStep = await applyChange(ctx.store, e, plan.old);
  const createdId = await ctx.store.createEvent(plan.created);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programChanged, changes: { from: read.value.from, before: seriesText(series), after: inputText(read.value) } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [oldStep, { op: 'deleteEvent', id: createdId }], revalidate: true });
  return done({ eventId: createdId }, actionId);
}

/** PUT /club/program/:eventId: "Schimbă" from "Se aplică din" (W10). */
export async function changeProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] changing ${eventId}`, () => ctx.store.transaction(() => changeLocked(ctx, eventId, body))));
}

async function endLocked(ctx: GroupContext, eventId: string, from: string): Promise<ActionResult<{ eventId: string }>> {
  const found = await lockedSeries(ctx.store, eventId, from);
  if (found.ok === false) return found;
  const { e, series, group } = found.data;
  const step = await applyChange(ctx.store, e, planEnd(e, from));
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: group.id, action: P4_ACTIONS.programEnded, changes: { from, series: seriesText(series) } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [step], revalidate: true });
  return done({ eventId }, actionId);
}

/** POST /club/program/:eventId/end body `{ from }`: "Șterge programul" (W10). */
export async function endProgram(ctx: GroupContext, eventId: string, body: unknown): Promise<ActionResult<{ eventId: string }>> {
  const from = isRecord(body) ? body.from : null;
  if (!isIsoDate(from)) return refuse(400, GROUP_ERRORS.invalid);
  return pinged(ctx, await guarded(ctx.log, `[program] ending ${eventId}`, () => ctx.store.transaction(() => endLocked(ctx, eventId, from))));
}

async function deleteLocked(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  const e = await lockedEvent(ctx.store, eventId);
  const date = e?.recurrence.freq === 'none' ? e.recurrence.singleDate : null;
  if (!e || !date || !e.groupId) return refuse(409, GROUP_ERRORS.stale);
  const placed = await placeOn(ctx.store, e.groupId, date);
  if (placed.ok === false) return placed;
  await ctx.store.deleteEvent(e.id);
  const line: Line = { subjectType: GROUP_SUBJECT, subjectId: e.groupId, action: P4_ACTIONS.classDeleted, changes: { date, startTime: e.recurrence.startTime } };
  const actionId = await recordAction(ctx.store, ctx.actor, [line], { kind: 'group', steps: [{ op: 'createEvent', event: eventSnapshot(e) }], revalidate: true });
  return done({ date }, actionId);
}

/** DELETE /club/program/:eventId: "Șterge ședința" of one class (W10). */
export async function deleteClass(ctx: GroupContext, eventId: string): Promise<ActionResult<{ date: string }>> {
  return pinged(ctx, await guarded(ctx.log, `[program] deleting ${eventId}`, () => ctx.store.transaction(() => deleteLocked(ctx, eventId))));
}
