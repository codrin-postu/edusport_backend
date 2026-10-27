import { adminIdFrom } from '../admin-actor';
import { hasSuperAdminRole } from './roles';

/** The parts of Strapi the check needs; `Core.Strapi` satisfies it. */
export type RoleStrapi = {
  config: { get: (key: string) => unknown };
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; populate: string[] }) => Promise<unknown> } };
};

/** Same rule as Strapi's admin login: only an active, unblocked admin counts. */
function isActiveAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const { isActive, blocked } = user as { isActive?: unknown; blocked?: unknown };
  return isActive === true && blocked !== true;
}

/**
 * Same JWT check as `global::is-admin`, then the admin user loaded with roles from the database (never a claim in
 * the token) must be active, unblocked and hold `strapi-super-admin`. Never throws.
 */
export async function isSuperAdminRequest(authorization: string | undefined, strapi: RoleStrapi): Promise<boolean> {
  try {
    const id = adminIdFrom(authorization, strapi.config.get('admin.auth.secret'));
    if (id === null || id === undefined) return false;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, populate: ['roles'] });
    return isActiveAdmin(user) && hasSuperAdminRole(user);
  } catch {
    return false;
  }
}
