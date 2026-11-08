import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { adminEnv } from '../../club/admin-login/__tests__/admin-env';
import adminAuthGate, { gateDecision } from '../admin-auth-gate';

const CLOSED = ['/admin/login', '/admin/register', '/admin/register-admin', '/admin/reset-password', '/admin/forgot-password'];

describe('gateDecision, gate on', () => {
  it.each(CLOSED)('closed routes answer 404: POST %s', (path) => {
    expect(gateDecision('POST', path, {}, true)).toBe('notFound');
  });

  it('matching ignores case, a trailing slash and the query string, and only POST is closed', () => {
    expect(gateDecision('POST', '/ADMIN/Login/', {}, true)).toBe('notFound');
    expect(gateDecision('POST', '/admin/login?x=1', {}, true)).toBe('notFound');
    expect(gateDecision('GET', '/admin/login', {}, true)).toBe('pass');
    expect(gateDecision('GET', '/admin/registration-info', {}, true)).toBe('pass');
  });

  it('disabled: everything passes', () => {
    for (const path of CLOSED) expect(gateDecision('POST', path, {}, false)).toBe('pass');
    expect(gateDecision('PUT', '/admin/users/me', { password: 'x' }, false)).toBe('pass');
    expect(gateDecision('GET', '/admin/auth/login', undefined, false)).toBe('pass');
  });

  it('profile PUT: firstname passes, password or currentPassword is 403, an email key is checked against the signed-in admin (profileEmail)', () => {
    expect(gateDecision('PUT', '/admin/users/me', { firstname: 'Ana' }, true)).toBe('pass');
    expect(gateDecision('PUT', '/admin/users/me', { password: 'x' }, true)).toBe('forbidden');
    expect(gateDecision('PUT', '/admin/users/me', { currentPassword: 'x' }, true)).toBe('forbidden');
    expect(gateDecision('PUT', '/admin/users/me', { email: 'a@b.ro' }, true)).toBe('profileEmail');
    expect(gateDecision('PUT', '/admin/users/me', { email: 'a@b.ro', password: 'x' }, true)).toBe('forbidden');
    expect(gateDecision('PUT', '/admin/users/me', { email: 'a@b.ro', currentPassword: 'x' }, true)).toBe('forbidden');
    expect(gateDecision('PUT', '/admin/users/me', undefined, true)).toBe('pass');
    expect(gateDecision('PUT', '/admin/users/me', 'text', true)).toBe('pass');
  });

  it('PUT /admin/users/:id: password is 403, roles or email pass', () => {
    expect(gateDecision('PUT', '/admin/users/5', { password: 'x' }, true)).toBe('forbidden');
    expect(gateDecision('PUT', '/admin/users/5', { roles: [1] }, true)).toBe('pass');
    expect(gateDecision('PUT', '/admin/users/5', { email: 'a@b.ro' }, true)).toBe('pass');
  });

  it('GET /admin/auth/*: a redirect to the matching /intrare path, keeping only registrationToken and code', () => {
    expect(gateDecision('GET', '/admin/auth/register?registrationToken=abc&x=1', undefined, true)).toEqual({ redirect: '/intrare/invitatie?registrationToken=abc' });
    expect(gateDecision('GET', '/admin/auth/login', undefined, true)).toEqual({ redirect: '/intrare' });
    expect(gateDecision('GET', '/admin/auth/forgot-password', undefined, true)).toEqual({ redirect: '/intrare/parola' });
    expect(gateDecision('GET', '/admin/auth/reset-password?code=123456&y=2', undefined, true)).toEqual({ redirect: '/intrare/parola?code=123456' });
    expect(gateDecision('GET', '/admin/auth/oops?registrationToken=a%20b&code=9', undefined, true)).toEqual({ redirect: '/intrare?registrationToken=a%20b&code=9' });
    expect(gateDecision('GET', '/admin/auth/register/', undefined, true)).toEqual({ redirect: '/intrare/invitatie' });
  });

  it('access-token, logout and everything else pass', () => {
    expect(gateDecision('POST', '/admin/access-token', {}, true)).toBe('pass');
    expect(gateDecision('POST', '/admin/logout', {}, true)).toBe('pass');
    expect(gateDecision('GET', '/admin/users/me', undefined, true)).toBe('pass');
    expect(gateDecision('POST', '/api/admin-auth/login', {}, true)).toBe('pass');
    expect(gateDecision('GET', '/admin', undefined, true)).toBe('pass');
  });
});

describe('the middleware', () => {
  const ctxOf = (method: string, url: string, body?: unknown) => ({ method, url, path: url.split('?')[0], querystring: url.split('?').slice(1).join('?'), status: 200, body: null as unknown, request: { body }, redirect: vi.fn(function (this: { status: number }, to: string) { this.status = 302; (this as unknown as { to: string }).to = to; }) });
  const run = async (method: string, url: string, body?: unknown, gate = 'on') => {
    const saved = process.env.ADMIN_GATE;
    process.env.ADMIN_GATE = gate;
    try {
      const ctx = ctxOf(method, url, body);
      const next = vi.fn(async () => undefined);
      await adminAuthGate()(ctx as never, next);
      return { ctx, next };
    } finally {
      if (saved === undefined) delete process.env.ADMIN_GATE;
      else process.env.ADMIN_GATE = saved;
    }
  };

  it('404 and 403 never reach Strapi; the redirect is a 302; a pass calls next', async () => {
    const closed = await run('POST', '/admin/login', { email: 'a@b.ro', password: 'x' });
    expect(closed.next).not.toHaveBeenCalled();
    expect(closed.ctx.status).toBe(404);
    const forbidden = await run('PUT', '/admin/users/me', { password: 'x' });
    expect(forbidden.next).not.toHaveBeenCalled();
    expect(forbidden.ctx.status).toBe(403);
    const moved = await run('GET', '/admin/auth/register?registrationToken=abc');
    expect(moved.next).not.toHaveBeenCalled();
    expect(moved.ctx.redirect).toHaveBeenCalledWith('/intrare/invitatie?registrationToken=abc');
    const through = await run('POST', '/admin/access-token');
    expect(through.next).toHaveBeenCalledOnce();
  });

  it('decides on ctx.path, not on an absolute-form ctx.url (B3 M1)', async () => {
    const saved = process.env.ADMIN_GATE;
    delete process.env.ADMIN_GATE;
    try {
      const ctx = { ...ctxOf('POST', '/admin/login'), url: 'http://h/admin/login', path: '/admin/login' };
      const next = vi.fn(async () => undefined);
      await adminAuthGate()(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(404);
      const moved = { ...ctxOf('GET', '/admin/auth/register'), url: 'http://h/admin/auth/register?registrationToken=abc&x=1', path: '/admin/auth/register', querystring: 'registrationToken=abc&x=1' };
      await adminAuthGate()(moved as never, next);
      expect(moved.redirect).toHaveBeenCalledWith('/intrare/invitatie?registrationToken=abc');
    } finally {
      if (saved !== undefined) process.env.ADMIN_GATE = saved;
    }
  });

  it('ADMIN_GATE=off lets everything through; unset counts as on', async () => {
    expect((await run('POST', '/admin/login', {}, 'off')).next).toHaveBeenCalledOnce();
    const saved = process.env.ADMIN_GATE;
    delete process.env.ADMIN_GATE;
    const ctx = ctxOf('POST', '/admin/login');
    const next = vi.fn(async () => undefined);
    await adminAuthGate()(ctx as never, next);
    process.env.ADMIN_GATE = saved ?? '';
    if (saved === undefined) delete process.env.ADMIN_GATE;
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(404);
  });

  it('config/middlewares.ts lists global::admin-auth-gate immediately after strapi::body', () => {
    const list = readFileSync(join(__dirname, '../../../config/middlewares.ts'), 'utf8').match(/'(?:strapi|global)::[a-z-]+'/g) ?? [];
    expect(list[list.indexOf("'strapi::body'") + 1]).toBe("'global::admin-auth-gate'");
  });
});

describe('profile e-mail check (B3 M2)', () => {
  async function scene() {
    const env = adminEnv();
    env.addAdmin({ id: 7, email: 'Ana@X.ro', firstname: 'Ana' });
    const refresh = await env.admin().generateRefreshToken('7', 'dev', { type: 'refresh' });
    const access = (await env.admin().generateAccessToken(refresh.token)).token as string;
    const put = async (body: unknown, authorization?: string) => {
      const ctx = { method: 'PUT', path: '/admin/users/me', querystring: '', status: 200, body: null as unknown, request: { body }, headers: { authorization }, redirect: vi.fn() };
      const next = vi.fn(async () => undefined);
      await adminAuthGate({}, { strapi: env.strapi as never })(ctx as never, next);
      return { ctx, next };
    };
    return { put, access };
  }

  it('the same e-mail passes, also with another case or spaces; the name can be saved', async () => {
    const { put, access } = await scene();
    for (const email of ['Ana@X.ro', 'ana@x.RO', ' ana@x.ro ']) {
      const r = await put({ email, firstname: 'Ana' }, `Bearer ${access}`);
      expect(r.next).toHaveBeenCalledOnce();
    }
  });

  it('a different e-mail is 403', async () => {
    const { put, access } = await scene();
    const r = await put({ email: 'other@x.ro' }, `Bearer ${access}`);
    expect(r.next).not.toHaveBeenCalled();
    expect(r.ctx.status).toBe(403);
  });

  it('no token, a bad token and a refresh token are 403', async () => {
    const { put } = await scene();
    for (const header of [undefined, '', 'Bearer ', 'Bearer garbage', 'Basic abc']) {
      const r = await put({ email: 'ana@x.ro' }, header);
      expect(r.next).not.toHaveBeenCalled();
      expect(r.ctx.status).toBe(403);
    }
  });

  it('a throw while checking answers 403', async () => {
    const { access } = await scene();
    const ctx = { method: 'PUT', path: '/admin/users/me', querystring: '', status: 200, body: null as unknown, request: { body: { email: 'ana@x.ro' } }, headers: { authorization: `Bearer ${access}` }, redirect: vi.fn() };
    const next = vi.fn(async () => undefined);
    await adminAuthGate({}, { strapi: {} as never })(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it('a password with the same e-mail is still 403 and an e-mail is not looked up', async () => {
    const { put, access } = await scene();
    const r = await put({ email: 'ana@x.ro', password: 'x' }, `Bearer ${access}`);
    expect(r.next).not.toHaveBeenCalled();
    expect(r.ctx.status).toBe(403);
  });
});
