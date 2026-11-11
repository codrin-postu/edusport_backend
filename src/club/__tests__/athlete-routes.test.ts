import { describe, expect, it } from 'vitest';
import athletes from '../../api/club/controllers/athletes';
import personalData from '../../api/club/controllers/personal-data';
import registrations from '../../api/club/controllers/registrations';
import athleteRoutes from '../../api/club/routes/05-athletes';
import registrationRoutes from '../../api/club/routes/04-registrations';

const controllers: Record<string, Record<string, unknown>> = { athletes, registrations, 'personal-data': personalData };
const SUPER_ADMIN_ONLY = ['POST /club/athletes/inactive-summary/hide', 'POST /club/athletes/anonymize', 'POST /club/athletes/:documentId/anonymize'];
const route = (method: string, path: string) => athleteRoutes.routes.find((r) => r.method === method && r.path === path);
const all = [...registrationRoutes.routes, ...athleteRoutes.routes];
const fromFirst = (paths: string[], test: (p: string) => boolean) => paths.slice(paths.findIndex(test));

describe('3A+3B admin routes', () => {
  it('are all admin-only; anonymizing and hiding the yearly review need a Super Admin (3C spec 6)', () => {
    for (const r of all) {
      const policy = SUPER_ADMIN_ONLY.includes(`${r.method} ${r.path}`) ? 'global::is-super-admin' : 'global::is-admin';
      expect(r.config, `${r.method} ${r.path}`).toEqual({ auth: false, policies: [policy], middlewares: [] });
    }
  });

  it('export is for any admin, both anonymize routes for a Super Admin (3C spec 8)', () => {
    expect(route('GET', '/club/athletes/:documentId/export')?.config.policies).toEqual(['global::is-admin']);
    expect(route('POST', '/club/athletes/:documentId/anonymize')?.config.policies).toEqual(['global::is-super-admin']);
    expect(route('POST', '/club/athletes/anonymize')?.config.policies).toEqual(['global::is-super-admin']);
    expect(route('GET', '/club/athletes/inactive-summary')?.handler).toBe('personal-data.inactiveSummary');
  });

  it('list fixed athlete paths before /:documentId ones, so "search" is never read as an id', () => {
    const paths = athleteRoutes.routes.map((r) => r.path);
    expect(fromFirst(paths, (p) => p.startsWith('/club/athletes/:documentId')).every((p) => p.startsWith('/club/athletes/:documentId'))).toBe(true);
  });

  it('list the bulk registration paths before the per-registration ones', () => {
    const paths = registrationRoutes.routes.map((r) => r.path);
    expect(fromFirst(paths, (p) => p.includes(':documentId')).every((p) => p.includes(':documentId'))).toBe(true);
  });
});
