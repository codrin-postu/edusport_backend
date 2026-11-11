import { refuse, type AdminResult } from '../../admin-result';
import { isRecord } from '../../narrow';
import { MAX_BULK } from '../../personal-data/anonymize-plan';
import { PORTAL_ERRORS } from '../copy';
import { normalizeEmail } from '../limits';
import type { BulkPreview, BulkSkipReason } from './api-types';
import type { AccessContext } from './context';
import { ACCESS_COPY } from './copy';
import { linkAccess } from './invite';
import type { AthleteForAccess } from './types';

type Candidate = { athlete: AthleteForAccess; email: string };
type Sorted = { eligible: Candidate[]; skipped: BulkPreview['skipped'] };

/** The ids of a bulk request: 1 to `MAX_BULK` distinct strings, else null. */
export function readBulkIds(body: unknown): string[] | null {
  const raw = isRecord(body) ? body.ids : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BULK) return null;
  if (!raw.every((id) => typeof id === 'string' && id.trim() !== '')) return null;
  return [...new Set(raw as string[])];
}

async function skipReason(c: AccessContext, athlete: AthleteForAccess): Promise<BulkSkipReason | null> {
  if (athlete.status === 'anonimizat') return 'anonimizat';
  if (athlete.status === 'nou') return 'nou';
  if (normalizeEmail(athlete.email) === null) return 'fără e-mail';
  return (await c.access.liveByAthlete(athlete.id)) ? 'are deja acces' : null;
}

/** Who gets an invitation and who is left out (and why); an unknown id is ignored. */
async function sortIds(c: AccessContext, ids: string[]): Promise<Sorted> {
  const sorted: Sorted = { eligible: [], skipped: [] };
  for (const id of ids) {
    const athlete = await c.access.athleteForAccess(id);
    if (!athlete) continue;
    const reason = await skipReason(c, athlete);
    if (reason) sorted.skipped.push({ athleteId: id, name: athlete.name, reason });
    else sorted.eligible.push({ athlete, email: normalizeEmail(athlete.email) as string });
  }
  return sorted;
}

function byAddress(eligible: Candidate[]): Candidate[][] {
  const groups = new Map<string, Candidate[]>();
  for (const e of eligible) groups.set(e.email, [...(groups.get(e.email) ?? []), e]);
  return [...groups.values()];
}

/** "<n> invitații către <m> adrese" and the rows that are left out (spec 4.6). */
export async function bulkPreview(c: AccessContext, ids: string[]): Promise<AdminResult<BulkPreview>> {
  if (ids.length === 0 || ids.length > MAX_BULK) return refuse(400, PORTAL_ERRORS.invalid);
  const { eligible, skipped } = await sortIds(c, ids);
  return { ok: true, data: { invites: eligible.length, addresses: byAddress(eligible).length, skipped } };
}

class Refused extends Error {}

/** One address, one transaction: every athlete gets its row, the last one queues the one mail that names them all. */
async function inviteAddress(c: AccessContext, group: Candidate[]): Promise<string | null> {
  const names = group.map((g) => g.athlete.name);
  return c.store.transaction(async () => {
    // Athletes first, sorted, then the account: a single invite of one of them waits instead of deadlocking.
    for (const id of group.map((g) => g.athlete.id).sort()) await c.access.lockAthlete(id);
    let jobId: string | null = null;
    for (const [i, { athlete, email }] of group.entries()) {
      const last = i === group.length - 1;
      const linked = await linkAccess(c, athlete.id, email, last ? { names } : { silent: true });
      if (linked.ok === false) throw new Refused(linked.error);
      if (last) jobId = linked.data.jobId;
    }
    return jobId;
  });
}

/**
 * "Trimite" of the preview: one mail per distinct e-mail, each address in its own transaction so one failure never stops the others.
 * The answer counts the addresses that were sent.
 */
export async function bulkInvite(c: AccessContext, ids: string[]): Promise<AdminResult<{ sent: number; toast: string }>> {
  if (ids.length === 0 || ids.length > MAX_BULK) return refuse(400, PORTAL_ERRORS.invalid);
  let sent = 0;
  for (const group of byAddress((await sortIds(c, ids)).eligible)) {
    try {
      const jobId = await inviteAddress(c, group);
      if (jobId) c.afterCommit(jobId);
      sent += 1;
    } catch (err) {
      c.log(err instanceof Refused ? '[athlete access] an address was left out of the bulk invite' : '[athlete access] an address failed in the bulk invite');
    }
  }
  return { ok: true, data: { sent, toast: ACCESS_COPY.bulkToast(sent) } };
}
