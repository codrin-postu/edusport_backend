import { describe, expect, it } from 'vitest';
import routes from '../../../api/portal/routes/01-auth';
import controller from '../../../api/portal/controllers/portal-auth';
import { staticBeforeParams } from '../../groups/__tests__/route-order';

const EXPECTED = [
  'POST /portal/auth/login',
  'POST /portal/auth/2fa',
  'POST /portal/auth/2fa/email',
  'POST /portal/auth/passkey/options',
  'POST /portal/auth/passkey/verify',
  'GET /portal/auth/google/config',
  'POST /portal/auth/google',
  'POST /portal/auth/refresh',
  'POST /portal/auth/logout',
  'POST /portal/auth/reset/request',
  'POST /portal/auth/reset/confirm',
  'POST /portal/auth/invite/accept',
  'POST /portal/auth/invite/read',
];

const listed = routes.routes.map((r) => `${r.method} ${r.path}`);

describe('portal auth routes', () => {
  it('are exactly the thirteen, in this order', () => {
    expect(listed).toEqual(EXPECTED);
  });

  it('keep fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.routes.map((r) => r.path))).toBe(true);
    const firstParam = routes.routes.findIndex((r) => r.path.includes(':'));
    if (firstParam >= 0) expect(routes.routes.slice(firstParam).every((r) => r.path.includes(':'))).toBe(true);
  });

  it('keep the invite secret out of every path', () => {
    expect(listed.filter((l) => l.includes(':'))).toEqual([]);
  });

  it('turn off Strapi auth, policies and middlewares', () => {
    for (const r of routes.routes) expect(r.config).toEqual({ auth: false, policies: [], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    const handlers = controller as unknown as Record<string, unknown>;
    for (const r of routes.routes) {
      const [name, action] = r.handler.split('.');
      expect(name).toBe('portal-auth');
      expect(typeof handlers[action]).toBe('function');
    }
  });

  it('answer 403 without the secret, before anything else runs', async () => {
    const handlers = controller as unknown as Record<string, (ctx: unknown) => Promise<void>>;
    const previous = process.env.PORTAL_BFF_SECRET;
    process.env.PORTAL_BFF_SECRET = 'test-bff-secret-000000000000000000';
    try {
      for (const r of routes.routes) {
        const ctx: { request: { headers: Record<string, string>; body: unknown }; params: Record<string, string>; status?: number; body?: unknown } = {
          request: { headers: {}, body: {} }, params: { secret: 'x' },
        };
        await handlers[r.handler.split('.')[1]](ctx);
        expect(ctx.status, r.path).toBe(403);
        const wrong = { ...ctx, status: undefined, body: undefined, request: { headers: { 'x-portal-secret': 'nope' }, body: {} } };
        await handlers[r.handler.split('.')[1]](wrong);
        expect(wrong.status, r.path).toBe(403);
      }
    } finally {
      if (previous === undefined) delete process.env.PORTAL_BFF_SECRET;
      else process.env.PORTAL_BFF_SECRET = previous;
    }
  });
});
