import type { Core } from '@strapi/strapi';
import type { AdminResult } from '../admin-result';
import { verifiedAdminId } from '../admin-auth';
import { refuse } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import { checkPassword } from '../portal/passwords';
import { hashSecret } from '../portal/tokens';
import type { SecurityView } from '../security/api-types';
import { SECURITY_ACTIONS, SECURITY_ERRORS, SECURITY_TOASTS } from '../security/copy';
import { securityView } from '../security/factors';
import { rpConfig } from '../security/passkeys';
import { resetTwoFactor } from '../security/reset';
import { hasTwoFactor } from '../security/second-step';
import type { Subject } from '../security/store';
import { adminById, adminName, adminUserService, allAdmins, canEnterAdmin, type AdminRow } from './admins';
import type { AdminLoginContext } from './context';
import { noticeLockout } from './login';
import { clearRefreshCookie, endAdminSessions } from './session';

const PASSWORD_MAX = 256;

export const adminSubject = (admin: AdminRow): Subject => ({ type: 'admin', id: String(admin.id) });

/** The context with the caller's name on the history lines it writes. */
export const withActor = (c: AdminLoginContext, admin: AdminRow): AdminLoginContext => ({ ...c, actor: adminName(admin) });

/** The admin behind a request's access token, or null (the route policy already checked it; this only reads who). */
export async function currentAdmin(strapi: Core.Strapi, authorization: string | undefined): Promise<AdminRow | null> {
  const id = await verifiedAdminId(authorization, strapi as never);
  if (id === null) return null;
  const admin = await adminById(strapi, Number(id));
  return canEnterAdmin(admin) ? admin : null;
}

export async function readSecurity(c: AdminLoginContext, admin: AdminRow): Promise<AdminResult<SecurityView>> {
  return { ok: true, data: await securityView(c, adminSubject(admin), admin.email, rpConfig()?.rpId ?? null) };
}

function readPasswordBody(body: unknown): { current: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { current, password } = body as Record<string, unknown>;
  if (typeof current !== 'string' || current === '' || current.length > PASSWORD_MAX || typeof password !== 'string') return null;
  return { current, password };
}

/** The device row this browser's cookie names, when it is live: its session is the one that stays. */
async function currentDeviceId(c: AdminLoginContext, admin: AdminRow, deviceCookie: string | null): Promise<string | undefined> {
  if (!deviceCookie) return undefined;
  const row = await c.store.adminDeviceByKey(admin.id, hashSecret(deviceCookie));
  return row && row.revokedAt === null ? row.id : undefined;
}

/**
 * Spec 4.8: the current password is counted on `admin:login:<e-mail>` before it is compared (5 wrong pause the e-mail), then the portal rules,
 * then the password, the history line, and every other session ends and every other device forgets its 2FA (this one stays when its device is known).
 */
export async function changeAdminPassword(c: AdminLoginContext, admin: AdminRow, body: unknown, deviceCookie: string | null): Promise<PortalResult<{ toast: string; signedOut: boolean }>> {
  const read = readPasswordBody(body);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  const attempt = await c.limits.emailAttempt(admin.email);
  if (attempt.refused) return { ok: false, status: 429, error: PORTAL_ERRORS.paused };
  if (!admin.passwordHash || !(await c.compare(read.current, admin.passwordHash))) {
    if (attempt.firstLock) void noticeLockout(c, admin);
    return attempt.locking ? { ok: false, status: 429, error: PORTAL_ERRORS.paused } : refuse(400, SECURITY_ERRORS.wrongCurrent);
  }
  await c.limits.emailCleared(admin.email);
  const rule = checkPassword(read.password, admin.email, c.common);
  if (rule !== null) return refuse(400, rule);
  await adminUserService(c.strapi).updateById(admin.id, { password: read.password });
  await c.store.record({ subjectType: 'admin', subjectId: String(admin.id), action: SECURITY_ACTIONS.passwordChanged, changes: {}, actor: adminName(admin) });
  const exceptDevice = await currentDeviceId(c, admin, deviceCookie);
  await endAdminSessions(c, admin.id, { exceptDevice });
  // Without a live device row nothing tells this session from the others, so it ended too: say so and drop the refresh cookie.
  const signedOut = exceptDevice === undefined;
  if (signedOut) clearRefreshCookie(c.koa);
  return { ok: true, data: { toast: SECURITY_TOASTS.passwordChanged, signedOut } };
}

/** The e-mail the Google link was proven for (the admin's own), or null. */
export async function readAdminGoogle(c: AdminLoginContext, admin: AdminRow): Promise<AdminResult<{ email: string | null }>> {
  const account = await c.store.adminAccount(admin.id);
  return { ok: true, data: { email: account?.googleSub ? admin.email : null } };
}

export async function unlinkAdminGoogle(c: AdminLoginContext, admin: AdminRow): Promise<AdminResult<{ toast: string }>> {
  const account = await c.store.adminAccount(admin.id);
  if (account?.googleSub) {
    await c.store.transaction(async () => {
      await c.store.updateAdminAccount(account.id, { googleSub: null, googleUnlinkedAt: c.now().toISOString() });
      await c.store.record({ subjectType: 'admin', subjectId: String(admin.id), action: SECURITY_ACTIONS.googleUnlinked, changes: {}, actor: adminName(admin) });
    });
  }
  return { ok: true, data: { toast: SECURITY_TOASTS.saved } };
}

export type AdminListRow = { id: number; name: string; email: string; twoFactor: boolean; self: boolean };

/** Administratori (Super Admin): each admin with whether a 2FA method is on, and which row is the caller's. */
export async function adminsList(c: AdminLoginContext, caller: AdminRow): Promise<AdminResult<AdminListRow[]>> {
  const rows: AdminListRow[] = [];
  for (const a of await allAdmins(c.strapi)) {
    rows.push({ id: a.id, name: adminName(a), email: a.email, twoFactor: (await hasTwoFactor(c, adminSubject(a))).length > 0, self: a.id === caller.id });
  }
  return { ok: true, data: rows };
}

/** "Resetează 2FA" on another admin: never the caller's own (ruling 6); the history line carries the caller's name. */
export async function resetAdminTwoFactor(c: AdminLoginContext, by: AdminRow, targetId: number): Promise<PortalResult<{ toast: string }>> {
  if (targetId === by.id) return { ok: false, status: 403, error: SECURITY_ERRORS.selfReset };
  const target = await adminById(c.strapi, targetId);
  if (!target) return refuse(404, PORTAL_ERRORS.notFound);
  await resetTwoFactor(withActor(c, by), adminSubject(target), target.email, adminName(by));
  return { ok: true, data: { toast: SECURITY_TOASTS.twoFactorReset } };
}
