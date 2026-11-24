import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminSessions } from '../../__tests__/admin-sessions';
import { areaOfRoute } from '../../admin-area';
import type { AdminUserStrapi } from '../../admin-auth';
import hasRole from '../../../policies/has-role';

type Route = { method: string; path: string; config: unknown };

describe('Funcții routes', () => {
  it('GET is area any, PUT is area superAdmin', async () => {
    const routes = ((await import(join(__dirname, '../../../api/club/routes/15-features.ts'))) as { default: { routes: Route[] } }).default.routes;
    const area = (m: string) => areaOfRoute(routes.find((r) => r.method === m && r.path === '/club/features')!.config);
    expect(area('GET')).toBe('any');
    expect(area('PUT')).toBe('superAdmin');
  });

  describe('PUT with HAS_ROLE_ENFORCED=false', () => {
    const saved = process.env.HAS_ROLE_ENFORCED;
    beforeEach(() => { process.env.HAS_ROLE_ENFORCED = 'false'; });
    afterEach(() => { if (saved === undefined) delete process.env.HAS_ROLE_ENFORCED; else process.env.HAS_ROLE_ENFORCED = saved; });

    it('still refuses a Club admin (403)', async () => {
      const sessions = adminSessions('test-secret');
      const users: Record<number, unknown> = { 2: { id: 2, isActive: true, blocked: false, roles: [{ code: 'edusport-club-admin' }] } };
      const strapi = { sessionManager: sessions.sessionManager, db: { query: () => ({ findOne: async (a: { where: { id: unknown } }) => users[Number(a.where.id)] ?? null }) }, log: { warn: () => undefined } } as unknown as AdminUserStrapi;
      const token = (await sessions.login(2)).access;
      await expect(hasRole({ request: { header: { authorization: token } }, state: {} }, { area: 'superAdmin' }, { strapi: strapi as unknown as Core.Strapi })).rejects.toMatchObject({ name: 'ForbiddenError' });
    });
  });
});
