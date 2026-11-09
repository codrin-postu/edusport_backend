import type { Core } from '@strapi/strapi';
import jwt from 'jsonwebtoken';
import { normalizeAdminPath } from './admin-path';
import { strapiSecurityStore } from '../security/strapi-store';
import { adminSessionManager, clearRefreshCookie, strapiSessionAuth, type KoaContext } from './session';

/** A rotated refresh token whose child is older than this is a reuse; inside it Strapi's idempotent answer lets two tabs refresh at once. */
export const REUSE_GRACE_MS = 60_000;

export type SessionRecord = { sessionId: string; userId: string; deviceId?: string | null; status: string; childId?: string | null; createdAt: Date | string };

export type ReuseDeps = {
  /** The refresh JWT checked against the admin secret; null when it does not verify. */
  verify: (token: string) => { sessionId: string } | null;
  session: (sessionId: string) => Promise<SessionRecord | null>;
  /** `invalidateRefreshToken(userId, deviceId)`; without a device every session of the user. */
  end: (userId: string, deviceId: string | null) => Promise<void>;
  revokeDevice: (adminId: number, strapiDeviceId: string) => Promise<void>;
  now: () => Date;
  log: (m: string) => void;
};

export function verifyRefreshToken(token: string, secret: string, algorithm: string | undefined): { sessionId: string } | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: [(algorithm ?? 'HS256') as jwt.Algorithm] }) as Record<string, unknown>;
    return payload.type === 'refresh' && typeof payload.sessionId === 'string' ? { sessionId: payload.sessionId } : null;
  } catch {
    return null;
  }
}

/**
 * Strapi hands a refresh token that already has a child the same child again, so a copied cookie walks the chain forward for as long as its row lives.
 * A request with a rotated token whose child is older than the grace window is a reuse: the device's sessions end and its admin device is revoked.
 * Answers true when it did that (the caller answers 401); false lets Strapi go on, also for anything it cannot place.
 */
export async function refreshReuse(d: ReuseDeps, token: string): Promise<boolean> {
  const payload = d.verify(token);
  if (!payload) return false;
  const row = await d.session(payload.sessionId);
  if (!row || row.status !== 'rotated' || !row.childId) return false;
  const child = await d.session(row.childId);
  if (!child || d.now().getTime() - new Date(child.createdAt).getTime() <= REUSE_GRACE_MS) return false;
  const deviceId = row.deviceId ? row.deviceId : null;
  await d.end(row.userId, deviceId);
  const adminId = Number(row.userId);
  if (deviceId !== null && Number.isInteger(adminId)) await d.revokeDevice(adminId, deviceId);
  d.log(`[security] admin refresh reuse user=${row.userId}`);
  return true;
}

/** Deps over the live Strapi; a new security store for each request (its transaction pointer is per instance). */
export function reuseDeps(strapi: Core.Strapi): ReuseDeps {
  const store = strapiSecurityStore(strapi);
  const now = (): Date => new Date();
  return {
    verify: (token) => verifyRefreshToken(token, String(strapi.config.get('admin.auth.secret')), strapi.config.get('admin.auth.options.algorithm') as string | undefined),
    session: async (sessionId) => (await strapi.db.query('admin::session').findOne({ where: { sessionId } })) as SessionRecord | null,
    end: (userId, deviceId) => adminSessionManager(strapi).invalidateRefreshToken(userId, ...(deviceId ? [deviceId] : [])),
    revokeDevice: async (adminId, strapiDeviceId) => {
      const device = (await store.adminDevices(adminId)).find((x) => x.strapiDeviceId === strapiDeviceId);
      if (device) await store.updateAdminDevice(device.id, { revokedAt: now().toISOString(), twoFactorUntil: null });
    },
    now,
    log: (m) => strapi.log.error(m),
  };
}

type Ctx = KoaContext & { method: string; path: string; status: number; body: unknown };

/** The Koa middleware: only `POST /admin/access-token` with a refresh cookie is looked at; a reuse answers 401 and clears the cookie. */
export function refreshReuseMiddleware(build: (strapi: Core.Strapi) => ReuseDeps) {
  return (strapi: Core.Strapi) => async (ctx: Ctx, next: () => Promise<void>): Promise<void> => {
    if (ctx.method !== 'POST' || normalizeAdminPath(ctx.path) !== '/admin/access-token') return next();
    const token = ctx.cookies.get(strapiSessionAuth().REFRESH_COOKIE_NAME);
    if (!token || !(await refreshReuse(build(strapi), token))) return next();
    clearRefreshCookie(ctx);
    ctx.status = 401;
    ctx.body = { data: null, error: { status: 401, name: 'UnauthorizedError', message: 'Invalid refresh token', details: {} } };
  };
}
