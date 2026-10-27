import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import policy from '../../../policies/is-super-admin';
import { hasSuperAdminRole, superAdminFromMe } from '../roles';
import { isSuperAdminRequest, type RoleStrapi } from '../super-admin';

const SECRET = 'test-secret';
const SUPER = [{ code: 'strapi-super-admin' }];
const USERS: Record<number, unknown> = {
  1: { id: 1, isActive: true, blocked: false, roles: SUPER },
  2: { id: 2, isActive: true, blocked: false, roles: [{ code: 'strapi-editor' }] },
  3: { id: 3, isActive: false, blocked: false, roles: SUPER },
  4: { id: 4, isActive: true, blocked: true, roles: SUPER },
  5: { id: 5, roles: SUPER },
};
const bearer = (userId: number, secret = SECRET) => `Bearer ${jwt.sign({ userId }, secret)}`;
const asked: unknown[] = [];
const strapi: RoleStrapi = {
  config: { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) },
  db: { query: () => ({ findOne: async (args) => { asked.push(args); return USERS[Number(args.where.id)] ?? null; } }) },
};

describe('global::is-super-admin (3C spec 6)', () => {
  it('allows a Super Admin, loading the admin with roles', async () => {
    expect(await isSuperAdminRequest(bearer(1), strapi)).toBe(true);
    expect(asked.at(-1)).toEqual({ where: { id: 1 }, populate: ['roles'] });
  });

  it('refuses an editor, an unknown admin, a wrong signature and no token', async () => {
    expect(await isSuperAdminRequest(bearer(2), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(9), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(1, 'other'), strapi)).toBe(false);
    expect(await isSuperAdminRequest(undefined, strapi)).toBe(false);
  });

  it('refuses a Super Admin who is inactive, blocked or not marked active', async () => {
    expect(await isSuperAdminRequest(bearer(3), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(4), strapi)).toBe(false);
    expect(await isSuperAdminRequest(bearer(5), strapi)).toBe(false);
  });

  it('ignores a role claim in the token: the roles come from the database', async () => {
    const forged = `Bearer ${jwt.sign({ userId: 2, roles: SUPER, isSuperAdmin: true }, SECRET)}`;
    expect(await isSuperAdminRequest(forged, strapi)).toBe(false);
  });

  it('the policy reads the Authorization header', async () => {
    const ctx = (authorization?: string) => ({ request: { header: { authorization } } });
    expect(await policy(ctx(bearer(1)), {}, { strapi: strapi as unknown as Core.Strapi })).toBe(true);
    expect(await policy(ctx(bearer(2)), {}, { strapi: strapi as unknown as Core.Strapi })).toBe(false);
    expect(await policy(ctx(), {}, { strapi: strapi as unknown as Core.Strapi })).toBe(false);
  });

  it('the admin UI reads the role from /admin/users/me', () => {
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-super-admin' }] } })).toBe(true);
    expect(superAdminFromMe({ data: { roles: [{ code: 'strapi-author' }] } })).toBe(false);
    expect(superAdminFromMe(null)).toBe(false);
    expect(hasSuperAdminRole({ roles: 'strapi-super-admin' })).toBe(false);
  });

  it('roles.ts stays importable by the admin bundle (no jsonwebtoken, no Node modules)', () => {
    const src = readFileSync(join(__dirname, '..', 'roles.ts'), 'utf8');
    expect(src).not.toMatch(/from '(jsonwebtoken|node:|\.\.\/admin-actor)/);
  });
});

describe('startup sweep is wired (3C spec 4)', () => {
  it('bootstrap starts it without awaiting it', () => {
    const index = readFileSync(join(__dirname, '..', '..', '..', 'index.ts'), 'utf8');
    expect(index).toContain('startPersonalDataSweep(strapi);');
  });
});
