import { refuse, type AdminResult } from '../../admin-result';
import { givePin, recipients } from '../../parcurs/grants';
import type { SportivContext } from './context';

export type PinRecipient = { id: string; name: string };

/** The friends an athlete may give a pin to: every other active athlete, by short name. */
export const readPinRecipients = (c: SportivContext, athleteId: string): Promise<PinRecipient[]> => recipients(c.club.store, athleteId);

const STATUS = { SELF: 400, BAD_RECIPIENT: 400, BAD_DESIGN: 400, NO_PINS_LEFT: 409 } as const;

/** A friendship pin from the athlete (the holder holds it) to another; a refusal answers its code as the message. */
export async function givePinFrom(c: SportivContext, athleteId: string, body: unknown): Promise<AdminResult<{ id: string }>> {
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const recipientId = typeof raw.recipientId === 'string' ? raw.recipientId : '';
  const design = typeof raw.design === 'number' ? raw.design : 0;
  const activeIds = new Set((await recipients(c.club.store, athleteId)).map((r) => r.id));
  const given = await givePin(c.parcurs, { giverId: athleteId, recipientId, design, today: c.today, activeIds });
  return given.ok === true ? { ok: true, data: { id: given.id } } : refuse(STATUS[given.code], given.code);
}
