import { refuse, type AdminResult } from '../../admin-result';
import type { SecurityContext } from '../../security/context';
import { SECURITY_TOASTS } from '../../security/copy';
import { resetTwoFactor } from '../../security/reset';
import { PORTAL_ERRORS } from '../copy';
import type { PortalStore } from '../store';
import { portalSubject } from '../auth/two-factor';
import type { AccountAnswer } from './api-types';
import { blockOf } from './read';

export type ResetContext = { store: PortalStore; security: SecurityContext };

/**
 * "Resetează 2FA" by an administrator (spec 6.6): methods and codes go, remembered devices are forgotten, every session ends, the coach is
 * mailed, the history line names the administrator. Passkeys stay. Needs no keys.
 */
export async function resetPortalTwoFactor(c: ResetContext, accountId: string, adminName: string): Promise<AdminResult<AccountAnswer>> {
  const account = await c.store.account(accountId);
  if (!account) return refuse(404, PORTAL_ERRORS.notFound);
  await resetTwoFactor({ ...c.security, actor: adminName }, portalSubject(account), account.email, adminName);
  return { ok: true, data: { account: blockOf(account.teamMemberId ?? '', account, false), toast: SECURITY_TOASTS.twoFactorReset } };
}
