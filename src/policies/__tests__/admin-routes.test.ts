import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import accessRoutes from '../../api/club/routes/14-athlete-access';
import accountRoutes from '../../api/club/routes/12-portal-accounts';
import isAdmin from '../is-admin';

type Policy = { name: string; config?: unknown } | string;
const strapi = {} as unknown as Core.Strapi;

/** The policies each route runs, run for a request that carries no admin token. */
describe('athlete access and disable-all routes refuse a request without an admin session', () => {
  const routes = [...accessRoutes.routes, ...accountRoutes.routes.filter((r) => r.path.endsWith('/disable-all'))];
  it('covers the new routes', () => {
    expect(routes.length).toBe(7);
  });
  for (const r of routes) {
    it(`${r.method} ${r.path}`, async () => {
      const policies = (r.config as { policies: Policy[] }).policies;
      expect(policies.length).toBeGreaterThan(0);
      for (const p of policies) {
        const name = typeof p === 'string' ? p : p.name;
        expect(name).toBe('global::is-admin');
        await expect(isAdmin({ request: { header: {} } }, typeof p === 'string' ? {} : p.config, { strapi })).rejects.toThrow();
        await expect(isAdmin({ request: { header: { authorization: 'Bearer not-a-token' } } }, {}, { strapi })).rejects.toThrow();
      }
    });
  }
});
