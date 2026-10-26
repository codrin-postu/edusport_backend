import { describe, expect, it } from 'vitest';
import athletes from '../../api/club/controllers/athletes';
import registrations from '../../api/club/controllers/registrations';
import athleteRoutes from '../../api/club/routes/05-athletes';
import registrationRoutes from '../../api/club/routes/04-registrations';

const controllers: Record<string, Record<string, unknown>> = { athletes, registrations };
const all = [...registrationRoutes.routes, ...athleteRoutes.routes];
const fromFirst = (paths: string[], test: (p: string) => boolean) => paths.slice(paths.findIndex(test));

describe('3A+3B admin routes', () => {
  it('are all admin-only', () => {
    for (const r of all) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of all) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
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
