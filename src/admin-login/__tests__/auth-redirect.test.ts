import { describe, expect, it } from 'vitest';
import { authRedirectTarget } from '../../admin/lib/authRedirect';

const base = 'https://cms.example.invalid/admin/plugins/x';

describe('authRedirectTarget (the SPA side of the gate map)', () => {
  it('sends Strapi auth pages to the matching /login path, keeping only registrationToken', () => {
    expect(authRedirectTarget('/admin/auth/login', base)).toBe('/login');
    expect(authRedirectTarget('/admin/auth/register?registrationToken=abc&x=1', base)).toBe('/invite?registrationToken=abc');
    expect(authRedirectTarget('/admin/auth/forgot-password', base)).toBe('/forgot-password');
    expect(authRedirectTarget('/admin/auth/reset-password?code=123456', base)).toBe('/forgot-password');
    expect(authRedirectTarget('/admin/Auth/oops', base)).toBe('/login');
  });

  it('leaves every other address alone', () => {
    for (const u of ['/admin', '/admin/plugins/edusport-securitate', '/login', '/admin/authors', null, undefined]) expect(authRedirectTarget(u, base), String(u)).toBeNull();
  });
});
