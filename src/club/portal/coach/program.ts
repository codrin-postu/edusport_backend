import { refuse, type AdminResult } from '../../admin-result';
import type { ActionResult } from '../../groups/action-log';
import { isIsoDate } from '../../groups/dates';
import { classDates } from '../../groups/program-plan';
import { DAY_ORDER } from '../../groups/program-text';
import { seasonBounds } from '../../groups/series';
import type { EventRecord } from '../../groups/types';
import { setProgramPublic } from '../../groups/group-admin';
import { adminWindow } from '../../groups/occurrences';
import { addProgram, changeProgram, deleteClass, endProgram } from '../../groups/program';
import { setDate, type DateAnswer } from '../../groups/program-dates';
import { readGroupProgram } from '../../groups/program-read';
import { isRecord } from '../../narrow';
import { isMonth, monthRange } from '../../presence/dates';
import { PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import { canCoachCorrect } from '../window';
import type { CoachProgram, CoachProgramRule, SectionKind } from './api-types';
import { forbidden, type CoachContexts, type CoachResult } from './context';
import { groupAccess } from './ownership';
import { programRight } from './rules';

/** The coach's Program tab and its writes (spec 9.8, 9.9): the phase 4 services with the coach actor, same lines, e-mails and website ping. Answers drop `undo`. */
const plain = <T>(r: ActionResult<T>): AdminResult<T> => (r.ok === false ? r : { ok: true, data: r.data.value });

type Found = { groupId: string; kind: SectionKind; right: { read: boolean; write: boolean }; own: boolean; programPublic: boolean };

async function found(c: CoachContexts, groupId: string): Promise<Found | null> {
  const [group, sections] = await Promise.all([c.groups.store.group(groupId), c.groups.store.sections()]);
  if (!group) return null;
  const kind: SectionKind = sections.find((s) => s.id === group.sectionId)?.kind ?? 'school';
  const access = groupAccess(group, c.coach.teamMemberId);
  return { groupId, kind, right: programRight(access, kind), own: access === 'own', programPublic: group.programPublic };
}

/** The group of an event, none when the event is gone or has no group. */
async function groupOfEvent(c: CoachContexts, eventId: string): Promise<Found | null> {
  const e = await c.groups.store.event(eventId);
  return e?.groupId ? found(c, e.groupId) : null;
}

/** A date the body names that is earlier than today: past dates are read only. */
const inPast = (c: CoachContexts, ...dates: unknown[]): boolean => dates.some((d) => isIsoDate(d) && d < c.today);

/** A class added for a past date: only a one-off one, and only inside the correction window (the same one as the presence). */
const oneOffTooOld = (c: CoachContexts, body: unknown): boolean => {
  const date = put(body, 'date');
  return !isIsoDate(date) || !canCoachCorrect(date, c.today);
};

const put = (body: unknown, key: string): unknown => (isRecord(body) ? body[key] : undefined);

async function writeRight(c: CoachContexts, g: Found | null): Promise<CoachResult<never> | null> {
  if (!g) return refuse(404, PORTAL_ERRORS.notFound);
  return g.right.write ? null : forbidden(PORTAL_ERRORS.noAccess);
}

/** The series split per weekday, Monday first then start time; `nextDate` is the weekday's first class date from today on. */
function rulesOf(program: NonNullable<Awaited<ReturnType<typeof readGroupProgram>>>, events: EventRecord[], seasonEnd: string | null, today: string): CoachProgramRule[] {
  const rules = program.series.flatMap((row) => {
    const e = events.find((x) => x.id === row.eventId);
    return row.days.map((day): CoachProgramRule => {
      const from = today > row.from ? today : row.from;
      const nextDate = e ? classDates({ ...e, recurrence: { ...e.recurrence, days: [day] } }, from, row.to)[0] ?? null : null;
      return {
        eventId: row.eventId, day, freq: row.freq, weekOfMonth: row.weekOfMonth, startTime: row.startTime, durationMin: row.durationMin,
        from: row.from, to: row.to, untilSeasonEnd: row.to === seasonEnd, nextDate,
      };
    });
  });
  return rules.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));
}

export async function readCoachProgram(c: CoachContexts, groupId: string, month: unknown): Promise<AdminResult<CoachProgram>> {
  if (!isMonth(month)) return refuse(400, PORTAL_ERRORS.invalid);
  const g = await found(c, groupId);
  if (!g || !g.right.read) return refuse(404, PORTAL_ERRORS.notFound);
  const [program, window, seasons, events] = await Promise.all([
    readGroupProgram(c.groups.store, groupId, null, c.today), c.presence.store.calendarWindow(), c.groups.store.seasons(), c.groups.store.events({ groupId }),
  ]);
  if (!program) return refuse(404, PORTAL_ERRORS.notFound);
  const season = seasons.find((s) => s.id === program.season?.documentId);
  const rules = rulesOf(program, events, season ? seasonBounds(season).end : null, c.today);
  const { data: all } = adminWindow(window, monthRange(month), groupId);
  const data = g.own ? all : all.map((o) => ({ ...o, description: null }));
  return { ok: true, data: { kind: g.kind, editable: g.right.write, programPublic: g.own && g.kind === 'club' ? g.programPublic : null, program, rules, occurrences: data } };
}

export async function coachAddProgram(c: CoachContexts, groupId: string, body: unknown): Promise<CoachResult<{ eventId: string; date: string | null }>> {
  const g = await found(c, groupId);
  const refusal = await writeRight(c, g);
  if (refusal) return refusal;
  const tooOld = put(body, 'repeat') === false ? oneOffTooOld(c, body) : inPast(c, put(body, 'from'), put(body, 'until'));
  if (tooOld) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await addProgram(c.groups, groupId, body));
}

export async function coachChangeProgram(c: CoachContexts, eventId: string, body: unknown): Promise<CoachResult<{ eventId: string }>> {
  const refusal = await writeRight(c, await groupOfEvent(c, eventId));
  if (refusal) return refusal;
  if (inPast(c, put(body, 'from'))) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await changeProgram(c.groups, eventId, body));
}

export async function coachEndProgram(c: CoachContexts, eventId: string, body: unknown): Promise<CoachResult<{ eventId: string }>> {
  const refusal = await writeRight(c, await groupOfEvent(c, eventId));
  if (refusal) return refusal;
  if (inPast(c, put(body, 'from'))) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await endProgram(c.groups, eventId, body));
}

export async function coachDeleteClass(c: CoachContexts, eventId: string): Promise<CoachResult<{ date: string }>> {
  const refusal = await writeRight(c, await groupOfEvent(c, eventId));
  if (refusal) return refusal;
  const e = await c.groups.store.event(eventId);
  if (inPast(c, e?.recurrence.singleDate)) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await deleteClass(c.groups, eventId));
}

export async function coachSetDate(c: CoachContexts, eventId: string, date: string, body: unknown): Promise<CoachResult<DateAnswer>> {
  const refusal = await writeRight(c, await groupOfEvent(c, eventId));
  if (refusal) return refusal;
  if (inPast(c, date, put(body, 'newDate'))) return refuse(400, PORTAL_ERRORS.invalid);
  return plain(await setDate(c.groups, eventId, date, body));
}

/** "Program public": the coach's own Club group only (spec 9.9). */
export async function coachProgramPublic(c: CoachContexts, groupId: string, body: unknown): Promise<CoachResult<{ toast: string }>> {
  const g = await found(c, groupId);
  if (!g) return refuse(404, PORTAL_ERRORS.notFound);
  if (!g.own || g.kind !== 'club') return forbidden(PORTAL_ERRORS.noAccess);
  const value = put(body, 'value');
  if (typeof value !== 'boolean') return refuse(400, PORTAL_ERRORS.invalid);
  const res = await setProgramPublic(c.groups, groupId, value);
  return res.ok === false ? res : { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}
