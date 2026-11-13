import type { Core } from '@strapi/strapi';
import { beforeAll, describe, expect, it } from 'vitest';
import { adminSessions } from '../../__tests__/admin-sessions';
import { areaOfRoute } from '../../admin-area';
import type { AdminUserStrapi } from '../../admin-auth';
import hasRole from '../../../policies/has-role';
import { canUse } from '../map';
import { loadRoutes, type LoadedRoute } from './route-files';

const ROLES: Record<string, string[]> = {
  superAdmin: ['strapi-super-admin'],
  clubAdmin: ['edusport-club-admin'],
  siteEditor: ['edusport-site-editor'],
  strapiEditorOnly: ['strapi-editor'],
};
const ids = Object.keys(ROLES);
const sessions = adminSessions('matrix-secret');
const strapi = {
  sessionManager: sessions.sessionManager,
  db: { query: () => ({ findOne: async (a: { where: { id: number } }) => ({ id: a.where.id, isActive: true, blocked: false, roles: ROLES[ids[a.where.id - 1]].map((code) => ({ code })) }) }) },
  log: { warn: () => undefined },
} as unknown as AdminUserStrapi & Core.Strapi;

describe('role x route matrix', () => {
  let adminRoutes: LoadedRoute[] = [];
  beforeAll(async () => {
    process.env.HAS_ROLE_ENFORCED = 'true';
    adminRoutes = (await loadRoutes()).routes.filter((r) => areaOfRoute(r.config) !== null);
  });

  ids.forEach((name, i) => {
    it(`${name}: every admin route resolves or answers 403 as the role map says`, async () => {
      const authorization = (await sessions.login(i + 1)).access;
      expect(adminRoutes.length).toBeGreaterThan(150);
      for (const r of adminRoutes) {
        const area = areaOfRoute(r.config)!;
        const outcome = await hasRole({ request: { header: { authorization } } }, { area }, { strapi }).then(() => 'allowed', (e: { name?: string }) => (e.name === 'ForbiddenError' ? 403 : e.name));
        expect(outcome, `${name} ${r.method} ${r.path} (${area})`).toBe(canUse(ROLES[name], area) ? 'allowed' : 403);
      }
    });
  });
});
