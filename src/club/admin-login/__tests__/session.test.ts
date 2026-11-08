import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminByEmail, adminById, adminName, canEnterAdmin, type AdminRow } from '../admins';
import { ADMIN_DEVICE_COOKIE, bindAdminDevice, disconnectAdminDevice, listAdminDevices, rememberDevice, rememberedDevice } from '../devices';
import { REMEMBER_MS } from '../../security/remembered';
import { endAdminSessions, issueAdminSession } from '../session';
import { adminEnv } from './admin-env';

const requireCjs = createRequire(__filename);
const sessionAuth = requireCjs(join(dirname(requireCjs.resolve('@strapi/admin/package.json')), 'dist', 'server', 'shared', 'utils', 'session-auth.js')) as {
  REFRESH_COOKIE_NAME: string;
  buildCookieOptionsWithExpiry: (type: 'session' | 'refresh', abs: string, secure: boolean) => Record<string, unknown>;
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const bindOnly = (env: ReturnType<typeof adminEnv>, adminId: number, cookie: string | null) =>
  bindAdminDevice({ store: env.c.store, now: env.c.now, userAgent: 'Mozilla/5.0 Chrome/120.0' }, adminId, cookie);
/** A device a completed sign-in has confirmed (a bare bind makes an unconfirmed one). */
const bind = async (env: ReturnType<typeof adminEnv>, adminId: number, cookie: string | null) => {
  const out = await bindOnly(env, adminId, cookie);
  await env.c.store.updateAdminDevice(out.device.id, { confirmedAt: env.c.now().toISOString() });
  return out;
};

describe('issueAdminSession', () => {
  it('remember: a refresh session, the cookie with the options Strapi builds, an access token for the admin', async () => {
    const env = adminEnv();
    const { device } = await bind(env, 7, null);
    const out = await issueAdminSession(env.ctx, 7, device, true);
    expect(env.sessions.rows).toHaveLength(1);
    expect(env.sessions.rows[0].type).toBe('refresh');
    expect(env.sets).toHaveLength(1);
    const [set] = env.sets;
    expect(set.name).toBe('strapi_admin_refresh');
    expect(set.name).toBe(sessionAuth.REFRESH_COOKIE_NAME);
    const absolute = new Date(env.sessions.rows[0].absoluteExpiresAt as Date).toISOString();
    expect(set.options).toMatchObject({ ...sessionAuth.buildCookieOptionsWithExpiry('refresh', absolute, false), expires: expect.any(Date), maxAge: expect.any(Number) });
    expect(set.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/admin' });
    const checked = env.admin().validateAccessToken(out.accessToken);
    expect(checked.isValid).toBe(true);
    expect(checked.payload?.userId).toBe('7');
  });

  it('without remember: type session and a session cookie (no expiry)', async () => {
    const env = adminEnv();
    const { device } = await bind(env, 7, null);
    await issueAdminSession(env.ctx, 7, device, false);
    expect(env.sessions.rows[0].type).toBe('session');
    expect(env.sets[0].options.expires).toBeUndefined();
    expect(env.sets[0].options.maxAge).toBeUndefined();
  });

  it("the session's deviceId is the device row's strapiDeviceId, and the user agent is kept as metadata", async () => {
    const env = adminEnv();
    const { device } = await bind(env, 7, null);
    const out = await issueAdminSession(env.ctx, 7, device, true);
    const sessionId = env.admin().validateAccessToken(out.accessToken).payload?.sessionId;
    const row = env.sessions.rows.find((r) => r.sessionId === sessionId);
    expect(row?.deviceId).toBe(device.strapiDeviceId);
  });

  it('a second login on the same device leaves one session family for it', async () => {
    const env = adminEnv();
    const { device } = await bind(env, 7, null);
    const first = await issueAdminSession(env.ctx, 7, device, true);
    const second = await issueAdminSession(env.ctx, 7, device, true);
    expect(env.sessions.rows.filter((r) => r.deviceId === device.strapiDeviceId)).toHaveLength(1);
    const sessionId = env.admin().validateAccessToken(second.accessToken).payload?.sessionId;
    expect(env.sessions.rows[0].sessionId).toBe(sessionId);
    expect(first.accessToken).not.toBe(second.accessToken);
  });

  it('an error answer from Strapi throws', async () => {
    const env = adminEnv();
    const { device } = await bind(env, 7, null);
    const broken = { ...env.ctx, strapi: { ...env.strapi, sessionManager: () => ({ ...env.admin(), generateAccessToken: async () => ({ error: 'invalid_refresh_token' }), invalidateRefreshToken: async () => undefined, generateRefreshToken: async () => ({ token: 't', sessionId: 's', absoluteExpiresAt: new Date().toISOString() }) }) } as never };
    await expect(issueAdminSession(broken, 7, device, true)).rejects.toThrow();
    expect(env.sets).toHaveLength(0);
  });
});

describe('bindAdminDevice', () => {
  it('no cookie: a new 43-character key, a row holding only its SHA-256; the same key again: the same row, no new key, lastSeenAt moved', async () => {
    const env = adminEnv();
    const first = await bind(env, 7, null);
    expect(first.isNew).toBe(true);
    expect(first.newKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.device.deviceKeyHash).toBe(sha(first.newKey as string));
    expect(first.device.strapiDeviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(await env.c.store.adminDevices(7))).not.toContain(first.newKey as string);
    env.advance(60_000);
    const again = await bind(env, 7, first.newKey);
    expect(again.isNew).toBe(false);
    expect(again.newKey).toBeNull();
    expect(again.device.id).toBe(first.device.id);
    expect(again.device.lastSeenAt).toBe(env.clock.t.toISOString());
    expect(await env.c.store.adminDevices(7)).toHaveLength(1);
  });

  it("another admin's key makes a new row for this admin", async () => {
    const env = adminEnv();
    const other = await bind(env, 8, null);
    const mine = await bind(env, 7, other.newKey);
    expect(mine.isNew).toBe(true);
    expect(mine.newKey).not.toBeNull();
    expect(mine.device.adminUserId).toBe(7);
    expect(mine.device.id).not.toBe(other.device.id);
  });

  it('a revoked device is not reused: the key makes a new row', async () => {
    const env = adminEnv();
    const first = await bind(env, 7, null);
    await env.c.store.updateAdminDevice(first.device.id, { revokedAt: env.clock.t.toISOString() });
    const again = await bind(env, 7, first.newKey);
    expect(again.isNew).toBe(true);
    expect(again.device.id).not.toBe(first.device.id);
  });

  it('the cookie name: __Host- on a secure request, plain locally', () => {
    expect(ADMIN_DEVICE_COOKIE(true)).toBe('__Host-es_adm_dev');
    expect(ADMIN_DEVICE_COOKIE(false)).toBe('es_adm_dev');
  });
});

describe('listAdminDevices and disconnectAdminDevice', () => {
  async function twoDevices() {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    const b = await bind(env, 7, null);
    await issueAdminSession(env.ctx, 7, a.device, true);
    await issueAdminSession(env.ctx, 7, b.device, true);
    await env.c.store.updateAdminDevice(a.device.id, { twoFactorUntil: '2026-12-01T00:00:00.000Z' });
    return { env, a, b };
  }

  it('lists live devices, marks the one of the cookie, leaves revoked ones out', async () => {
    const { env, a, b } = await twoDevices();
    const list = await listAdminDevices(env.c.store, 7, a.newKey);
    expect(list.map((d) => [d.id, d.current])).toEqual([[a.device.id, true], [b.device.id, false]]);
    expect(list[0]).toMatchObject({ label: expect.any(String), twoFactorUntil: '2026-12-01T00:00:00.000Z' });
    await env.c.store.updateAdminDevice(b.device.id, { revokedAt: env.clock.t.toISOString() });
    expect((await listAdminDevices(env.c.store, 7, null)).map((d) => d.id)).toEqual([a.device.id]);
  });

  it('disconnect ends only that device, sets revokedAt, forgets its 2FA and answers revokedCurrent', async () => {
    const { env, a, b } = await twoDevices();
    const out = await disconnectAdminDevice(env.ctx, 7, a.device.id, b.newKey);
    expect(out).toEqual({ ok: true, data: { revokedCurrent: false } });
    expect(env.sessions.rows.map((r) => r.deviceId)).toEqual([b.device.strapiDeviceId]);
    const devices = await env.c.store.adminDevices(7);
    expect(devices.find((d) => d.id === a.device.id)).toMatchObject({ revokedAt: env.clock.t.toISOString(), twoFactorUntil: null });
    expect(devices.find((d) => d.id === b.device.id)?.revokedAt).toBeNull();
    const own = await disconnectAdminDevice(env.ctx, 7, b.device.id, b.newKey);
    expect(own).toEqual({ ok: true, data: { revokedCurrent: true } });
    expect(env.sessions.rows).toHaveLength(0);
  });

  it('a device of another admin or an unknown id is 404 and ends nothing', async () => {
    const { env, a } = await twoDevices();
    const out = await disconnectAdminDevice(env.ctx, 9, a.device.id, null);
    expect(out).toMatchObject({ ok: false, status: 404 });
    expect(await disconnectAdminDevice(env.ctx, 7, 'nope', null)).toMatchObject({ ok: false, status: 404 });
    expect(env.sessions.rows).toHaveLength(2);
  });
});

describe('endAdminSessions', () => {
  it('exceptDevice keeps that device session and clears the others twoFactorUntil; without it every session ends', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    const b = await bind(env, 7, null);
    const other = await bind(env, 8, null);
    await issueAdminSession(env.ctx, 7, a.device, true);
    await issueAdminSession(env.ctx, 7, b.device, true);
    await issueAdminSession(env.ctx, 8, other.device, true);
    const until = '2026-12-01T00:00:00.000Z';
    for (const d of [a.device, b.device, other.device]) await env.c.store.updateAdminDevice(d.id, { twoFactorUntil: until });
    await endAdminSessions(env.ctx, 7, { exceptDevice: a.device.id });
    expect(env.sessions.rows.map((r) => r.userId + ':' + r.deviceId).sort()).toEqual([`7:${a.device.strapiDeviceId}`, `8:${other.device.strapiDeviceId}`].sort());
    const mine = await env.c.store.adminDevices(7);
    expect(mine.find((d) => d.id === a.device.id)?.twoFactorUntil).toBe(until);
    expect(mine.find((d) => d.id === b.device.id)?.twoFactorUntil).toBeNull();
    expect((await env.c.store.adminDevices(8))[0].twoFactorUntil).toBe(until);
    await endAdminSessions(env.ctx, 7, {});
    expect(env.sessions.rows.map((r) => r.userId)).toEqual(['8']);
    expect((await env.c.store.adminDevices(7)).every((d) => d.twoFactorUntil === null)).toBe(true);
  });

  it('exceptDevice also ends a session that has no device row (opened before the deploy)', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    await issueAdminSession(env.ctx, 7, a.device, true);
    await env.sessions.login(7, 'strapi-own-device');
    await endAdminSessions(env.ctx, 7, { exceptDevice: a.device.id });
    expect(env.sessions.rows.map((r) => r.deviceId)).toEqual([a.device.strapiDeviceId]);
  });
});

describe('endAdminSessions, sessions without any device id (B3 L2)', () => {
  it('exceptDevice revokes a session whose deviceId is empty, by its session id', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    await issueAdminSession(env.ctx, 7, a.device, true);
    await env.sessions.login(7, '');
    await env.sessions.login(8, '');
    expect(env.sessions.rows).toHaveLength(3);
    await endAdminSessions(env.ctx, 7, { exceptDevice: a.device.id });
    expect(env.sessions.rows.map((r) => `${r.userId}:${r.deviceId}`).sort()).toEqual([`7:${a.device.strapiDeviceId}`, '8:undefined'].sort());
  });
});

describe('admins', () => {
  const row = (o: Partial<AdminRow> = {}): AdminRow => ({ id: 1, email: 'a@x.ro', firstname: null, lastname: null, isActive: true, blocked: false, passwordHash: 'h', roleCodes: [], ...o });

  it('canEnterAdmin: inactive no, blocked true no, blocked null and active yes, no admin no', () => {
    expect(canEnterAdmin(row({ isActive: false }))).toBe(false);
    expect(canEnterAdmin(row({ blocked: true }))).toBe(false);
    expect(canEnterAdmin(row({ blocked: null }))).toBe(true);
    expect(canEnterAdmin(row())).toBe(true);
    expect(canEnterAdmin(null)).toBe(false);
  });

  it('adminName: first and last name trimmed, else the e-mail', () => {
    expect(adminName(row({ firstname: ' Ana ', lastname: 'Pop ' }))).toBe('Ana Pop');
    expect(adminName(row({ firstname: 'Ana' }))).toBe('Ana');
    expect(adminName(row())).toBe('a@x.ro');
  });

  it('adminByEmail is case-insensitive; adminById reads role codes and the password hash', async () => {
    const env = adminEnv();
    env.addAdmin({ id: 4, email: 'Ana@X.ro', password: 'hash', blocked: null, roles: [{ code: 'strapi-super-admin' }] });
    const byEmail = await adminByEmail(env.strapi as never, 'ana@x.ro');
    expect(byEmail).toEqual({ id: 4, email: 'Ana@X.ro', firstname: null, lastname: null, isActive: true, blocked: null, passwordHash: 'hash', roleCodes: ['strapi-super-admin'] });
    expect(await adminById(env.strapi as never, 4)).toEqual(byEmail);
    expect(await adminByEmail(env.strapi as never, 'nobody@x.ro')).toBeNull();
    expect(await adminById(env.strapi as never, 99)).toBeNull();
  });
});

describe('remembered devices (B2 L6)', () => {
  it('rememberDevice marks only the row of the pending hash, for 30 days, and only when the cookie sent is that device', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    const b = await bind(env, 7, null);
    expect(await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, b.newKey, env.clock.t)).toBe(false);
    expect(await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, null, env.clock.t)).toBe(false);
    expect(await rememberDevice(env.c.store, 7, null, a.newKey, env.clock.t)).toBe(false);
    expect((await env.c.store.adminDevices(7)).every((d) => d.twoFactorUntil === null)).toBe(true);
    expect(await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, a.newKey, env.clock.t)).toBe(true);
    const rows = await env.c.store.adminDevices(7);
    expect(rows.find((d) => d.id === a.device.id)?.twoFactorUntil).toBe(new Date(env.clock.t.getTime() + REMEMBER_MS).toISOString());
    expect(rows.find((d) => d.id === b.device.id)?.twoFactorUntil).toBeNull();
  });

  it('a revoked row is never marked and is not remembered even with a future date', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    await env.c.store.updateAdminDevice(a.device.id, { revokedAt: env.clock.t.toISOString() });
    expect(await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, a.newKey, env.clock.t)).toBe(false);
    await env.c.store.updateAdminDevice(a.device.id, { twoFactorUntil: new Date(env.clock.t.getTime() + 1000).toISOString() });
    expect(await rememberedDevice(env.c.store, 7, a.newKey, env.clock.t)).toBeNull();
  });

  it('rememberedDevice: remembered until the end date, forgotten from exactly 30 days, and a device of another admin never counts', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, a.newKey, env.clock.t);
    expect((await rememberedDevice(env.c.store, 7, a.newKey, env.clock.t))?.id).toBe(a.device.id);
    env.advance(REMEMBER_MS - 1);
    expect(await rememberedDevice(env.c.store, 7, a.newKey, env.clock.t)).not.toBeNull();
    env.advance(1);
    expect(await rememberedDevice(env.c.store, 7, a.newKey, env.clock.t)).toBeNull();
    expect(await rememberedDevice(env.c.store, 8, a.newKey, env.clock.t)).toBeNull();
    expect(await rememberedDevice(env.c.store, 7, null, env.clock.t)).toBeNull();
  });

  it('a password change (endAdminSessions with the own device kept) forgets the other devices', async () => {
    const env = adminEnv();
    const a = await bind(env, 7, null);
    const b = await bind(env, 7, null);
    await rememberDevice(env.c.store, 7, a.device.deviceKeyHash, a.newKey, env.clock.t);
    await rememberDevice(env.c.store, 7, b.device.deviceKeyHash, b.newKey, env.clock.t);
    await endAdminSessions(env.ctx, 7, { exceptDevice: a.device.id });
    expect(await rememberedDevice(env.c.store, 7, a.newKey, env.clock.t)).not.toBeNull();
    expect(await rememberedDevice(env.c.store, 7, b.newKey, env.clock.t)).toBeNull();
  });
});
