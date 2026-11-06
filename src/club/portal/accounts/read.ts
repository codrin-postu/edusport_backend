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
import { PORTAL_ERRORS } from '../copy';
import { portalSessions, type PortalSessions } from '../sessions';
import type { AccountRow, PortalStore } from '../store';
import { strapiPortalStore } from '../strapi-store';
import type { AccountBlock, AccountState } from './api-types';

export type AccountContext = {
  store: PortalStore; sessions: PortalSessions; actor: string; now: () => Date; log: (m: string) => void;
  /** Writes the queued job (inside the caller's transaction) and answers its id. */
  queueInvite: (job: NewPortalInviteJob) => Promise<string>;
  /** After commit: the first attempt of the invite job. */
  afterCommit: (jobId: string) => void;
  /** Inside a transaction: the account's queued invite jobs are cancelled and their links blanked. */
  cancelInvites: (accountId: string) => Promise<void>;
  mail: SendPortalMail;
  hash: (p: string) => Promise<string>;
  /** The public site address the portal host and the invite link derive from; '' when none is configured. */
  siteUrl: string;
};

const JOB_UID = 'api::email-job.email-job' as const;

export async function accountContext(strapi: Core.Strapi, ctx: AdminCtx): Promise<AccountContext> {
  return baseContext(strapi, await adminActor(ctx.request.header.authorization, strapi));
}

/** The context without a request: the delete hook and the tests build theirs from here. */
export function baseContext(strapi: Core.Strapi, actor: string): AccountContext {
  const store = strapiPortalStore(strapi);
  const now = (): Date => new Date();
  return {
    store,
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
    afterCommit: (jobId) => attemptPortalInvite(strapi, jobId),
    cancelInvites: async (accountId) => {
      await cancelQueuedInvites(strapi, accountId);
    },
    mail: portalMailSender(strapi),
    hash: (p) => bcrypt.hash(p, 10),
    siteUrl: publicSiteUrl() ?? '',
  };
}

export const sinceDate = (iso: string | null): string | null => (iso ? isoDate(todayInBucharest(new Date(iso))) : null);

const STATE_SINCE: Record<AccountRow['status'], (a: AccountRow) => string | null> = {
  invited: (a) => a.invitedAt,
  active: (a) => a.activatedAt,
  disabled: (a) => a.disabledAt,
};

export function blockOf(teamMemberId: string, account: AccountRow | null): AccountBlock {
  if (!account) return { teamMemberId, accountId: null, state: 'none', email: null, since: null, google: false };
  const state: AccountState = account.status;
  return { teamMemberId, accountId: account.id, state, email: account.email, since: sinceDate(STATE_SINCE[account.status](account)), google: account.googleSub !== null };
}

export async function readAccount(c: AccountContext, teamMemberId: string): Promise<AdminResult<AccountBlock>> {
  return guarded(c.log, 'portal account read', async () => {
    if ((await c.store.teamMemberName(teamMemberId)) === null) return refuse(404, PORTAL_ERRORS.notFound);
    return { ok: true, data: blockOf(teamMemberId, await c.store.accountByTeamMember(teamMemberId)) };
  });
}
