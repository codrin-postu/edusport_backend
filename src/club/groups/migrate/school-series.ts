import { isRecord } from '../../narrow';
import { nameKey } from '../../migrate/names';
import { addMinutes } from '../dates';
import { DAY_ORDER, type SeriesText } from '../program-text';
import { groupSeries, overlapsSeason, seasonBounds } from '../series';
import type { DayKey, EventRecord, EventWrite, ExceptionRow, GroupRecord, SeasonRecord, SectionRecord } from '../types';

/** Step 4 (spec 4, W14): one weekly series per Școala group from today's notebook (`program.scheduleGroups`). Pure. */
export type Slot = { timeSlot: string; courses: string[] };
export type SchoolSeriesInput = { slots: unknown; groups: GroupRecord[]; sections: SectionRecord[]; events: EventRecord[]; season: SeasonRecord };
export type PlannedSchoolSeries = { groupId: string; groupName: string; write: EventWrite; text: SeriesText };
export type SchoolSeriesPlan = {
  create: PlannedSchoolSeries[]; unmatched: string[]; unreadSlots: string[]; skipped: string[]; days: DayKey[]; from: string; to: string;
  exceptions: ExceptionRow[]; leftCancels: string[];
};

const MINUTES = 50;
const WEEKEND: DayKey[] = ['sat', 'sun'];

export function readSlots(v: unknown): Slot[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord).map((s) => ({ timeSlot: typeof s.timeSlot === 'string' ? s.timeSlot : '', courses: Array.isArray(s.courses) ? s.courses.filter((c): c is string => typeof c === 'string') : [] }));
}

/** Decided 6: the first "HH:mm" (also "H:mm", "HH.mm") of the slot text. */
export function slotStart(timeSlot: string): string | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(timeSlot);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** The unlinked weekly Școala series whose window overlaps the season (production: the 2026-2027 weekends). */
export const oldScoalaSeries = (events: EventRecord[], season: SeasonRecord): EventRecord[] =>
  events.filter((e) => !e.groupId && e.type === 'scoala' && e.recurrence.freq !== 'none' && overlapsSeason({ from: e.recurrence.seasonStart ?? '', to: e.recurrence.seasonEnd ?? '' }, season));

function windowOf(old: EventRecord[], season: SeasonRecord): { from: string; to: string } {
  const b = seasonBounds(season);
  const earliest = old.map((e) => e.recurrence.seasonStart ?? b.start).sort()[0] ?? b.start;
  return { from: earliest > b.start ? earliest : b.start, to: b.end };
}

/** W14: the Liber and Anulat dates of the old series inside the window, the note as `reason`; `cancel` left (decided 7). */
function copiedExceptions(old: EventRecord[], from: string, to: string): { exceptions: ExceptionRow[]; leftCancels: string[] } {
  const inside = old.flatMap((e) => e.exceptions).filter((x) => x.date >= from && x.date <= to);
  const exceptions = inside
    .filter((x) => x.kind === 'liber' || x.kind === 'anulat')
    .filter((x, i, all) => all.findIndex((y) => y.date === x.date) === i)
    .map((x): ExceptionRow => ({ date: x.date, kind: x.kind, newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: x.reason ?? x.newTitle }));
  return { exceptions, leftCancels: inside.filter((x) => x.kind === 'cancel').map((x) => x.date) };
}

type Context = { schoolGroups: GroupRecord[]; events: EventRecord[]; season: SeasonRecord; days: DayKey[]; from: string; to: string; exceptions: ExceptionRow[] };

function seriesFor(c: Context, g: GroupRecord, start: string): PlannedSchoolSeries {
  const write: EventWrite = {
    title: g.name, type: 'scoala', description: null, groupId: g.id, exceptions: c.exceptions,
    recurrence: { freq: 'weekly', days: c.days, weekOfMonth: null, startTime: start, endTime: addMinutes(start, MINUTES), singleDate: null, seasonStart: c.from, seasonEnd: c.to },
  };
  return { groupId: g.id, groupName: g.name, write, text: { freq: 'weekly', days: c.days, startTime: start, durationMin: MINUTES, from: c.from } };
}

function slotPlan(c: Context, slot: Slot, plan: SchoolSeriesPlan, planned: Set<string>): void {
  const start = slotStart(slot.timeSlot);
  if (!start) return void plan.unreadSlots.push(slot.timeSlot);
  for (const course of slot.courses) {
    const hits = c.schoolGroups.filter((g) => nameKey(g.name) === nameKey(course));
    if (hits.length !== 1) plan.unmatched.push(course);
    else if (groupSeries(c.events, hits[0].id, c.season).length) plan.skipped.push(hits[0].name);
    else if (!planned.has(hits[0].id)) {
      planned.add(hits[0].id);
      plan.create.push(seriesFor(c, hits[0], start));
    }
  }
}

export function planSchoolSeries(input: SchoolSeriesInput): SchoolSeriesPlan {
  const schools = new Set(input.sections.filter((s) => s.kind === 'school').map((s) => s.id));
  const old = oldScoalaSeries(input.events, input.season);
  const found = new Set(old.flatMap((e) => e.recurrence.days));
  const days = DAY_ORDER.filter((d) => found.has(d));
  const { from, to } = windowOf(old, input.season);
  const { exceptions, leftCancels } = copiedExceptions(old, from, to);
  const c: Context = {
    schoolGroups: input.groups.filter((g) => schools.has(g.sectionId ?? '')), events: input.events, season: input.season, days: days.length ? days : WEEKEND, from, to, exceptions,
  };
  const plan: SchoolSeriesPlan = { create: [], unmatched: [], unreadSlots: [], skipped: [], days: c.days, from, to, exceptions, leftCancels };
  const planned = new Set<string>();
  for (const slot of readSlots(input.slots)) slotPlan(c, slot, plan, planned);
  return plan;
}
