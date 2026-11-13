import type { Core } from '@strapi/strapi';
import { ROLE_CODES, ROLE_NAMES, nativePermissions, roleCodesOf } from './map';

type EduSportCode = typeof ROLE_CODES.clubAdmin | typeof ROLE_CODES.siteEditor;
type AdminRow = { id: number; roles?: unknown };

const SEEDED: { code: EduSportCode; name: string }[] = [
  { code: ROLE_CODES.clubAdmin, name: ROLE_NAMES.clubAdmin },
  { code: ROLE_CODES.siteEditor, name: ROLE_NAMES.siteEditor },
];

const EDUSPORT_CODES: string[] = Object.values(ROLE_CODES);

/** Creates the two EduSport roles when missing (found by code, never renamed) and gives only a new role its native permissions, so a Super Admin's later edits stay. */
async function ensureRoles(strapi: Core.Strapi): Promise<string[]> {
  const roleService = strapi.service('admin::role');
  const created: string[] = [];
  for (const { code, name } of SEEDED) {
    const existing = await strapi.db.query('admin::role').findOne({ where: { code } });
    if (existing) continue;
    const role = await roleService.create({ name, code, description: name });
    await roleService.assignPermissions(role.id, nativePermissions(code));
    created.push(code);
  }
  return created;
}

async function findUnassigned(strapi: Core.Strapi): Promise<number[]> {
  const admins: AdminRow[] = await strapi.db.query('admin::user').findMany({ where: { isActive: true }, populate: ['roles'] });
  const unassigned = admins.filter((a) => !roleCodesOf(a).some((c) => EDUSPORT_CODES.includes(c))).map((a) => a.id);
  for (const id of unassigned) strapi.log.warn(`[roles] admin ${id} has no EduSport role`);
  return unassigned;
}

export async function bootstrapRoles(strapi: Core.Strapi): Promise<{ created: string[]; unassigned: number[] }> {
  const created = await ensureRoles(strapi);
  return { created, unassigned: await findUnassigned(strapi) };
}
