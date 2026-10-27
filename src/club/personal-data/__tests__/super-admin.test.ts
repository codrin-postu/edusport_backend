import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import policy from '../../../policies/is-super-admin';
import { adminSessions, routeAnswer } from '../../__tests__/admin-sessions';
import { hasSuperAdminRole, superAdminFromMe } from '../roles';
import type { AdminUserStrapi } from '../../admin-auth';
import { isSuperAdminRequest } from '../super-admin';

const SECRET = 'test-secret';
const SUPER = [{ code: 'strapi-super-admin' }];
const USERS: Record<number, unknown> = {
  1: { id: 1, isActive: true, blocked: false, roles: SUPER },
  2: { id: 2, isActive: true, blocked: false, roles: [{ code: 'strapi-editor' }] },
  3: { id: 3, isActive: false, blocked: false, roles: SUPER },
  4: { id: 4, isActive: true, blocked: true, roles: SUPER },
  5: { id: 5, roles: SUPER },
};
const sessions = adminSessions(SECRET);
const asked: unknown[] = [];
const strapi: AdminUserStrapi = {
  sessionManager: sessions.sessionManager,
  db: { query: () => ({ findOne: async (args) => { asked.push(args); return USERS[Number(args.where.id)] ?? null; } }) },
};
const accessOf = async (userId: number) => (await sessions.login(userId)).access;

describe('global::is-super-admin (3C spec 6)', () => {
  it('allows a Super Admin, loading the admin with roles', async () => {
    expect(await isSuperAdminRequest(await accessOf(1), strapi)).toBe(true);
    expect(asked.at(-1)).toEqual({ where: { id: 1 }, populate: ['roles'] });
  });

  it('refuses (403) a normal admin and a blocked Super Admin', async () => {
    expect(await isSuperAdminRequest(await accessOf(2), strapi)).toBe(false);
    expect(await isSuperAdminRequest(await accessOf(4), strapi)).toBe(false);
  });

  it('a wrong signature or no token is unauthenticated (401), not forbidden', async () => {
    const { sessionId } = await sessions.login(1);
    const otherSecret = `Bearer ${jwt.sign({ userId: '1', sessionId, type: 'access' }, 'other')}`;
    await expect(isSuperAdminRequest(otherSecret, strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(isSuperAdminRequest(undefined, strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('an unknown admin, or a Super Admin inactive or not marked active, is 401 as in Strapi', async () => {
    await expect(isSuperAdminRequest(await accessOf(9), strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(isSuperAdminRequest(await accessOf(3), strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(isSuperAdminRequest(await accessOf(5), strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it("a Super Admin's refresh token or the access token of an ended session is 401", async () => {
    const live = await sessions.login(1);
    await expect(isSuperAdminRequest(live.refresh, strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
    sessions.expire(live.sessionId);
    await expect(isSuperAdminRequest(live.access, strapi)).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('ignores a role claim in the token: the roles come from the database', async () => {
    const { sessionId } = await sessions.login(2);
    const forged = `Bearer ${jwt.sign({ userId: '2', sessionId, type: 'access', roles: SUPER, isSuperAdmin: true }, SECRET)}`;
    expect(await isSuperAdminRequest(forged, strapi)).toBe(false);
  });

  it('through Strapi: a Super Admin passes, a normal admin gets 403, no token 401', async () => {
    const statusOf = async (authorization?: string) => (await routeAnswer(policy, authorization, strapi)).status;
    expect(await statusOf(await accessOf(1))).toBe(200);
    expect(await statusOf(await accessOf(2))).toBe(403);
    expect(await statusOf(await accessOf(4))).toBe(403);
    expect(await statusOf(await accessOf(3))).toBe(401);
    expect(await statusOf()).toBe(401);
    const core = strapi as unknown as Core.Strapi;
    expect(await policy({ request: { header: { authorization: await accessOf(1) } } }, {}, { strapi: core })).toBe(true);
  });

  it('the admin UI reads the role from /admin/users/me', () => {
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-super-admin' }] } })).toBe(true);
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-author' }] } })).toBe(false);
    expect(superAdminFromMe(null)).toBe(false);
    expect(hasSuperAdminRole({ roles: 'strapi-super-admin' })).toBe(false);
  });

  it('roles.ts stays importable by the admin bundle (no jsonwebtoken, no Node modules)', () => {
    const src = readFileSync(join(__dirname, '..', 'roles.ts'), 'utf8');
    expect(src).not.toMatch(/from '(jsonwebtoken|node:|\.\.\/admin-actor)/);
  });
});

describe('startup sweep is wired (3C spec 4)', () => {
  it('bootstrap starts it without awaiting it', () => {
    const index = readFileSync(join(__dirname, '..', '..', '..', 'index.ts'), 'utf8');
    expect(index).toMatch(/^\s+startPersonalDataSweep\(strapi\);$/m);
  });
});
