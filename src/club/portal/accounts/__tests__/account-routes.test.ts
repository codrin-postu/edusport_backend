import { describe, expect, it } from 'vitest';
import controller from '../../../../api/club/controllers/portal-accounts';
import routes from '../../../../api/club/routes/12-portal-accounts';
import { staticBeforeParams } from '../../../groups/__tests__/route-order';

describe('portal account routes (spec 4)', () => {
  it('exactly these routes, admin only', () => {
    expect(routes.routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /club/team-members/:documentId/account', 'POST /club/team-members/:documentId/account/invite',
      'POST /club/portal-accounts/:documentId/resend', 'POST /club/portal-accounts/:documentId/disable',
      'POST /club/portal-accounts/:documentId/enable', 'POST /club/portal-accounts/:documentId/email',
      'POST /club/portal-accounts/:documentId/reset-2fa',
    ]);
    for (const r of routes.routes) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });
  it('every handler exists in the controller; static before parameter paths', () => {
    for (const r of routes.routes) {
      const [name, fn] = r.handler.split('.');
      expect(name).toBe('portal-accounts');
      expect(typeof (controller as Record<string, unknown>)[fn], r.handler).toBe('function');
    }
    expect(staticBeforeParams(routes.routes.map((r) => r.path))).toBe(true);
  });
});
