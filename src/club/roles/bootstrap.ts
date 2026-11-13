import type { Core } from '@strapi/strapi';
import { ROLE_CODES, ROLE_NAMES, nativePermissions, roleCodesOf } from './map';

type EduSportCode = typeof ROLE_CODES.clubAdmin | typeof ROLE_CODES.siteEditor;
type AdminRow = { id: number; roles?: unknown };

const SEEDED: { code: EduSportCode; name: string }[] = [
  { code: ROLE_CODES.clubAdmin, name: ROLE_NAMES.clubAdmin },
  { code: ROLE_CODES.siteEditor, name: ROLE_NAMES.siteEditor },
];

const EDUSPORT_CODES: string[] = Object.values(ROLE_CODES);

/** Gives a role its native permissions when it has none (a new role, or one whose first grant failed); a role that has any is never touched, so a Super Admin's later edits stay. A failure is logged and never aborts boot. */
async function grantWhenEmpty(strapi: Core.Strapi, roleId: number, code: EduSportCode): Promise<void> {
  const count = await strapi.db.query('admin::permission').count({ where: { role: { id: roleId } } });
  if (count > 0) return;
  try {
    await strapi.service('admin::role').assignPermissions(roleId, nativePermissions(code));
  } catch {
    strapi.log.warn(`[roles] could not assign permissions to ${code}`);
  }
}

/** Creates the two EduSport roles when missing (found by code, never renamed) and grants permissions to an empty one. */
async function ensureRoles(strapi: Core.Strapi): Promise<string[]> {
  const created: string[] = [];
  for (const { code, name } of SEEDED) {
    let role = await strapi.db.query('admin::role').findOne({ where: { code } });
    if (!role) {
      role = await strapi.service('admin::role').create({ name, code, description: name });
      created.push(code);
    }
    await grantWhenEmpty(strapi, role.id, code);
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
