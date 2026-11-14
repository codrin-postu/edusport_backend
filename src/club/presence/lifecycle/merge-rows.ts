import type { PresenceStore } from '../store';
import { planAttendanceMerge } from './merge-plan';

const byId = (a: { id: string }, b: { id: string }): number => a.id.localeCompare(b.id);

async function ofBoth<T extends { id: string }>(read: (athleteId: string) => Promise<T[]>, keptId: string, removedId: string): Promise<T[]> {
  return [...(await read(keptId)), ...(await read(removedId))].sort(byId);
}

/** Locks lesson series, lessons, subscriptions, payments of both athletes (each sorted), then applies the plan (remove before update) and moves every lesson, lesson cancellation, subscription and payment. */
export async function mergePresenceRows(presence: PresenceStore, keptId: string, removedId: string): Promise<void> {
  const series = await ofBoth((athleteId) => presence.lessonSeriesOf(athleteId), keptId, removedId);
  const lessons = await ofBoth((athleteId) => presence.lessons({ athleteId }), keptId, removedId);
  const subscriptions = await ofBoth((athleteId) => presence.subscriptions({ athleteId }), keptId, removedId);
  const payments = await ofBoth((athleteId) => presence.payments({ athleteId }), keptId, removedId);
  for (const s of series) await presence.lockLessonSeries(s.id);
  for (const l of lessons) await presence.lockLesson(l.id);
  for (const s of subscriptions) await presence.lockSubscription(s.id);
  for (const p of payments) await presence.lockPayment(p.id);
  const plan = planAttendanceMerge(await presence.attendances({ athleteId: keptId }), await presence.attendances({ athleteId: removedId }), keptId);
  for (const id of plan.remove) await presence.deleteAttendance(id);
  for (const u of plan.update) await presence.updateAttendance(u.id, u.data);
  for (const s of series.filter((x) => x.athleteId === removedId)) await presence.updateLessonSeries(s.id, { athleteId: keptId });
  for (const l of lessons.filter((x) => x.athleteId === removedId)) await presence.updateLesson(l.id, { athleteId: keptId });
  for (const s of subscriptions.filter((x) => x.athleteId === removedId)) await presence.updateSubscription(s.id, { athleteId: keptId });
  for (const p of payments.filter((x) => x.athleteId === removedId)) await presence.updatePayment(p.id, { athleteId: keptId });
  await moveLessonCancels(presence, keptId, removedId);
}

/** The removed athlete's lesson cancellations go to the kept one (a slot he already has is not doubled). */
async function moveLessonCancels(presence: PresenceStore, keptId: string, removedId: string): Promise<void> {
  for (const x of await presence.lessonCancels({ athleteId: removedId, from: '0000-01-01', to: '9999-12-31' })) await presence.recordLessonCancel({ athleteId: keptId, ...x });
  await presence.dropLessonCancels(removedId);
}
