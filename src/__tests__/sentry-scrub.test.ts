import { describe, expect, it } from 'vitest';
import { scrubAuthEvent } from '../sentry';

const event = (url: string, data: unknown = { code: '123456', password: 'hunter2hunter2' }) => ({
  message: 'boom',
  request: {
    url,
    method: 'POST',
    data,
    cookies: { __Host_es_2fa: 'secret-cookie' },
    query_string: 'token=abc123&code=123456',
    headers: { cookie: '__Host-es_2fa=secret-cookie', authorization: 'Bearer abc', 'user-agent': 'UA', 'content-type': 'application/json' },
  },
});

describe('scrubAuthEvent', () => {
  it.each([
    'https://api.x.ro/api/admin-auth/2fa',
    'https://api.x.ro/api/admin-auth/login?code=123456',
    'https://api.x.ro/api/Admin-Auth/reset/confirm',
    'https://cms.x.ro/Admin/Auth/google/callback?code=123456',
    'https://api.x.ro/api/admin-auth/reset/confirm/',
    'https://api.x.ro/api/portal/auth/2fa',
    'https://api.x.ro/api/portal/me/2fa/totp/confirm',
    'https://cms.x.ro/intrare/2fa?token=abc123',
    '/intrare',
    'https://cms.x.ro/admin/auth/google/callback?registrationToken=abc123&code=123456',
    'https://cms.x.ro/admin/access-token',
    'https://cms.x.ro/admin/renew-token',
    'https://cms.x.ro/admin/logout',
  ])('drops the secrets of %s', (url) => {
    const out = scrubAuthEvent(event(url));
    const json = JSON.stringify(out);
    for (const secret of ['123456', 'hunter2hunter2', 'secret-cookie', 'Bearer abc', 'abc123']) expect(json).not.toContain(secret);
    expect(out.request).not.toHaveProperty('data');
    expect(out.request).not.toHaveProperty('cookies');
    expect(out.request).not.toHaveProperty('query_string');
    expect(out.request?.headers).toEqual({ 'user-agent': 'UA', 'content-type': 'application/json' });
    expect(out.request).toMatchObject({ method: 'POST' });
    expect(out.message).toBe('boom');
  });

  it('keeps an event for another route as it is', () => {
    const e = event('https://api.x.ro/api/club/summary?season=1', { note: 'kept' });
    expect(scrubAuthEvent(e)).toEqual(e);
  });

  it('passes an event without a request and a request without a url', () => {
    const bare = { message: 'x' };
    expect(scrubAuthEvent(bare)).toBe(bare);
    const noUrl = { request: { data: { code: '123456' } } };
    expect(scrubAuthEvent(noUrl)).toBe(noUrl);
  });

  it('reads a path-only url', () => {
    expect(JSON.stringify(scrubAuthEvent(event('/api/admin-auth/2fa?x=1')))).not.toContain('123456');
  });

  it('keeps Strapi admin routes that carry no secret', () => {
    const e = event('https://cms.x.ro/admin/content-manager/collection-types/api::team-member.team-member?page=1', { note: 'kept' });
    expect(scrubAuthEvent(e)).toEqual(e);
  });

  describe('transactions', () => {
    const tx = (name: string, url: string) => ({
      type: 'transaction',
      transaction: name,
      request: { url, headers: { cookie: 'secret-cookie' } },
      contexts: { trace: { op: 'http.server', data: { 'http.target': '/admin/auth/google/callback?code=123456', 'url.full': `${url}`, 'url.query': '?code=123456', 'http.method': 'GET' } } },
      spans: [{ op: 'http.server', data: { 'http.url': `${url}`, 'url.query': 'registrationToken=abc123', 'db.system': 'postgres' } }, { op: 'db', description: 'select 1' }],
    });

    it('strips the query from the transaction name and the span data of an auth path', () => {
      const url = 'https://cms.x.ro/admin/auth/google/callback?registrationToken=abc123&code=123456';
      const out = scrubAuthEvent(tx('GET /admin/auth/google/callback?code=123456', url));
      const json = JSON.stringify(out);
      for (const secret of ['123456', 'abc123', 'secret-cookie']) expect(json).not.toContain(secret);
      expect(out.transaction).toBe('GET /admin/auth/google/callback');
      expect(out.contexts?.trace?.data).toEqual({ 'http.target': '/admin/auth/google/callback', 'url.full': 'https://cms.x.ro/admin/auth/google/callback', 'http.method': 'GET' });
      expect(out.spans?.[0].data).toEqual({ 'http.url': 'https://cms.x.ro/admin/auth/google/callback', 'db.system': 'postgres' });
      expect(out.spans?.[1]).toEqual({ op: 'db', description: 'select 1' });
    });

    it('scrubs by the transaction name when the event has no request', () => {
      const out = scrubAuthEvent({ transaction: 'GET /admin/renew-token?x=secret-q', spans: [{ data: { 'url.query': 'x=secret-q' } }] });
      expect(JSON.stringify(out)).not.toContain('secret-q');
    });

    it('leaves the transaction of another route untouched', () => {
      const e = tx('GET /api/club/summary?season=1', 'https://api.x.ro/api/club/summary?season=1');
      expect(scrubAuthEvent(e)).toBe(e);
    });
  });
});
