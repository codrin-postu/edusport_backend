import { describe, expect, it } from 'vitest';
import prices from '../../api/club/controllers/prices';
import seasons from '../../api/club/controllers/seasons';
import routes from '../../api/club/routes/03-admin-prices-seasons';
import { indexParam, refuseWith, respond, type AdminCtx } from '../admin-http';

const controllers: Record<string, Record<string, unknown>> = { prices, seasons };

const ctx = (): AdminCtx => ({ params: {}, query: {}, request: { header: {} }, status: 200, body: null });

describe('Prețuri and Sezoane admin routes', () => {
  it('are all admin-only', () => {
    for (const r of routes.routes) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('point at handlers that exist', () => {
    for (const r of routes.routes) {
      const [controller, action] = r.handler.split('.');
      expect(typeof controllers[controller]?.[action], r.handler).toBe('function');
    }
  });
});

describe('admin-http', () => {
  it('answers data or a Strapi-shaped error', () => {
    const ok = ctx();
    respond(ok, { ok: true, data: [1] });
    expect(ok.body).toEqual({ data: [1] });
    const no = ctx();
    respond(no, { ok: false, status: 409, error: 'Nu.' });
    expect([no.status, no.body]).toEqual([409, { data: null, error: { status: 409, name: 'ClubAdminError', message: 'Nu.' } }]);
  });

  it('reads an item index', () => {
    expect(indexParam('2')).toBe(2);
    expect(indexParam('-1')).toBeNull();
    expect(indexParam('x')).toBeNull();
    expect(indexParam(undefined)).toBeNull();
  });

  it('refuses with a message', () => {
    const c = ctx();
    refuseWith(c, 400, 'Alege tipul.');
    expect(c.status).toBe(400);
  });
});
