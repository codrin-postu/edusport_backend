import { addDays } from '../../groups/dates';
import type { Line } from '../../groups/action-log';
import { SUBJECT } from '../../subjects';
import type { PresenceContext } from '../context';
import { P5_ACTIONS } from '../history-lines';
import type { PresenceUndoStep } from '../undo';
import type { LessonRow, LessonSeriesRow, LessonSeriesWrite, LessonWrite } from '../types';
import { isDeletable } from './read';

/** Every stored field of the lesson, the row an undo puts back. */
export const lessonWriteOf = ({ id: _id, ...fields }: LessonRow): LessonWrite => ({ ...fields, coachIds: [...fields.coachIds] });
export const seriesWriteOf = ({ id: _id, ...fields }: LessonSeriesRow): LessonSeriesWrite => ({ ...fields, coachIds: [...fields.coachIds], days: [...fields.days] });

export type Cut = {
  /** The rows removed (planned, nothing paid on them, listing the coach when one is named), by id. */
  deleted: LessonRow[];
  /** `lessonDeleted` per row, then `lessonSeriesEnded` on the athlete. */
  lines: Line[];
  /** The inverse of the cut, to sit first in the action's steps (applied last). */
  steps: PresenceUndoStep[];
  /** Series rows the cut wrote or ended: the undo is refused when any of them changed since. */
  touched: string[];
};

const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id);
const byDate = (a: LessonRow, b: LessonRow): number => a.date.localeCompare(b.date) || byId(a, b);

/** What a cut will remove, read and locked but not yet written: a refusal after the first write would still commit, so every check runs on this. */
export type CutPlan = { from: LessonRow; series: LessonSeriesRow; deleted: LessonRow[]; before: LessonRow[]; kept: LessonRow[] };

/**
 * "This lesson and the ones that follow" of a series, first half: with the athlete locked, locks the series, then the rows of the series dated on or after
 * the lesson (by id), and picks those that are planned and unpaid (a saved or paid one stays), and, with `listedFor`, that list that coach (another coach's row stays).
 * Writes nothing.
 */
export async function planCut(ctx: PresenceContext, from: LessonRow, series: LessonSeriesRow, listedFor: string | null = null): Promise<CutPlan> {
  const { store } = ctx;
  await store.lockLessonSeries(series.id);
  const all = await store.lessons({ seriesId: series.id });
  const inRange = all.filter((l) => l.date >= from.date).sort(byId);
  for (const l of inRange) await store.lockLesson(l.id);
  const rows = (await store.lessons({ seriesId: series.id })).sort(byDate);
  const deleted: LessonRow[] = [];
  for (const l of rows) {
    if (l.date >= from.date && l.state === 'planned' && (listedFor === null || l.coachIds.includes(listedFor)) && (await isDeletable(store, l.id))) deleted.push(l);
  }
  const gone = new Set(deleted.map((l) => l.id));
  return { from, series, deleted, before: rows.filter((l) => l.date < from.date), kept: rows.filter((l) => l.date >= from.date && !gone.has(l.id)) };
}

/**
 * Second half: deletes the picked rows. The rows that stay after the cut (saved, paid or another coach's) move to a tail series with the same rule, so the old
 * series ends the day before without covering them; the old series is deleted when no row is left before the cut. The end never moves later and never before its start.
 */
export async function applyCut(ctx: PresenceContext, p: CutPlan): Promise<Cut> {
  const { store } = ctx;
  const { from, series, deleted, before, kept } = p;
  for (const l of deleted) await store.deleteLesson(l.id);
  let tailId: string | null = null;
  if (kept.length > 0) {
    const last = kept[kept.length - 1].date;
    tailId = await store.createLessonSeries({ ...seriesWriteOf(series), from: kept[0].date, to: last > series.to ? last : series.to });
    for (const k of kept) await store.updateLesson(k.id, { seriesId: tailId });
  }
  if (before.length === 0) await store.deleteLessonSeries(series.id);
  else {
    const end = addDays(from.date, -1);
    await store.updateLessonSeries(series.id, { to: end < series.to ? end : series.to });
  }
  const head: PresenceUndoStep[] = before.length === 0
    ? [{ op: 'createLessonSeries', row: seriesWriteOf(series), lessonIds: [...deleted.map((l) => l.id), ...kept.map((l) => l.id)] }]
    : [{ op: 'setLessonSeries', id: series.id, to: series.to }, ...kept.map((k): PresenceUndoStep => ({ op: 'setLesson', id: k.id, values: { seriesId: series.id } }))];
  const back: PresenceUndoStep[] = deleted.map((l) => ({ op: 'createLesson', row: { ...lessonWriteOf(l), seriesId: before.length === 0 ? null : series.id }, was: l.id }));
  const lines: Line[] = [
    ...deleted.map((l): Line => ({ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonDeleted })),
    {
      subjectType: SUBJECT.athlete, subjectId: series.athleteId, action: P5_ACTIONS.lessonSeriesEnded,
      changes: { endedFrom: from.date, freq: series.freq, days: series.days, startTime: series.startTime, durationMin: series.durationMin },
    },
  ];
  return { deleted, lines, steps: [...head, ...back, ...(tailId ? [{ op: 'deleteLessonSeries' as const, id: tailId }] : [])], touched: [series.id, ...(tailId ? [tailId] : [])] };
}
