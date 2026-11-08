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
    'https://api.x.ro/api/portal/auth/2fa',
    'https://api.x.ro/api/portal/me/2fa/totp/confirm',
    'https://cms.x.ro/intrare/2fa?token=abc123',
    '/intrare',
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
});
