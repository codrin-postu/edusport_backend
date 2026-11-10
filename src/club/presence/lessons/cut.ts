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
  /** The rows removed (planned, nothing paid on them), by id. */
  deleted: LessonRow[];
  /** `lessonDeleted` per row, then `lessonSeriesEnded` on the athlete. */
  lines: Line[];
  /** The inverse of the cut, to sit first in the action's steps (applied last): the series end put back, then the rows. */
  steps: PresenceUndoStep[];
};

const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id);

/** What a cut will remove, read and locked but not yet written: a refusal after the first write would still commit, so every check runs on this. */
export type CutPlan = { from: LessonRow; series: LessonSeriesRow; deleted: LessonRow[]; left: number };

/**
 * "This lesson and the ones that follow" of a series, first half: with the athlete locked, locks the series, then the rows of the series dated on or after
 * the lesson (by id), and picks those that are planned and unpaid (a saved or paid one stays). Writes nothing.
 */
export async function planCut(ctx: PresenceContext, from: LessonRow, series: LessonSeriesRow): Promise<CutPlan> {
  const { store } = ctx;
  await store.lockLessonSeries(series.id);
  const all = await store.lessons({ seriesId: series.id });
  const inRange = all.filter((l) => l.date >= from.date).sort(byId);
  for (const l of inRange) await store.lockLesson(l.id);
  const rows = (await store.lessons({ seriesId: series.id, ids: inRange.map((l) => l.id) })).sort(byId);
  const deleted: LessonRow[] = [];
  for (const l of rows) if (l.state === 'planned' && (await isDeletable(store, l.id))) deleted.push(l);
  return { from, series, deleted, left: (await store.lessons({ seriesId: series.id })).length - deleted.length };
}

/** Second half: deletes the picked rows and ends the series the day before (or deletes it when no row is left). */
export async function applyCut(ctx: PresenceContext, p: CutPlan): Promise<Cut> {
  const { store } = ctx;
  const { from, series, deleted, left } = p;
  for (const l of deleted) await store.deleteLesson(l.id);
  if (left === 0) await store.deleteLessonSeries(series.id);
  else await store.updateLessonSeries(series.id, { to: addDays(from.date, -1) });
  const back: PresenceUndoStep[] = deleted.map((l) => ({ op: 'createLesson', row: { ...lessonWriteOf(l), seriesId: left === 0 ? null : series.id }, was: l.id }));
  const end: PresenceUndoStep = left === 0
    ? { op: 'createLessonSeries', row: seriesWriteOf(series), lessonIds: deleted.map((l) => l.id) }
    : { op: 'setLessonSeries', id: series.id, to: series.to };
  const lines: Line[] = [
    ...deleted.map((l): Line => ({ subjectType: SUBJECT.lesson, subjectId: l.id, action: P5_ACTIONS.lessonDeleted })),
    {
      subjectType: SUBJECT.athlete, subjectId: series.athleteId, action: P5_ACTIONS.lessonSeriesEnded,
      changes: { endedFrom: from.date, freq: series.freq, days: series.days, startTime: series.startTime, durationMin: series.durationMin },
    },
  ];
  return { deleted, lines, steps: [end, ...back] };
}
