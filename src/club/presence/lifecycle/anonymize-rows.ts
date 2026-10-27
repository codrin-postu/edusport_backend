import { scrubChanges } from '../../personal-data/anonymize-plan';
import { isRecord } from '../../narrow';
import type { PresenceStore } from '../store';

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
