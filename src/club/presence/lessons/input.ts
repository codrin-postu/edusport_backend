import { isIsoDate } from '../../groups/dates';
import { isRecord } from '../../narrow';
import { isDuration, isTime } from '../attendance/view';
import type { LessonBody, LessonPatch } from '../attendance/api-types';

const readCoachIds = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '') ? [...new Set(v as string[])] : null;

/** A new lesson as sent by the window, or null when a field is missing or malformed. An empty coach list is read; the writer refuses it. */
export function readLessonBody(body: unknown): LessonBody | null {
  if (!isRecord(body)) return null;
  const { athleteId, date, startTime, durationMin } = body;
  const coachIds = readCoachIds(body.coachIds);
  if (typeof athleteId !== 'string' || athleteId === '' || !isIsoDate(date) || !isTime(startTime) || !isDuration(durationMin) || !coachIds) return null;
  return { athleteId, date, startTime, durationMin, coachIds };
}

/** The panel's save: the tick, the duration and the coaches. */
export function readLessonPatch(body: unknown): LessonPatch | null {
  if (!isRecord(body)) return null;
  const coachIds = readCoachIds(body.coachIds);
  if (typeof body.present !== 'boolean' || !isDuration(body.durationMin) || !coachIds) return null;
  return { present: body.present, durationMin: body.durationMin, coachIds };
}
