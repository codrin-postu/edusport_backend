import { ADMIN_ERRORS } from '../../athletes/errors';
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { inviteLink, portalHost, portalInviteJob } from '../../../email/portal-email';
import { PORTAL_ACTIONS, PORTAL_ERRORS } from '../copy';
import { ACCOUNT_TOASTS } from '../copy-admin';
import { normalizeEmail } from '../limits';
import type { AccountRow } from '../store';
import { hashSecret, INVITE_TTL_MS, newInviteSecret } from '../tokens';
import type { AccountAnswer, AccountBlock } from './api-types';
import { blockOf, type AccountContext } from './read';

const stale = (): AdminResult<never> => refuse(409, ADMIN_ERRORS.stale);
const taken = (): AdminResult<never> => refuse(409, PORTAL_ERRORS.emailTaken);

/** A Postgres unique violation; on the team member link it is a lost race for one team member, else for one e-mail. */
export function uniqueViolation(err: unknown): AdminResult<never> | null {
  const e = err as { code?: unknown; message?: unknown; constraint?: unknown } | null;
  const name = (err as { name?: unknown } | null)?.name;
  // Postgres 23505, or Strapi's own pre-check ("This attribute must be unique"); nothing else counts.
  if (!e || (e.code !== '23505' && !(name === 'ValidationError' && /unique/i.test(String(e.message ?? ''))))) return null;
  return /team_member/i.test(`${String(e.constraint ?? '')} ${String(e.message ?? '')}`) ? stale() : taken();
}

export async function guardedWrite<T>(c: AccountContext, tag: string, work: () => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  return guarded(c.log, tag, async () => {
    try {
      return await work();
    } catch (err) {
      const refused = uniqueViolation(err);
      if (refused) return refused;
      throw err;
    }
  });
}

export const emailOf = (body: unknown): string | null =>
  typeof body === 'object' && body !== null ? normalizeEmail((body as Record<string, unknown>).email) : null;

/** Inside a transaction: older unused tokens of the kinds are used up; using up invites also cancels their queued mail jobs. */
export async function useUpTokens(c: AccountContext, accountId: string, kinds: ('invite' | 'reset')[]): Promise<void> {
  const at = c.now().toISOString();
  for (const kind of kinds) for (const t of await c.store.tokens(accountId, kind)) if (t.usedAt === null) await c.store.updateToken(t.id, { usedAt: at });
  if (kinds.includes('invite')) await c.cancelInvites(accountId);
}

/** Inside a transaction with the account locked: a new invite token and its queued mail job; the id of the job. */
export async function queueFreshInvite(c: AccountContext, account: AccountRow, name: string, email: string): Promise<string> {
  if (!c.siteUrl) throw new Error('the public site address is not configured');
  const { host, origin } = portalHost(c.siteUrl);
  const secret = newInviteSecret();
  await c.store.createToken({ accountId: account.id, kind: 'invite', secretHash: hashSecret(secret), expiresAt: new Date(c.now().getTime() + INVITE_TTL_MS).toISOString() });
  const link = inviteLink(host, secret, origin.startsWith('http://') ? 'http' : 'https');
  return c.queueInvite(portalInviteJob({ recipient: email, accountId: account.id, payload: { name, link, host } }, c.now()));
}

export const answer = (block: AccountBlock, toast: string): AdminResult<AccountAnswer> => ({ ok: true, data: { account: block, toast } });

export async function inviteAccount(c: AccountContext, teamMemberId: string, body: unknown): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal invite', async () => {
    const name = await c.store.teamMemberName(teamMemberId);
    if (name === null) return refuse(404, PORTAL_ERRORS.notFound);
    if (await c.store.accountByTeamMember(teamMemberId)) return stale();
    const email = emailOf(body);
    if (email === null) return refuse(400, PORTAL_ERRORS.invalid);
    if (await c.store.accountByEmail(email)) return taken();
    const at = c.now().toISOString();
    const made = await c.store.transaction(async () => {
      const userId = await c.store.createUser(email, null);
      const id = await c.store.createAccount({ userId, email, status: 'invited', teamMemberId, invitedAt: at, invitedBy: c.actor });
      await c.store.lockAccount(id);
      const account = (await c.store.account(id)) as AccountRow;
      const jobId = await queueFreshInvite(c, account, name, email);
      await c.store.record({ subjectId: id, action: PORTAL_ACTIONS.inviteSent, changes: { email }, actor: c.actor });
      return { account, jobId };
    });
    c.afterCommit(made.jobId);
    return answer(blockOf(teamMemberId, made.account), ACCOUNT_TOASTS.invited);
  });
}

export async function resendInvite(c: AccountContext, accountId: string): Promise<AdminResult<AccountAnswer>> {
  return guardedWrite(c, 'portal invite resend', async () => {
    if (!(await c.store.account(accountId))) return refuse(404, PORTAL_ERRORS.notFound);
    const done = await c.store.transaction(async () => {
      await c.store.lockAccount(accountId);
      const account = await c.store.account(accountId);
      if (!account || account.status !== 'invited' || account.teamMemberId === null) return null;
      const name = await c.store.teamMemberName(account.teamMemberId);
      if (name === null) return null;
      await useUpTokens(c, accountId, ['invite']);
      const jobId = await queueFreshInvite(c, account, name, account.email);
      await c.store.updateAccount(accountId, { invitedAt: c.now().toISOString(), invitedBy: c.actor });
      await c.store.record({ subjectId: accountId, action: PORTAL_ACTIONS.inviteResent, changes: {}, actor: c.actor });
      return { jobId, account: (await c.store.account(accountId)) as AccountRow };
    });
    if (!done) return stale();
    c.afterCommit(done.jobId);
    return answer(blockOf(done.account.teamMemberId ?? '', done.account), ACCOUNT_TOASTS.invited);
  });
}
