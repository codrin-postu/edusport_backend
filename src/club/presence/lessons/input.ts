import { isIsoDate } from '../../groups/dates';
import { isRecord } from '../../narrow';
import { isDuration, isTime } from '../attendance/view';
import type { LessonBody, LessonPatch } from '../attendance/api-types';
import { DAY_ORDER } from '../../groups/program-text';
import type { LessonRepeat } from '../../portal/coach/api-types';

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

const FREQS = ['weekly', 'biweekly', 'monthly'] as const;
const WEEKS = ['first', 'second', 'third', 'fourth', 'last'] as const;

/** `repeat` of a lesson body: absent or null is `{ ok: true, value: null }` (one lesson); a malformed one is refused. Monthly without `weekOfMonth` is the first (as a group series). */
export function readLessonRepeat(body: unknown): { ok: true; value: LessonRepeat | null } | { ok: false } {
  const r = isRecord(body) ? body.repeat : undefined;
  if (r === undefined || r === null) return { ok: true, value: null };
  if (!isRecord(r)) return { ok: false };
  const freq = FREQS.find((f) => f === r.freq);
  const days = Array.isArray(r.days) ? DAY_ORDER.filter((d) => (r.days as unknown[]).includes(d)) : [];
  if (!freq || days.length === 0 || (r.until !== undefined && r.until !== null && !isIsoDate(r.until))) return { ok: false };
  const weekOfMonth = freq === 'monthly' ? (WEEKS.find((w) => w === r.weekOfMonth) ?? 'first') : null;
  return { ok: true, value: { freq, days: [...days], weekOfMonth, until: isIsoDate(r.until) ? r.until : null } };
}
