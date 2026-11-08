import { SECURITY_ACTIONS } from '../security/copy';
import { adminName, type AdminRow } from './admins';
import type { AdminLoginContext } from './context';

/** Stores the Google sub on the admin's account and writes "Google conectat." Callers have already decided that the link may happen (spec 4.6). */
export async function linkAdminGoogle(c: AdminLoginContext, admin: AdminRow, sub: string): Promise<void> {
  const account = await c.store.ensureAdminAccount(admin.id);
  await c.store.updateAdminAccount(account.id, { googleSub: sub });
  await c.store.record({ subjectType: 'admin', subjectId: String(admin.id), action: SECURITY_ACTIONS.googleLinked, changes: {}, actor: adminName(admin) });
}

/** May a Google login with a matching e-mail link this admin: the account holds no sub and no link was ever removed by the admin. */
export async function canLinkByEmail(c: AdminLoginContext, admin: AdminRow): Promise<boolean> {
  const account = await c.store.adminAccount(admin.id);
  return !account?.googleSub && !account?.googleUnlinkedAt;
}
