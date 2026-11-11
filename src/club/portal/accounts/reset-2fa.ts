import { guarded, refuse, type AdminResult } from '../../admin-result';
import type { SecurityContext } from '../../security/context';
import { SECURITY_TOASTS } from '../../security/copy';
import { safeMail } from '../../security/factors';
import { clearTwoFactor } from '../../security/reset';
import { PORTAL_ERRORS } from '../copy';
import type { AccessStore } from '../access/store';
import type { PortalStore } from '../store';
import { portalSubject } from '../auth/two-factor';
import type { AccountAnswer } from './api-types';
import { blockOf } from './read';

export type ResetContext = { store: PortalStore; security: SecurityContext; /** Read for `hasSportiv` of the answer; tests that do not need it leave it out. */ access?: AccessStore };

/**
 * "Resetează 2FA" by an administrator (spec 6.6): methods and codes go, remembered devices are forgotten, every session ends, the coach is
 * mailed, the history line names the administrator. Passkeys stay. Needs no keys.
 */
export async function resetPortalTwoFactor(c: ResetContext, accountId: string, adminName: string): Promise<AdminResult<AccountAnswer>> {
  return guarded(c.security.log, 'portal 2fa reset', async () => {
    const account = await c.store.account(accountId);
    if (!account) return refuse(404, PORTAL_ERRORS.notFound);
    const security = { ...c.security, actor: adminName };
    // Factors, devices, sessions and the history line commit together (both stores); the mail goes after the commit.
    await c.store.transaction(() => clearTwoFactor(security, portalSubject(account), adminName, true));
    await safeMail(security, account.email, 'reset2fa', {});
    return { ok: true, data: { account: blockOf(account.teamMemberId ?? '', account, false, c.access ? (await c.access.liveByAccount(account.id)).length > 0 : false), toast: SECURITY_TOASTS.twoFactorReset } };
  });
}
