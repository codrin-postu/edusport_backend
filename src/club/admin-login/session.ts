import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { forgetDevices } from '../security/remembered';
import type { AdminDeviceRow, SecurityStore } from '../security/store';

/** The part of Koa's context the admin login uses; the real `ctx` satisfies it. */
export type KoaContext = {
  request: { secure: boolean; ip?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
  cookies: { get: (name: string) => string | undefined; set: (name: string, value: string, options?: Record<string, unknown>) => unknown };
};
export type AdminSessionCtx = { strapi: Core.Strapi; koa: KoaContext; store: SecurityStore; now: () => Date };

type RefreshType = 'session' | 'refresh';
type Issued = { token: string; sessionId: string; absoluteExpiresAt: string };
type SessionRow = { sessionId: string; deviceId?: string | null };
/** Strapi 5.52.1's admin session manager (not exported by @strapi/core). */
export type AdminSessionManager = {
  generateRefreshToken: (userId: string, deviceId: string, options?: { type: RefreshType; metadata?: unknown }) => Promise<Issued>;
  generateAccessToken: (refreshToken: string) => Promise<{ token?: string; error?: string }>;
  rotateRefreshToken: (refreshToken: string) => Promise<Partial<Issued> & { error?: string }>;
  invalidateRefreshToken: (userId: string, deviceId?: string) => Promise<void>;
  revokeSessionById: (userId: string, sessionId: string) => Promise<boolean>;
  listSessions: (userId: string) => Promise<SessionRow[]>;
  validateAccessToken: (token: string) => { isValid: boolean; payload?: { userId?: string; sessionId?: string } } | Promise<{ isValid: boolean; payload?: { userId?: string; sessionId?: string } }>;
};

type SessionAuth = {
  REFRESH_COOKIE_NAME: string;
  buildCookieOptionsWithExpiry: (type: RefreshType, absoluteExpiresAt: string, secureRequest: boolean) => Record<string, unknown>;
  getRefreshCookieOptions: (secureRequest: boolean) => Record<string, unknown>;
  buildSessionMetadataFromContext: (ctx: { request: { headers: unknown } }) => unknown;
};

let cached: SessionAuth | null = null;
/** Strapi's own cookie helpers, so the cookie matches what `POST /admin/access-token` sets and reads (spec 4.2). */
export function strapiSessionAuth(): SessionAuth {
  if (cached) return cached;
  const requireCjs = createRequire(__filename);
  const path = join(dirname(requireCjs.resolve('@strapi/admin/package.json')), 'dist', 'server', 'shared', 'utils', 'session-auth.js');
  cached = requireCjs(path) as SessionAuth;
  return cached;
}

export const adminSessionManager = (strapi: Core.Strapi): AdminSessionManager => {
  const manager = (strapi as unknown as { sessionManager?: (origin: 'admin') => AdminSessionManager }).sessionManager;
  if (!manager) throw new Error('Strapi has no admin session manager');
  return manager('admin');
};

/** Clears the refresh cookie the way Strapi's logout does. */
export function clearRefreshCookie(koa: KoaContext): void {
  const auth = strapiSessionAuth();
  koa.cookies.set(auth.REFRESH_COOKIE_NAME, '', { ...auth.getRefreshCookieOptions(koa.request.secure), expires: new Date(0) });
}

/**
 * The spike-proven handoff (spec 4.2): Strapi's own session manager issues the refresh token for the device's family (an older family of the
 * same device ends first), the cookie is Strapi's, then the access token. An error answer throws and sets no cookie.
 */
export async function issueAdminSession(c: AdminSessionCtx, adminId: number, device: AdminDeviceRow, rememberMe: boolean): Promise<{ accessToken: string }> {
  const auth = strapiSessionAuth();
  const sessions = adminSessionManager(c.strapi);
  const type: RefreshType = rememberMe ? 'refresh' : 'session';
  await sessions.invalidateRefreshToken(String(adminId), device.strapiDeviceId);
  const issued = await sessions.generateRefreshToken(String(adminId), device.strapiDeviceId, { type, metadata: auth.buildSessionMetadataFromContext(c.koa) });
  if (!issued || 'error' in issued) throw new Error('admin refresh token not issued');
  const access = await sessions.generateAccessToken(issued.token);
  if (!access.token || access.error) throw new Error('admin access token not issued');
  c.koa.cookies.set(auth.REFRESH_COOKIE_NAME, issued.token, auth.buildCookieOptionsWithExpiry(type, issued.absoluteExpiresAt, c.koa.request.secure));
  return { accessToken: access.token };
}

/**
 * Ends the admin's Strapi sessions: every device's, or with `exceptDevice` (a device row id) every other one, then forgets the 2FA of the
 * devices it ended (password change, e-mail change, reset: spec 4.8, 6.4). Sessions without a device row (opened before the deploy) end too.
 */
export async function endAdminSessions(c: Pick<AdminSessionCtx, 'strapi' | 'store'>, adminId: number, o: { exceptDevice?: string }): Promise<void> {
  const sessions = adminSessionManager(c.strapi);
  const userId = String(adminId);
  if (o.exceptDevice === undefined) {
    await sessions.invalidateRefreshToken(userId);
  } else {
    const devices = await c.store.adminDevices(adminId);
    const kept = devices.find((d) => d.id === o.exceptDevice)?.strapiDeviceId;
    const others = new Set(devices.filter((d) => d.id !== o.exceptDevice).map((d) => d.strapiDeviceId));
    const live = await sessions.listSessions(userId);
    for (const s of live) if (s.deviceId && s.deviceId !== kept) others.add(s.deviceId);
    for (const deviceId of others) await sessions.invalidateRefreshToken(userId, deviceId);
    for (const s of live) if (!s.deviceId) await sessions.revokeSessionById(userId, s.sessionId);
  }
  await forgetDevices(c.store, { type: 'admin', id: userId }, o);
}
