import { verifiedAdminId, type TokenStrapi } from '../admin-actor';
import { hasSuperAdminRole, isRaw } from './roles';

/** The parts of Strapi the check needs; `Core.Strapi` satisfies it. */
export type RoleStrapi = TokenStrapi & {
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; populate: string[] }) => Promise<unknown> } };
};

/** Same rule as Strapi's admin login, plus not blocked: only an active, unblocked admin counts. */
const isActiveAdmin = (user: unknown): boolean => isRaw(user) && user.isActive === true && user.blocked !== true;

/**
 * Same token check as `global::is-admin` (an access token of an active admin session), then the admin user loaded
 * with roles from the database (never a claim in the token) must be active, unblocked and hold `strapi-super-admin`.
 * Never throws.
 */
export async function isSuperAdminRequest(authorization: string | undefined, strapi: RoleStrapi): Promise<boolean> {
  try {
    const id = await verifiedAdminId(authorization, strapi);
    if (id === null) return false;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, populate: ['roles'] });
    return isActiveAdmin(user) && hasSuperAdminRole(user);
  } catch {
    return false;
  }
}
