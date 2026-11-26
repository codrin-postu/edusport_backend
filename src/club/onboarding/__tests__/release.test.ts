import { describe, expect, it } from 'vitest';
import { canReleaseGuard } from '../release';

const base = { start: '/admin/plugins/edusport-cursuri', target: '/primii-pasi', capped: false };

describe('canReleaseGuard', () => {
  it('keeps the guard while still on the flow page, capped or not', () => {
    expect(canReleaseGuard({ ...base, pathname: '/admin/plugins/edusport-cursuri' })).toBe(false);
    expect(canReleaseGuard({ ...base, pathname: '/admin/plugins/edusport-cursuri', capped: true })).toBe(false);
  });
  it('releases on the Primii pasi page, with or without prefix and trailing slash', () => {
    for (const pathname of ['/admin/primii-pasi', '/admin/primii-pasi/', '/primii-pasi']) {
      expect(canReleaseGuard({ ...base, pathname })).toBe(true);
    }
  });
  it('does not release on another page before the cap, and does after it', () => {
    expect(canReleaseGuard({ ...base, pathname: '/admin/plugins/edusport-grupe' })).toBe(false);
    expect(canReleaseGuard({ ...base, pathname: '/admin/plugins/edusport-grupe', capped: true })).toBe(true);
  });
});
