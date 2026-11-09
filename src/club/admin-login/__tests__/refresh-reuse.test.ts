import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { REUSE_GRACE_MS, refreshReuse, refreshReuseMiddleware, verifyRefreshToken, type ReuseDeps, type SessionRecord } from '../refresh-reuse';
import { bindAdminDevice } from '../devices';
import { issueAdminSession } from '../session';
import { normalizeAdminPath } from '../admin-path';
import { adminEnv } from './admin-env';

const SECRET = 'admin-test-secret';

/** A device with its session, and the deps over the same in-memory tables. */
async function scene(adminId = 7) {
  const env = adminEnv();
  const logs: string[] = [];
  const bound = await bindAdminDevice({ store: env.c.store, now: env.c.now, userAgent: null }, adminId, null);
  const login = async (deviceId: string) => {
    const refresh = await env.admin().generateRefreshToken(String(adminId), deviceId, { type: 'refresh' });
    return refresh;
  };
  const deps: ReuseDeps = {
    verify: (t) => verifyRefreshToken(t, SECRET, undefined),
    session: async (id) => (env.sessions.rows.find((r) => r.sessionId === id) as unknown as SessionRecord) ?? null,
    end: (userId, deviceId) => env.admin().invalidateRefreshToken(userId, ...(deviceId ? [deviceId] : [])),
    revokeDevice: async (id, strapiDeviceId) => {
      const d = (await env.c.store.adminDevices(id)).find((x) => x.strapiDeviceId === strapiDeviceId);
      if (d) await env.c.store.updateAdminDevice(d.id, { revokedAt: env.clock.t.toISOString(), twoFactorUntil: null });
    },
    now: () => new Date(),
    log: (m) => logs.push(m),
  };
  /** The child's age, as if it was made `ms` ago. */
  const ageChild = (parentToken: string, ms: number) => {
    const parent = env.sessions.rows.find((r) => r.sessionId === (jwt.decode(parentToken) as { sessionId: string }).sessionId);
    const child = env.sessions.rows.find((r) => r.sessionId === parent?.childId);
    (child as { createdAt: Date }).createdAt = new Date(Date.now() - ms);
  };
  return { env, deps, logs, bound, login, ageChild };
}

describe('refreshReuse', () => {
  it('a rotated token whose child is older than 60 s ends the device sessions, revokes the admin device, logs the user id only', async () => {
    const s = await scene();
    const r0 = await s.login(s.bound.device.strapiDeviceId);
    const other = await s.login('another-device');
    const r1 = await s.env.admin().rotateRefreshToken(r0.token);
    expect(r1.error).toBeUndefined();
    s.ageChild(r0.token, REUSE_GRACE_MS + 1000);
    expect(await refreshReuse(s.deps, r0.token)).toBe(true);
    expect(s.env.sessions.rows.map((r) => r.deviceId)).toEqual(['another-device']);
    expect(s.env.sessions.rows[0].sessionId).toBe(other.sessionId);
    expect((await s.env.c.store.adminDevices(7))[0].revokedAt).not.toBeNull();
    expect(s.logs).toEqual(['[security] admin refresh reuse user=7']);
    expect(s.logs.join()).not.toContain(r0.token);
  });

  it('inside the grace window both calls get through (Strapi answers the same child)', async () => {
    const s = await scene();
    const r0 = await s.login(s.bound.device.strapiDeviceId);
    await s.env.admin().rotateRefreshToken(r0.token);
    expect(await refreshReuse(s.deps, r0.token)).toBe(false);
    const a = await s.env.admin().rotateRefreshToken(r0.token);
    const b = await s.env.admin().rotateRefreshToken(r0.token);
    expect(a.error).toBeUndefined();
    expect(b.sessionId).toBe(a.sessionId);
    expect(await refreshReuse(s.deps, r0.token)).toBe(false);
    expect(s.env.sessions.rows).toHaveLength(2);
    expect((await s.env.c.store.adminDevices(7))[0].revokedAt).toBeNull();
  });

  it('a token at the head of the chain is never flagged, however old', async () => {
    const s = await scene();
    const r0 = await s.login(s.bound.device.strapiDeviceId);
    const r1 = await s.env.admin().rotateRefreshToken(r0.token);
    s.ageChild(r0.token, 10 * REUSE_GRACE_MS);
    expect(await refreshReuse(s.deps, r1.token as string)).toBe(false);
    expect(s.env.sessions.rows).toHaveLength(2);
  });

  it('after the walk-forward is cut off the old token cannot mint another child', async () => {
    const s = await scene();
    const r0 = await s.login(s.bound.device.strapiDeviceId);
    await s.env.admin().rotateRefreshToken(r0.token);
    s.ageChild(r0.token, REUSE_GRACE_MS + 1000);
    await refreshReuse(s.deps, r0.token);
    expect((await s.env.admin().rotateRefreshToken(r0.token)).error).toBe('invalid_refresh_token');
  });

  it('a session without a device id ends every session of that user', async () => {
    const s = await scene();
    const r0 = await s.env.admin().generateRefreshToken('7', '', { type: 'refresh' });
    await s.login('d2');
    await s.env.sessions.login(8);
    await s.env.admin().rotateRefreshToken(r0.token);
    s.ageChild(r0.token, REUSE_GRACE_MS + 1000);
    expect(await refreshReuse(s.deps, r0.token)).toBe(true);
    expect(s.env.sessions.rows.map((r) => r.userId)).toEqual(['8']);
  });

  it('garbage, a token signed with another secret, an access token and an unknown session are left to Strapi', async () => {
    const s = await scene();
    expect(await refreshReuse(s.deps, 'garbage')).toBe(false);
    expect(await refreshReuse(s.deps, jwt.sign({ type: 'refresh', sessionId: 'x', userId: '7' }, 'other-secret'))).toBe(false);
    expect(await refreshReuse(s.deps, jwt.sign({ type: 'access', sessionId: 'x', userId: '7' }, SECRET))).toBe(false);
    expect(await refreshReuse(s.deps, jwt.sign({ type: 'refresh', sessionId: 'nope', userId: '7' }, SECRET))).toBe(false);
  });
});

describe('the middleware', () => {
  const ctxOf = (path: string, method: string, cookie?: string) => {
    const sets: unknown[][] = [];
    return {
      method, path, status: 404, body: null as unknown, sets,
      request: { secure: false, headers: {} },
      cookies: { get: () => cookie, set: (...a: unknown[]) => sets.push(a) },
    };
  };
  const run = async (reuse: boolean, path = '/admin/access-token', method = 'POST', cookie: string | null = 'tok') => {
    const deps = { verify: () => ({ sessionId: 's' }), session: async () => null, end: async () => undefined, revokeDevice: async () => undefined, now: () => new Date(), log: () => undefined } as ReuseDeps;
    const ctx = ctxOf(path, method, cookie ?? undefined);
    const next = vi.fn(async () => undefined);
    const guard = refreshReuseMiddleware(() => ({ ...deps, session: async (id) => (reuse ? ({ sessionId: id, userId: '7', status: id === 's' ? 'rotated' : 'active', childId: 'c', createdAt: new Date(0), deviceId: null } as SessionRecord) : null) }));
    await guard({} as never)(ctx as never, next);
    return { ctx, next };
  };

  it('a reuse answers 401, clears the refresh cookie and does not reach Strapi', async () => {
    adminEnv();
    const { ctx, next } = await run(true);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(401);
    expect(ctx.sets).toHaveLength(1);
    expect(ctx.sets[0][0]).toBe('strapi_admin_refresh');
    expect(ctx.sets[0][1]).toBe('');
    expect((ctx.sets[0][2] as { expires: Date }).expires.getTime()).toBe(0);
  });

  it('a normal refresh, other paths, other methods and a missing cookie pass', async () => {
    adminEnv();
    for (const args of [[false], [true, '/admin/logout'], [true, '/admin/access-token', 'GET'], [true, '/admin/access-token', 'POST', null]] as const) {
      const { ctx, next } = await run(...(args as [boolean, string?, string?, (string | null)?]));
      expect(next).toHaveBeenCalledOnce();
      expect(ctx.status).toBe(404);
    }
  });

  it.each(['/admin/Access-Token', '/admin/access-token/', '/ADMIN/ACCESS-TOKEN/', '/admin/access%2Dtoken'])('a case, trailing-slash or encoded variant is checked too: POST %s (B3 H1)', async (path) => {
    adminEnv();
    const { ctx, next } = await run(true, path);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(401);
  });

  it('the shared normaliser lowercases, strips one trailing slash and decodes once (B3 H1)', () => {
    expect(normalizeAdminPath('/Admin/Access-Token/')).toBe('/admin/access-token');
    expect(normalizeAdminPath('/admin/access%2Dtoken')).toBe('/admin/access-token');
    expect(normalizeAdminPath('/admin/%2561')).toBe('/admin/%61');
    expect(normalizeAdminPath('/')).toBe('/');
    expect(normalizeAdminPath('/admin/%E0%A4%A')).toBe('/admin/%e0%a4%a');
  });

  it('is registered in config/middlewares.ts and builds its store inside the request, not at module load', () => {
    const config = readFileSync(join(__dirname, '../../../../config/middlewares.ts'), 'utf8');
    expect(config).toContain("'global::admin-refresh-reuse'");
    const source = readFileSync(join(__dirname, '../refresh-reuse.ts'), 'utf8');
    expect(source).not.toMatch(/^const .*strapiSecurityStore\(/m);
    expect(source).toMatch(/build\(strapi\)/);
  });
});

describe('issue then reuse, end to end over Strapi sessions', () => {
  it('the cookie of a device that logged in through issueAdminSession is rotated and then flagged as reuse', async () => {
    const s = await scene();
    await issueAdminSession(s.env.ctx, 7, s.bound.device, true);
    const r0 = s.env.sets[0].value;
    await s.env.admin().rotateRefreshToken(r0);
    s.ageChild(r0, REUSE_GRACE_MS + 1);
    expect(await refreshReuse(s.deps, r0)).toBe(true);
    expect(s.env.sessions.rows).toHaveLength(0);
  });
});
