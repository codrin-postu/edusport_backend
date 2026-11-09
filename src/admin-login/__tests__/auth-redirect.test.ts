import { describe, expect, it } from 'vitest';
import { authRedirectTarget } from '../../admin/lib/authRedirect';

const base = 'https://cms.example.invalid/admin/plugins/x';

describe('authRedirectTarget (the SPA side of the gate map)', () => {
  it('sends Strapi auth pages to the matching /intrare path, keeping only registrationToken and code', () => {
    expect(authRedirectTarget('/admin/auth/login', base)).toBe('/intrare');
    expect(authRedirectTarget('/admin/auth/register?registrationToken=abc&x=1', base)).toBe('/intrare/invitatie?registrationToken=abc');
    expect(authRedirectTarget('/admin/auth/forgot-password', base)).toBe('/intrare/parola');
    expect(authRedirectTarget('/admin/auth/reset-password?code=123456', base)).toBe('/intrare/parola?code=123456');
    expect(authRedirectTarget('/admin/Auth/oops', base)).toBe('/intrare');
  });

  it('leaves every other address alone', () => {
    for (const u of ['/admin', '/admin/plugins/edusport-securitate', '/intrare', '/admin/authors', null, undefined]) expect(authRedirectTarget(u, base), String(u)).toBeNull();
  });
});
