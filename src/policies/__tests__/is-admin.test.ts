import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { adminSessions, routeAnswer } from '../../club/__tests__/admin-sessions';
import { verifiedAdminId, warnIfNoAdminSessions, type AdminUserStrapi } from '../../club/admin-auth';
import isAdmin from '../is-admin';

const SECRET = 'test-secret';
const USERS: Record<number, unknown> = {
  7: { id: 7, isActive: true, roles: [] },
  8: { id: 8, isActive: true, roles: [] },
  9: { id: 9, isActive: true, roles: [] },
  10: { id: 10, isActive: false, roles: [] },
  12: { id: 12, roles: [] },
};
const sessions = adminSessions(SECRET);
const findOne = vi.fn(async (args: { where: { id: unknown } }) => USERS[Number(args.where.id)] ?? null);
const strapi: AdminUserStrapi = { sessionManager: sessions.sessionManager, db: { query: () => ({ findOne }) } };
const statusOf = async (authorization: string | undefined) => (await routeAnswer(isAdmin, authorization, strapi)).status;
const UNAUTHORIZED = { data: null, error: { status: 401, name: 'UnauthorizedError', message: 'Missing or invalid credentials', details: {} } };

describe('global::is-admin: as Strapi admin auth, an access token of an active session of an active admin', () => {
  it('accepts an active admin with a valid access token, reading the admin once', async () => {
    const { access } = await sessions.login(7);
    findOne.mockClear();
    expect(await statusOf(access)).toBe(200);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 }, populate: ['roles'] });
    expect(await isAdmin({ request: { header: { authorization: access } } }, {}, { strapi: strapi as unknown as Core.Strapi })).toBe(true);
  });

  it('answers 401 for a deactivated, not-marked-active or unknown admin with a valid session', async () => {
    expect(await statusOf((await sessions.login(10)).access)).toBe(401);
    expect(await statusOf((await sessions.login(12)).access)).toBe(401);
    expect(await statusOf((await sessions.login(11)).access)).toBe(401);
  });

  it("answers 401 in Strapi's error shape, so the admin client refreshes the token and retries", async () => {
    expect(await routeAnswer(isAdmin, undefined, strapi)).toEqual({ status: 401, body: UNAUTHORIZED });
    const call = isAdmin({ request: { header: {} } }, {}, { strapi: strapi as unknown as Core.Strapi });
    await expect(call).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('answers 401 for an expired access token and for a refresh token', async () => {
    const { sessionId, refresh } = await sessions.login(7);
    const expired = jwt.sign({ userId: '7', sessionId, type: 'access', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    expect(await statusOf(`Bearer ${expired}`)).toBe(401);
    expect(await statusOf(refresh)).toBe(401);
  });

  it('answers 401 for the access token of a logged-out or expired session', async () => {
    const out = await sessions.login(8);
    await sessions.logout(8);
    expect(await statusOf(out.access)).toBe(401);
    const old = await sessions.login(9);
    sessions.expire(old.sessionId);
    expect(await statusOf(old.access)).toBe(401);
  });

  it('answers 401 for another scheme, a wrong signature and an unknown session', async () => {
    const { sessionId } = await sessions.login(7);
    expect(await statusOf(`Basic ${jwt.sign({ userId: '7', sessionId, type: 'access' }, SECRET)}`)).toBe(401);
    expect(await statusOf(`Bearer ${jwt.sign({ userId: '7', sessionId, type: 'access' }, 'other')}`)).toBe(401);
    expect(await statusOf(`Bearer ${jwt.sign({ userId: '7', sessionId: 'gone', type: 'access' }, SECRET)}`)).toBe(401);
  });
});

describe('without a session manager every token is refused', () => {
  it('a valid access token of a live session gives no admin and 401', async () => {
    const { access } = await sessions.login(7);
    const bare: AdminUserStrapi = { db: strapi.db };
    expect(await verifiedAdminId(access, bare)).toBeNull();
    expect(await routeAnswer(isAdmin, access, bare)).toEqual({ status: 401, body: UNAUTHORIZED });
  });

  it('startup logs it once when the session manager is missing or its getter throws, never when present', () => {
    const error = vi.fn();
    const present = { log: { error }, sessionManager: sessions.sessionManager };
    warnIfNoAdminSessions(present);
    expect(error).not.toHaveBeenCalled();
    warnIfNoAdminSessions({ log: { error } });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('no admin session manager');
    const throwing = { log: { error }, get sessionManager(): never { throw new Error('no such service'); } };
    warnIfNoAdminSessions(throwing);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('bootstrap runs the startup check', () => {
    expect(readFileSync(join(__dirname, '..', '..', 'index.ts'), 'utf8')).toMatch(/^\s+warnIfNoAdminSessions\(strapi\);$/m);
  });
});
