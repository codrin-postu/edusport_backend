import { HISTORY_ACTIONS } from '../../history-text';
import type { AdminResult } from '../../admin-result';
import { normalizeEmail } from '../limits';
import type { AccessContext } from './context';
import { linkAccess } from './invite';
import type { RevokeReason } from './types';

/** The queued mails of the move, to release after the outermost commit. */
export type Move = { jobIds: string[] };

async function revokeLive(c: AccessContext, rowId: string, reason: RevokeReason): Promise<void> {
  await c.access.revokeAccess(rowId, { revokedAt: c.now().toISOString(), revokedBy: c.actor, revokeReason: reason });
}

/**
 * The athlete e-mail changed (spec 4.4), inside the caller's transaction and before the new value is written: a live access ends and, for a
 * non empty new e-mail, the invite outcome runs for it. An athlete without a live access is left alone (no invite on a plain edit). A refusal
 * (the new address belongs to a disabled account) is returned with nothing written, so the caller refuses the edit.
 */
export async function moveOnEmailChange(c: AccessContext, athleteId: string, before: string | null, after: string | null): Promise<AdminResult<Move>> {
  const [from, to] = [normalizeEmail(before), normalizeEmail(after)];
  if (from === to) return { ok: true, data: { jobIds: [] } };
  return c.store.transaction(async (): Promise<AdminResult<Move>> => {
    await c.access.lockAthlete(athleteId);
    const live = await c.access.liveByAthlete(athleteId);
    if (!live) return { ok: true, data: { jobIds: [] } };
    if (to === null) {
      await revokeLive(c, live.id, 'email_schimbat');
      await c.access.recordAthlete({ athleteId, action: HISTORY_ACTIONS.accessRemoved, changes: { email: live.email }, actor: c.actor });
      return { ok: true, data: { jobIds: [] } };
    }
    const linked = await linkAccess(c, athleteId, to, { moved: true });
    if (linked.ok === false) return linked;
    return { ok: true, data: { jobIds: linked.data.jobId ? [linked.data.jobId] : [] } };
  });
}

/** Anonymize or delete: the live access ends in the caller's transaction (the delete writes no athlete line, the record goes). */
export async function endForAthlete(c: AccessContext, athleteId: string, reason: 'anonimizat' | 'sters'): Promise<void> {
  await c.store.transaction(async () => {
    await c.access.lockAthlete(athleteId);
    const live = await c.access.liveByAthlete(athleteId);
    if (!live) return;
    await revokeLive(c, live.id, reason);
    if (reason === 'anonimizat') await c.access.recordAthlete({ athleteId, action: HISTORY_ACTIONS.accessStopped, changes: {}, actor: c.actor });
  });
}

/**
 * Merge (spec 4.5): the removed athlete's live access moves to the kept one when the kept one has none and the kept e-mail equals the access
 * e-mail; otherwise it ends with `unit`. The kept athlete's own access stays.
 */
export async function moveOnMerge(c: AccessContext, keptId: string, removedId: string, keptEmail: string | null): Promise<void> {
  await c.store.transaction(async () => {
    const live = await c.access.liveByAthlete(removedId);
    if (!live) return;
    const keeps = (await c.access.liveByAthlete(keptId)) === null && normalizeEmail(keptEmail) === live.email;
    if (!keeps) return revokeLive(c, live.id, 'unit');
    await c.access.moveAccess(live.id, keptId);
    await c.access.recordAthlete({ athleteId: keptId, action: HISTORY_ACTIONS.accessAdded, changes: { email: live.email }, actor: c.actor });
  });
}

