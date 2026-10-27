import type { PresenceStore } from '../store';

export type DeleteBlock = { payments: number; subscriptions: number };

/** Counts every payment and subscription of the athlete, cancelled ones too (C37); null when both are 0. */
export async function deleteBlockOf(presence: PresenceStore, athleteId: string): Promise<DeleteBlock | null> {
  const [payments, subscriptions] = await Promise.all([presence.payments({ athleteId }), presence.subscriptions({ athleteId })]);
  return payments.length === 0 && subscriptions.length === 0 ? null : { payments: payments.length, subscriptions: subscriptions.length };
}

/** Payments, abonamente, attendances and lessons of the athlete: any of them counts as use (confirmation undo). */
export async function useCountOf(presence: PresenceStore, athleteId: string): Promise<number> {
  const [block, attendances, lessons] = await Promise.all([deleteBlockOf(presence, athleteId), presence.attendances({ athleteId }), presence.lessons({ athleteId })]);
  return (block ? block.payments + block.subscriptions : 0) + attendances.length + lessons.length;
}

/** Locks the athlete's lessons (sorted), then deletes its lessons and attendance rows; sessions stay. */
export async function removePresenceRows(presence: PresenceStore, athleteId: string): Promise<void> {
  const lessons = (await presence.lessons({ athleteId })).sort((a, b) => a.id.localeCompare(b.id));
  for (const l of lessons) await presence.lockLesson(l.id);
  const attendances = (await presence.attendances({ athleteId })).sort((a, b) => a.id.localeCompare(b.id));
  for (const a of attendances) await presence.lockAttendance(a.id);
  for (const a of attendances) await presence.deleteAttendance(a.id);
  for (const l of lessons) await presence.deleteLesson(l.id);
}
