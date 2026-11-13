import { HISTORY_ACTIONS } from '../../history-text';
import type { AdminResult } from '../../admin-result';
import { normalizeEmail } from '../limits';
import type { AccessContext } from './context';
import { linkAccess } from './invite';
import type { AccessRow, RevokeReason } from './types';

/** The queued mails of the move, to release after the outermost commit. */
export type Move = { jobIds: string[] };
const NONE: AdminResult<Move> = { ok: true, data: { jobIds: [] } };

/** Lock order athlete (the caller's), then the holder account, then the revoke. */
async function revokeLive(c: AccessContext, row: AccessRow, reason: RevokeReason): Promise<void> {
  await c.store.lockAccount(row.accountId);
  await c.access.revokeAccess(row.id, { revokedAt: c.now().toISOString(), revokedBy: c.actor, revokeReason: reason });
}

/**
 * The athlete e-mail changed (spec 4.4), inside the caller's transaction and before the new value is written: a live access ends and, for a
 * non empty new e-mail, the invite outcome runs for it. An athlete without a live access is left alone (no invite on a plain edit), and so is
 * one whose access already belongs to the new address. A refusal (the new address belongs to a disabled account) is returned with nothing
 * written, so the caller refuses the edit. Every path that writes or restores an athlete e-mail (edit, confirm, undo) calls this.
 */
export async function moveOnEmailChange(c: AccessContext, athleteId: string, before: string | null, after: string | null): Promise<AdminResult<Move>> {
  const [from, to] = [normalizeEmail(before), normalizeEmail(after)];
  if (from === to) return NONE;
  return c.store.transaction(async (): Promise<AdminResult<Move>> => {
    await c.access.lockAthlete(athleteId);
    const live = await c.access.liveByAthlete(athleteId);
    if (!live || live.email === to) return NONE;
    if (to === null) {
      await revokeLive(c, live, 'email_schimbat');
      await c.access.recordAthlete({ athleteId, action: HISTORY_ACTIONS.accessRemoved, changes: { email: live.email }, actor: c.actor });
      return NONE;
    }
    const linked = await linkAccess(c, athleteId, to, { moved: true });
    if (linked.ok === false) return linked;
    return { ok: true, data: { jobIds: linked.data.jobId ? [linked.data.jobId] : [] } };
  });
}

/**
 * The athlete goes (delete, undo of a created athlete) or is anonymized, in the caller's transaction. A delete purges every access row of the
 * athlete with it; an anonymize revokes the live one, notes it and scrubs the e-mail and the child's name out of the access rows, the
 * account lines and the invite jobs.
 */
export async function endForAthlete(c: AccessContext, athleteId: string, reason: 'anonimizat' | 'sters'): Promise<void> {
  await c.store.transaction(async () => {
    await c.access.lockAthlete(athleteId);
    const live = await c.access.liveByAthlete(athleteId);
    if (live) await revokeLive(c, live, reason);
    if (reason === 'sters') return c.access.deleteForAthlete(athleteId);
    if (live) await c.access.recordAthlete({ athleteId, action: HISTORY_ACTIONS.accessStopped, changes: {}, actor: c.actor });
    const athlete = await c.access.athleteForAccess(athleteId);
    await c.access.scrubForAthlete(athleteId, athlete?.name ?? '');
  });
}

/**
 * Merge (spec 4.5): the removed athlete's live access moves to the kept one when the kept one has none and the kept e-mail equals the access
 * e-mail; otherwise it ends with `unit` and is noted on the kept record. The removed athlete's other (revoked) rows are purged with it.
 * Both athlete locks are taken here in id order (the same order as the merge, and a row lock is re-entrant inside one transaction), so no caller has to hold them first.
 */
export async function moveOnMerge(c: AccessContext, keptId: string, removedId: string, keptEmail: string | null): Promise<void> {
  await c.store.transaction(async () => {
    for (const id of [keptId, removedId].sort()) await c.access.lockAthlete(id);
    const live = await c.access.liveByAthlete(removedId);
    if (live) {
      const keeps = (await c.access.liveByAthlete(keptId)) === null && normalizeEmail(keptEmail) === live.email;
      if (keeps) {
        await c.store.lockAccount(live.accountId);
        await c.access.moveAccess(live.id, keptId);
        await c.access.recordAthlete({ athleteId: keptId, action: HISTORY_ACTIONS.accessAdded, changes: { email: live.email }, actor: c.actor });
      } else {
        await revokeLive(c, live, 'unit');
        await c.access.recordAthlete({ athleteId: keptId, action: HISTORY_ACTIONS.accessRemoved, changes: { email: live.email }, actor: c.actor });
      }
    }
    await c.access.deleteForAthlete(removedId);
  });
}
