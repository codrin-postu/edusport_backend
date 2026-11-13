import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADMIN_AREAS, areaOfRoute } from '../../admin-area';
import { loadRoutes, type Route } from './route-files';

const PUBLIC_FILES = /(^portal\/|\/01-[^/]+$)/;
const PUBLIC_PATHS = ['/club/schedule', '/forms/inscriere/documents'];
const rolePolicies = (r: Route) => (r.config?.policies ?? []).filter((p) => typeof p === 'object' && p !== null && (p as { name?: unknown }).name === 'global::has-role');

describe('every admin route names a known area', () => {
  it('has exactly one global::has-role policy with an area of ADMIN_AREAS, or is public or portal', async () => {
    const { routes } = await loadRoutes();
    let admin = 0;
    for (const r of routes) {
      const label = `${r.file} ${r.method} ${r.path}`;
      const policies = rolePolicies(r);
      if (policies.length === 0) {
        const isPublic = PUBLIC_FILES.test(r.file) || PUBLIC_PATHS.includes(r.path);
        expect(isPublic, `${label} has no area and is not on the public allow-list`).toBe(true);
        continue;
      }
      expect(policies.length, label).toBe(1);
      expect(r.config?.policies?.length, label).toBe(1);
      expect(ADMIN_AREAS, label).toContain(areaOfRoute(r.config));
      admin += 1;
    }
    expect(admin).toBeGreaterThan(150);
  });

  it('no route file names global::is-admin or global::is-super-admin', async () => {
    const { files } = await loadRoutes();
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/global::is-(super-)?admin/);
  });
});

describe('route table', () => {
  it('gives the routes of the redesign their area', async () => {
    const { routes } = await loadRoutes();
    const area = (method: string, path: string) => areaOfRoute(routes.find((r) => r.method === method && r.path === path)?.config);
    expect(area('GET', '/club/attendance/coaches.csv')).toBe('money');
    expect(area('POST', '/club/payments')).toBe('club');
    expect(area('GET', '/club/money/overview')).toBe('money');
    expect(area('POST', '/club/athletes/anonymize')).toBe('superAdmin');
    expect(area('GET', '/club/seasons')).toBe('settings');
    expect(area('GET', '/club/prices')).toBe('website');
    expect(area('GET', '/admin-auth/admins')).toBe('superAdmin');
    expect(area('GET', '/skate/events')).toBe('website');
    expect(area('GET', '/forms/inscrieri')).toBe('club');
    expect(area('GET', '/club/summary')).toBe('any');
    expect(area('GET', '/club/tables/catalog')).toBe('money');
  });
});
