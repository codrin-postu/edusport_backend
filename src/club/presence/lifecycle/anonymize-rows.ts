import { scrubChanges } from '../../personal-data/anonymize-plan';
import { isRecord } from '../../narrow';
import type { PresenceStore } from '../store';
import { isDeletable } from '../lessons/read';

/** `scrubChanges`, plus `fields.note` of a payment-edited line becomes { from: null, to: null } (decided 7). */
export function scrubPaymentChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = scrubChanges(changes);
  const fields = scrubbed.fields;
  if (!isRecord(fields) || !('note' in fields)) return scrubbed;
  return { ...scrubbed, fields: { ...fields, note: { from: null, to: null } } };
}

/** Locks the athlete's payments (sorted), sets `note` null where set; answers every payment id of the athlete. */
export async function clearPaymentNotes(presence: PresenceStore, athleteId: string): Promise<string[]> {
  const payments = (await presence.payments({ athleteId })).sort((a, b) => a.id.localeCompare(b.id));
  for (const p of payments) await presence.lockPayment(p.id);
  for (const p of payments.filter((x) => x.note !== null)) await presence.updatePayment(p.id, { note: null });
  return payments.map((p) => p.id);
}

/**
 * The athlete's lesson series go, and so do its planned lessons from `today` on that no payment points at (they would keep showing for the rest of the season);
 * lessons already saved or paid stay with the athlete's other history. Locks the series, then the lessons (athlete locked by the caller). Answers the lesson ids removed.
 */
export async function dropFutureLessons(presence: PresenceStore, athleteId: string, today: string): Promise<string[]> {
  const series = (await presence.lessonSeriesOf(athleteId)).sort((a, b) => a.id.localeCompare(b.id));
  for (const s of series) await presence.lockLessonSeries(s.id);
  const future = (await presence.lessons({ athleteId, from: today })).filter((l) => l.state === 'planned').sort((a, b) => a.id.localeCompare(b.id));
  for (const l of future) await presence.lockLesson(l.id);
  const gone: string[] = [];
  for (const l of future) {
    if (await isDeletable(presence, l.id)) {
      await presence.deleteLesson(l.id);
      gone.push(l.id);
    }
  }
  for (const s of series) await presence.deleteLessonSeries(s.id);
  return gone;
}
