import { describe, expect, it } from 'vitest';
import groups from '../../../api/club/controllers/groups';
import groupRoutes from '../../../api/club/routes/06-groups';
import { staticBeforeParams } from './route-order';

const routes = groupRoutes.routes;
const controllers: Record<string, Record<string, unknown>> = { groups };

describe('06-groups routes (8.2)', () => {
  it('are all admin-only', () => {
    for (const r of routes) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of routes) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
    expect(staticBeforeParams(['/club/groups/:documentId', '/club/groups/unassigned'])).toBe(false);
  });

  it('cover the spec routes', () => {
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual(expect.arrayContaining([
      'GET /club/groups', 'GET /club/groups/unassigned', 'POST /club/groups', 'PUT /club/groups/:documentId', 'DELETE /club/groups/:documentId',
      'GET /club/groups/:documentId', 'GET /club/groups/:documentId/history', 'POST /club/groups/:documentId/members', 'POST /club/memberships/allocate',
      'POST /club/memberships/:documentId/move', 'DELETE /club/memberships/:documentId', 'POST /club/undo',
    ]));
  });
});
