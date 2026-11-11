import type { NewPortalAccessJob } from '../../../email/portal-access-email';
import type { NewPortalInviteJob } from '../../../email/portal-email';
import type { SendPortalMail } from '../../../email/portal-mail-type';
import type { AccessStore } from '../access/store';
import type { PortalSessions } from '../sessions';
import type { PortalStore } from '../store';

/** The account context type, apart from read.ts (server code) so the admin type check can reach it. */
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
