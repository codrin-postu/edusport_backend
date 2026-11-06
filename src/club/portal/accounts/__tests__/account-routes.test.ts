import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  it('each handler maps its service result with respond', () => {
    const src = readFileSync(join(__dirname, '../../../../api/club/controllers/portal-accounts.ts'), 'utf8');
    for (const fn of ['readAccount', 'inviteAccount', 'resendInvite', 'disableAccount', 'enableAccount', 'changeEmail']) {
      expect(src).toMatch(new RegExp(`respond\\(ctx, await ${fn}\\(await accountContext\\(strapi, ctx\\)`));
    }
  });
});
