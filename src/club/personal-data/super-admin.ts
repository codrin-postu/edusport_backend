import { requireAdminUser, type AdminUserStrapi } from '../admin-auth';
import { hasSuperAdminRole } from './roles';

/**
 * Same check as `global::is-admin` (an access token of an active session of an existing, active admin; otherwise
 * Strapi's UnauthorizedError, 401). Then that admin, loaded with roles from the database (never a claim in the
 * token), must not be blocked and must hold `strapi-super-admin`; otherwise false (403).
 */
export async function isSuperAdminRequest(authorization: string | undefined, strapi: AdminUserStrapi): Promise<boolean> {
  const user = await requireAdminUser(authorization, strapi);
  return user.blocked !== true && hasSuperAdminRole(user);
}
