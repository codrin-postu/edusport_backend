import type { Core } from '@strapi/strapi';
import bcrypt from 'bcryptjs';
import { adminActor } from '../../admin-actor';
import type { AdminCtx } from '../../admin-http';
import { guarded, refuse, type AdminResult } from '../../admin-result';
import { isoDate, todayInBucharest } from '../../birth-date';
import { captureMessage } from '../../../sentry';
import { publicSiteUrl } from '../../../email/config';
import { attemptPortalInvite, cancelQueuedInvites } from '../../../email/strapi-email';
import { portalMailSender, type SendPortalMail } from '../../../email/portal-direct';
import type { NewPortalInviteJob } from '../../../email/portal-email';
import type { NewPortalAccessJob } from '../../../email/portal-access-email';
import { transactionScope } from '../../athletes/strapi-store';
import { strapiAccessStore } from '../access/strapi-store';
import type { AccessStore } from '../access/store';
import { PORTAL_ERRORS } from '../copy';
import { portalSessions, type PortalSessions } from '../sessions';
import { strapiSecurityStore } from '../../security/strapi-store';
import type { SecurityStore } from '../../security/store';
import type { AccountRow, PortalStore } from '../store';
import { strapiPortalStore } from '../strapi-store';
import type { AccountBlock, AccountState } from './api-types';

export type AccountContext = {
  store: PortalStore; sessions: PortalSessions; actor: string;
  /** Athlete access rows (7-1), sharing the transaction scope of `store`. */
  access: AccessStore;
  /** Writes the queued `portal-access` job (inside the caller's transaction) and answers its id. */
  queueAccess: (job: NewPortalAccessJob) => Promise<string>; now: () => Date; log: (m: string) => void;
  /** Writes the queued job (inside the caller's transaction) and answers its id. */
  queueInvite: (job: NewPortalInviteJob) => Promise<string>;
  /** After commit: the first attempt of the invite job. */
  afterCommit: (jobId: string) => void;
  /** Inside a transaction: the account's queued invite jobs are cancelled and their links blanked. */
  cancelInvites: (accountId: string) => Promise<void>;
  mail: SendPortalMail;
  hash: (p: string) => Promise<string>;
  /** Whether the account has a confirmed 2FA method; tests that do not read it leave it out (false). */
  twoFactorOn?: (accountId: string) => Promise<boolean>;
  /** Ends a first-link Google login that waits for its 2FA code (it was proven for the old e-mail); tests that do not read it leave it out. */
  endPendingGoogle?: (accountId: string) => Promise<void>;
  /** The public site address the portal host and the invite link derive from; '' when none is configured. */
  siteUrl: string;
};

const JOB_UID = 'api::email-job.email-job' as const;

export async function accountContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<AccountContext> {
  return baseContext(strapi, await adminActor(ctx.request.header.authorization, strapi));
}

/** The context without a request: the delete hook and the tests build theirs from here. */
export function baseContext(strapi: Core.Strapi, actor: string): AccountContext {
  const scope = transactionScope(strapi);
  const store = strapiPortalStore(strapi, scope);
  const security = strapiSecurityStore(strapi);
  const now = (): Date => new Date();
  return {
    store,
    access: strapiAccessStore(strapi, scope),
    sessions: portalSessions(store, now),
    actor,
    now,
    log: (m) => {
      strapi.log.error(m);
      captureMessage(m);
    },
    queueInvite: async (job) =>
      (await strapi.documents(JOB_UID).create({
        data: { kind: 'portal-invite', subject: job.subject, recipient: job.recipient, payload: job.payload, changeKey: job.accountId, status: 'queued', attempts: 0 } as never,
      })).documentId,
    queueAccess: async (job) =>
      (await strapi.documents(JOB_UID).create({
        data: { kind: 'portal-access', subject: job.subject, recipient: job.recipient, payload: job.payload, changeKey: job.accountId, status: 'queued', attempts: 0 } as never,
      })).documentId,
    afterCommit: (jobId) => attemptPortalInvite(strapi, jobId),
    cancelInvites: async (accountId) => {
      await cancelQueuedInvites(strapi, accountId);
    },
    mail: portalMailSender(strapi),
    hash: (p) => bcrypt.hash(p, 10),
    siteUrl: publicSiteUrl() ?? '',
    twoFactorOn: (accountId) => twoFactorOn(security, accountId),
    endPendingGoogle: (accountId) => endPendingGoogleLinks(security, accountId, now()),
  };
}

export const sinceDate = (iso: string | null): string | null => (iso ? isoDate(todayInBucharest(new Date(iso))) : null);

const STATE_SINCE: Record<AccountRow['status'], (a: AccountRow) => string | null> = {
  invited: (a) => a.invitedAt,
  active: (a) => a.activatedAt,
  disabled: (a) => a.disabledAt,
};

/** Any confirmed method counts (the same rule as `hasTwoFactor`, without the backup-code row). */
export async function twoFactorOn(store: SecurityStore, accountId: string): Promise<boolean> {
  return (await store.factors({ type: 'portal', id: accountId })).some((f) => f.confirmedAt !== null);
}

/** `blockOf` with the 2FA flag read. */
export async function blockFor(c: AccountContext, teamMemberId: string, account: AccountRow | null): Promise<AccountBlock> {
  const twoFactor = account && c.twoFactorOn ? await c.twoFactorOn(account.id) : false;
  const hasSportiv = account ? (await c.access.liveByAccount(account.id)).length > 0 : false;
  return blockOf(teamMemberId, account, twoFactor, hasSportiv);
}

export function blockOf(teamMemberId: string, account: AccountRow | null, twoFactor = false, hasSportiv = false): AccountBlock {
  if (!account) return { teamMemberId, accountId: null, state: 'none', email: null, since: null, google: false, twoFactor: false, hasSportiv: false, coachDisabled: false };
  const state: AccountState = account.status;
  return {
    teamMemberId, accountId: account.id, state, email: account.email, since: sinceDate(STATE_SINCE[account.status](account)), google: account.googleSub !== null, twoFactor,
    hasSportiv, coachDisabled: account.coachDisabledAt !== null,
  };
}

export async function readAccount(c: AccountContext, teamMemberId: string): Promise<AdminResult<AccountBlock>> {
  return guarded(c.log, 'portal account read', async () => {
    if ((await c.store.teamMemberName(teamMemberId)) === null) return refuse(404, PORTAL_ERRORS.notFound);
    return { ok: true, data: await blockFor(c, teamMemberId, await c.store.accountByTeamMember(teamMemberId)) };
  });
}

/** Consumes the open pending logins of the account that carry a Google sub to be linked after the code. */
export async function endPendingGoogleLinks(store: SecurityStore, accountId: string, now: Date): Promise<void> {
  for (const row of await store.openChallenges({ type: 'portal', id: accountId }, 'pending-login')) {
    if (typeof row.data.googleSub === 'string') await store.consumeOnce('challenge', row.id, now.toISOString());
  }
}
