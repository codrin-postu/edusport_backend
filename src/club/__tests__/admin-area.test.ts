import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_AREAS, adminRoute, areaOfRoute } from '../admin-area';

const SRC = join(__dirname, '../..');

describe('admin areas', () => {
  it('names the 6b areas verbatim', () => {
    expect(ADMIN_AREAS).toEqual(['any', 'website', 'club', 'money', 'coachAccounts', 'settings', 'superAdmin']);
  });
  it('builds a has-role route that carries its area', () => {
    expect(adminRoute('money')).toEqual({ auth: false, policies: [{ name: 'global::has-role', config: { area: 'money' } }], middlewares: [] });
    expect(areaOfRoute(adminRoute('club'))).toBe('club');
    expect(areaOfRoute({ auth: false, policies: ['global::is-admin'], middlewares: [] })).toBeNull();
    expect(areaOfRoute(null)).toBeNull();
  });
  it('is-admin and is-super-admin are thin wrappers of has-role', () => {
    expect(readFileSync(join(SRC, 'policies/is-admin.ts'), 'utf8')).toContain("{ area: 'any' }");
    expect(readFileSync(join(SRC, 'policies/is-super-admin.ts'), 'utf8')).toContain("{ area: 'superAdmin' }");
  });
});
