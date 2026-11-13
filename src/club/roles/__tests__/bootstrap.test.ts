import { describe, expect, it, vi } from 'vitest';
import type { Core } from '@strapi/strapi';
import { bootstrapRoles } from '../bootstrap';
import { nativePermissions } from '../map';

type Role = { id: number; name: string; code: string };
type Admin = { id: number; isActive: boolean; roles: { code: string }[] };

function fakeStrapi(admins: Admin[] = [], roles: Role[] = [], withPermissions: number[] = []) {
  const failAssign = { on: false };
  const granted = new Set<number>(withPermissions);
  const assigned: { roleId: number; permissions: { action: string; subject: string | null }[] }[] = [];
  const log = { info: vi.fn(), warn: vi.fn() };
  let nextId = 100;
  const roleService = {
    create: async (attrs: { name: string; code: string }) => {
      const role = { id: nextId++, ...attrs };
      roles.push(role);
      return role;
    },
    assignPermissions: async (roleId: number, permissions: { action: string; subject: string | null }[]) => {
      if (failAssign.on) throw new Error('boom');
      granted.add(roleId);
      assigned.push({ roleId, permissions });
    },
  };
  const strapi = {
    log,
    service: (uid: string) => (uid === 'admin::role' ? roleService : undefined),
    db: {
      query: (uid: string) => ({
        count: async ({ where }: { where: { role: { id: number } } }) => (uid === 'admin::permission' && granted.has(where.role.id) ? 3 : 0),
        findOne: async ({ where }: { where: { code: string } }) => (uid === 'admin::role' ? roles.find((r) => r.code === where.code) ?? null : null),
        findMany: async () => (uid === 'admin::user' ? admins.filter((a) => a.isActive) : []),
      }),
    },
  } as unknown as Core.Strapi;
  return { strapi, assigned, roles, log, failAssign };
}

describe('bootstrapRoles', () => {
  it('is idempotent: two runs create each role once and assign permissions once', async () => {
    const { strapi, assigned, roles } = fakeStrapi();
    const first = await bootstrapRoles(strapi);
    const second = await bootstrapRoles(strapi);
    expect(first.created).toEqual(['edusport-club-admin', 'edusport-site-editor']);
    expect(second.created).toEqual([]);
    expect(roles.map((r) => r.name)).toEqual(['Administrator club', 'Editor site']);
    expect(assigned).toHaveLength(2);
    expect(assigned[0].permissions).toEqual(nativePermissions('edusport-club-admin'));
    expect(assigned[1].permissions).toEqual(nativePermissions('edusport-site-editor'));
  });

  it('finds a renamed role by code and does not rename or re-grant it', async () => {
    const { strapi, assigned, roles } = fakeStrapi([], [{ id: 1, name: 'Club', code: 'edusport-club-admin' }], [1]);
    const result = await bootstrapRoles(strapi);
    expect(result.created).toEqual(['edusport-site-editor']);
    expect(roles.find((r) => r.id === 1)?.name).toBe('Club');
    expect(assigned).toHaveLength(1);
  });

  it('retries the grant on the next boot when the first assign threw', async () => {
    const { strapi, assigned, roles, log, failAssign } = fakeStrapi();
    failAssign.on = true;
    const first = await bootstrapRoles(strapi);
    expect(first.created).toHaveLength(2);
    expect(assigned).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith('[roles] could not assign permissions to edusport-club-admin');
    expect(log.warn).toHaveBeenCalledWith('[roles] could not assign permissions to edusport-site-editor');
    failAssign.on = false;
    const second = await bootstrapRoles(strapi);
    expect(second.created).toEqual([]);
    expect(roles).toHaveLength(2);
    expect(assigned).toHaveLength(2);
  });

  it('returns and logs an active admin with no EduSport role, id only', async () => {
    const admins: Admin[] = [
      { id: 7, isActive: true, roles: [{ code: 'strapi-editor' }] },
      { id: 8, isActive: true, roles: [{ code: 'strapi-super-admin' }] },
      { id: 9, isActive: false, roles: [] },
    ];
    const { strapi, log } = fakeStrapi(admins);
    const result = await bootstrapRoles(strapi);
    expect(result.unassigned).toEqual([7]);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const line = log.warn.mock.calls[0][0] as string;
    expect(line).toBe('[roles] admin 7 has no EduSport role');
    expect(line).not.toContain('@');
  });
});
