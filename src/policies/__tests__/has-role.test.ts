import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminSessions, routeAnswer } from '../../club/__tests__/admin-sessions';
import type { AdminUserStrapi } from '../../club/admin-auth';
import { summaryFor, type ClubSummary } from '../../club/roles/summary';
import hasRole from '../has-role';
import isAdmin from '../is-admin';
import isSuperAdmin from '../is-super-admin';

const role = (code: string) => [{ code }];
const USERS: Record<number, unknown> = {
  1: { id: 1, isActive: true, blocked: false, roles: role('strapi-super-admin') },
  2: { id: 2, isActive: true, blocked: false, roles: role('edusport-club-admin') },
  3: { id: 3, isActive: true, blocked: false, roles: role('edusport-site-editor') },
  4: { id: 4, isActive: true, blocked: true, roles: role('strapi-super-admin') },
  5: { id: 5, isActive: true, blocked: false, roles: role('strapi-editor') },
};
const sessions = adminSessions('test-secret');
const warn = vi.fn();
const strapi = { sessionManager: sessions.sessionManager, db: { query: () => ({ findOne: async (a: { where: { id: unknown } }) => USERS[Number(a.where.id)] ?? null }) }, log: { warn } } as AdminUserStrapi & { log: { warn: typeof warn } };
const core = strapi as unknown as Core.Strapi;
const tokenOf = async (id: number) => (await sessions.login(id)).access;
const call = async (id: number, area: unknown, state: Record<string, unknown> = {}) =>
  hasRole({ request: { header: { authorization: await tokenOf(id) } }, state }, { area }, { strapi: core });

const saved = { flag: process.env.HAS_ROLE_ENFORCED, env: process.env.NODE_ENV };
beforeEach(() => { warn.mockClear(); process.env.HAS_ROLE_ENFORCED = 'true'; });
afterEach(() => {
  if (saved.flag === undefined) delete process.env.HAS_ROLE_ENFORCED; else process.env.HAS_ROLE_ENFORCED = saved.flag;
  process.env.NODE_ENV = saved.env;
});

describe('global::has-role', () => {
  it('lets a role through for its areas and refuses others with 403', async () => {
    expect(await call(2, 'club')).toBe(true);
    expect(await call(3, 'website')).toBe(true);
    expect(await call(1, 'superAdmin')).toBe(true);
    await expect(call(3, 'club')).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call(2, 'superAdmin')).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call(5, 'website')).rejects.toBeInstanceOf(errors.ForbiddenError);
    expect(await call(5, 'any')).toBe(true);
  });

  it('answers 401 without a session and for a blocked admin, 500 for an unknown area', async () => {
    await expect(hasRole({ request: { header: {} } }, { area: 'any' }, { strapi: core })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(call(4, 'any')).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(call(2, 'nope')).rejects.toThrow(Error);
    await expect(call(2, undefined)).rejects.not.toBeInstanceOf(errors.HttpError);
  });

  it('blocked admin is refused (401) by is-admin, is-super-admin and has-role', async () => {
    const status = async (policy: Parameters<typeof routeAnswer>[0]) => (await routeAnswer(policy, await tokenOf(4), strapi)).status;
    expect(await status(isAdmin as never)).toBe(401);
    expect(await status(isSuperAdmin as never)).toBe(401);
    expect(await status(((c: never, _cfg: never, d: never) => hasRole(c, { area: 'any' }, d)) as never)).toBe(401);
  });

  it('is-admin lets any admin through, is-super-admin only the Super Admin', async () => {
    const run = async (policy: typeof isAdmin, id: number) => policy({ request: { header: { authorization: await tokenOf(id) } } }, {}, { strapi: core });
    expect(await run(isAdmin, 5)).toBe(true);
    expect(await run(isSuperAdmin, 1)).toBe(true);
    await expect(run(isSuperAdmin, 2)).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('with enforcement off, a refusal is one log line and the request passes', async () => {
    process.env.HAS_ROLE_ENFORCED = 'false';
    expect(await call(3, 'club')).toBe(true);
    expect(warn.mock.calls).toEqual([['[has-role] would refuse club for 3']]);
  });

  it('the superAdmin area is enforced even with HAS_ROLE_ENFORCED=false', async () => {
    process.env.HAS_ROLE_ENFORCED = 'false';
    await expect(call(3, 'superAdmin')).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call(2, 'superAdmin')).rejects.toBeInstanceOf(errors.ForbiddenError);
    expect(await call(1, 'superAdmin')).toBe(true);
    const status = async (policy: Parameters<typeof routeAnswer>[0]) => (await routeAnswer(policy, await tokenOf(3), strapi)).status;
    expect(await status(isSuperAdmin as never)).toBe(403);
    expect(warn).not.toHaveBeenCalled();
  });

  it('in production an unset variable means off; outside production it means on', async () => {
    delete process.env.HAS_ROLE_ENFORCED;
    process.env.NODE_ENV = 'production';
    expect(await call(3, 'club')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('[has-role] would refuse club for 3');
    process.env.NODE_ENV = 'development';
    await expect(call(3, 'club')).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('puts the areas of the admin on the policy state', async () => {
    const state: Record<string, unknown> = {};
    await call(3, 'website', state);
    expect([...(state.adminAreas as string[])].sort()).toEqual(['any', 'website']);
  });
});

describe('summaryFor', () => {
  const counts: ClubSummary = { seasons: 1, sections: 2, groups: 3, athletes: 4, activeAthletes: 5, priceLists: 6, numberedRegistrations: 7 };
  it('gives a site editor only the price lists and the club admin all seven counts', () => {
    expect(summaryFor(counts, new Set(['any', 'website']))).toEqual({ priceLists: 6 });
    expect(summaryFor(counts, new Set(['any', 'website', 'club', 'money', 'coachAccounts', 'settings']))).toEqual(counts);
  });
});
