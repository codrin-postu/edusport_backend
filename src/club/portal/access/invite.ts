import { portalHost } from '../../../email/portal-email';
import { portalAccessJob } from '../../../email/portal-access-email';
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { ADMIN_ERRORS } from '../../athletes/errors';
import { queueFreshInvite, useUpTokens } from '../accounts/invite';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { normalizeEmail } from '../limits';
import type { AccountRow } from '../store';
import { HISTORY_ACTIONS } from '../../history-text';
import type { AccessAnswer, AccessBlock } from './api-types';
import { accessBlock } from './block';
import type { AccessContext } from './context';
import { ACCESS_COPY, ACCESS_ERRORS } from './copy';
import { holderName, inviteRefusal, planInvite, type Host } from './rules';
import type { AthleteForAccess } from './types';

export type { AccessContext } from './context';
export type { AccessAnswer };
/** `jobId`: the queued mail, to release after the outermost commit (null when a refusal-free path queued none). */
export type Linked = { toast: string; jobId: string | null };

const stale = (): AdminResult<never> => refuse(409, ADMIN_ERRORS.stale);

/** A lost race on the one-live-access-per-athlete index answers stale, like every other lost race. */
async function guardedAccess<T>(c: AccessContext, tag: string, work: () => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  return guarded(c.log, tag, async () => {
    try {
      return await work();
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      if (code === '23505' || code === '40P01') return stale();
      throw err;
    }
  });
}

async function latestInviteHost(c: AccessContext, accountId: string): Promise<Host | null> {
  let latest: { createdAt: string; host: string | null } | null = null;
  for (const t of await c.store.tokens(accountId, 'invite')) if (!latest || t.createdAt >= latest.createdAt) latest = t;
  return latest === null ? null : latest.host === 'sportiv' ? 'sportiv' : 'antrenor';
}

/** The names the account's live accesses point to, then `current`. */
async function childNames(c: AccessContext, accountId: string, current: AthleteForAccess): Promise<{ names: string[]; ids: string[] }> {
  const names: string[] = [];
  const ids: string[] = [];
  for (const row of await c.access.liveByAccount(accountId)) {
    const athlete = await c.access.athleteForAccess(row.athleteId);
    if (athlete) { names.push(athlete.name); ids.push(athlete.id); }
  }
  return { names: [...names, current.name], ids: [...ids, current.id] };
}

async function greetingName(c: AccessContext, account: AccountRow, athlete: AthleteForAccess): Promise<string> {
  const own = account.name?.trim() || (account.teamMemberId ? await c.store.teamMemberName(account.teamMemberId) : null);
  return own || holderName(athlete);
}

/** `moved`: the athlete line reads "mutat". `silent`: rows are written but no mail is queued (a bulk group's last athlete sends the one mail). `names`: the athletes the one mail names. */
export type LinkOptions = { moved?: boolean; silent?: boolean; names?: string[]; ids?: string[] };
type Plan = { account: AccountRow; athlete: AthleteForAccess; email: string; opts: LinkOptions };

/** Case 1 of spec 4.2: a new invited account for the e-mail, invite on the sportiv host. */
async function createCase(c: AccessContext, { athlete, email, opts }: Plan): Promise<Linked> {
  const at = c.now().toISOString();
  const name = holderName(athlete);
  const userId = await c.store.createUser(email, null);
  const id = await c.store.createAccount({ userId, email, status: 'invited', name, invitedAt: at, invitedBy: c.actor });
  await c.store.lockAccount(id);
  if (opts.silent) return { toast: ACCESS_COPY.inviteSent, jobId: null };
  const account = (await c.store.account(id)) as AccountRow;
  return { toast: ACCESS_COPY.inviteSent, jobId: await queueFreshInvite(c, account, name, email, 'sportiv', opts.names ?? [athlete.name], opts.ids ?? [athlete.id]) };
}

/** Case 2: an active account gets the athlete and a "you also have access" mail. */
async function addCase(c: AccessContext, { account, athlete, email, opts }: Plan): Promise<Linked> {
  if (opts.silent) return { toast: ACCESS_COPY.accessAdded, jobId: null };
  if (!c.siteUrl) throw new Error('the public site address is not configured');
  const { host, origin } = portalHost(c.siteUrl, 'sportiv');
  const name = await greetingName(c, account, athlete);
  const jobId = await c.queueAccess(portalAccessJob({ recipient: email, accountId: account.id, payload: { name, variant: 'child', childName: (opts.names ?? [athlete.name]).join(' și '), athleteIds: opts.ids ?? [athlete.id], link: `${origin}/`, host } }));
  return { toast: ACCESS_COPY.accessAdded, jobId };
}

/** Case 3: an invited account: older invites used up, one fresh invite on the host of the latest one. */
async function reinviteCase(c: AccessContext, { account, athlete, email, opts }: Plan, host: Host): Promise<Linked> {
  if (opts.silent) return { toast: ACCESS_COPY.inviteSent, jobId: null };
  const children = await childNames(c, account.id, athlete);
  await useUpTokens(c, account.id, ['invite']);
  await c.store.updateAccount(account.id, { invitedAt: c.now().toISOString(), invitedBy: c.actor });
  const jobId = await queueFreshInvite(c, account, await greetingName(c, account, athlete), email, host, children.names, children.ids);
  return { toast: ACCESS_COPY.inviteSent, jobId };
}

async function lockedAccount(c: AccessContext, email: string): Promise<AccountRow | null> {
  const known = await c.store.accountByEmail(email);
  if (!known) return null;
  await c.store.lockAccount(known.id);
  return c.store.account(known.id);
}

const refusalStatus = (message: string): 400 | 409 => (message === ACCESS_ERRORS.needsEmail ? 400 : 409);

/**
 * The invite outcome of spec 4.2 for `athleteId` and `rawEmail`, inside one transaction (a caller's, when there is one: lock order athlete,
 * account). The access row, the account line and the athlete line are written; the queued mail is released by the caller after commit.
 */
export async function linkAccess(c: AccessContext, athleteId: string, rawEmail: string, opts: LinkOptions = {}): Promise<AdminResult<Linked>> {
  return c.store.transaction(async (): Promise<AdminResult<Linked>> => {
    await c.access.lockAthlete(athleteId);
    const athlete = await c.access.athleteForAccess(athleteId);
    if (!athlete) return refuse(404, PORTAL_ERRORS.notFound);
    const email = normalizeEmail(rawEmail);
    // The e-mail was read before the lock (invite, bulk): an edit that committed meanwhile makes this request stale. A move runs before the write and is exempt.
    if (!opts.moved && normalizeEmail(athlete.email) !== normalizeEmail(rawEmail)) return stale();
    const refusal = inviteRefusal({ status: athlete.status, email });
    if (refusal !== null || email === null) return refuse(refusalStatus(refusal ?? ACCESS_ERRORS.needsEmail), refusal ?? ACCESS_ERRORS.needsEmail);
    const account = await lockedAccount(c, email);
    const plan = planInvite(account, account ? await latestInviteHost(c, account.id) : null);
    if (plan.kind === 'refuse') return refuse(409, plan.message);
    const live = await c.access.liveByAthlete(athleteId);
    if (live && account && live.accountId === account.id) return stale();
    if (live) await c.access.revokeAccess(live.id, { revokedAt: c.now().toISOString(), revokedBy: c.actor, revokeReason: 'email_schimbat' });
    const linked = await run(c, plan, { account: account as AccountRow, athlete, email, opts });
    const accountId = (await c.store.accountByEmail(email))?.id as string;
    await c.access.createAccess({ athleteId, accountId, email, invitedAt: c.now().toISOString(), invitedBy: c.actor });
    await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.accessGranted, changes: { athlete: athlete.name, athleteId }, actor: c.actor });
    const action = opts.moved ? HISTORY_ACTIONS.accessMoved : plan.kind === 'add' ? HISTORY_ACTIONS.accessAdded : HISTORY_ACTIONS.accessInvited;
    await c.access.recordAthlete({ athleteId, action, changes: { email }, actor: c.actor });
    return { ok: true, data: linked };
  });
}

function run(c: AccessContext, plan: ReturnType<typeof planInvite>, p: Plan): Promise<Linked> {
  if (plan.kind === 'create') return createCase(c, p);
  if (plan.kind === 'add') return addCase(c, p);
  return reinviteCase(c, p, plan.kind === 'reinvite' ? plan.host : 'sportiv');
}

async function answerFor(c: AccessContext, athleteId: string, toast: string): Promise<AdminResult<AccessAnswer>> {
  const access = await accessBlock(c, athleteId);
  return access ? { ok: true, data: { access, toast } } : refuse(404, PORTAL_ERRORS.notFound);
}

/** "Invită în portal": the e-mail is the athlete record's, nothing is typed. */
export async function inviteAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>> {
  return guardedAccess(c, 'athlete access invite', async () => {
    const athlete = await c.access.athleteForAccess(athleteId);
    if (!athlete) return refuse(404, PORTAL_ERRORS.notFound);
    const linked = await linkAccess(c, athleteId, athlete.email ?? '');
    if (linked.ok === false) return linked;
    if (linked.data.jobId) c.afterCommit(linked.data.jobId);
    return answerFor(c, athleteId, linked.data.toast);
  });
}

/** "Retrimite invitația": the live access's account must still be `invited` (case 3). */
export async function resendAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>> {
  return guardedAccess(c, 'athlete access resend', async () => {
    if (!(await c.access.athleteForAccess(athleteId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.access.lockAthlete(athleteId);
      const live = await c.access.liveByAthlete(athleteId);
      const athlete = await c.access.athleteForAccess(athleteId);
      if (!live || !athlete) return null;
      await c.store.lockAccount(live.accountId);
      const account = await c.store.account(live.accountId);
      if (!account || account.status !== 'invited') return null;
      const linked = await reinviteCase(c, { account, athlete, email: account.email, opts: {} }, (await latestInviteHost(c, account.id)) ?? 'sportiv');
      await c.store.record({ subjectId: account.id, action: PORTAL_ACTIONS.inviteResent, changes: {}, actor: c.actor });
      return linked;
    });
    if (!done) return stale();
    if (done.jobId) c.afterCommit(done.jobId);
    return answerFor(c, athleteId, done.toast);
  });
}

/** "Scoate accesul": reason `scos`, at once; the holder's next request for the athlete is refused by the access rule. */
export async function removeAccess(c: AccessContext, athleteId: string): Promise<AdminResult<AccessAnswer>> {
  return guardedAccess(c, 'athlete access remove', async () => {
    if (!(await c.access.athleteForAccess(athleteId))) return refuse(404, PORTAL_ERRORS.notFound);
    const removed = await c.store.transaction(async () => {
      await c.access.lockAthlete(athleteId);
      const live = await c.access.liveByAthlete(athleteId);
      if (!live) return false;
      await c.store.lockAccount(live.accountId);
      await c.access.revokeAccess(live.id, { revokedAt: c.now().toISOString(), revokedBy: c.actor, revokeReason: 'scos' });
      await c.access.recordAthlete({ athleteId, action: HISTORY_ACTIONS.accessRemoved, changes: { email: live.email }, actor: c.actor });
      return true;
    });
    return removed ? answerFor(c, athleteId, ACCESS_COPY.accessRemoved) : stale();
  });
}

