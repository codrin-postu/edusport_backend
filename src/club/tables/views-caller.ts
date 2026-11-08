import { requireAdminUser, type AdminUserStrapi } from '../admin-auth';
import { hasSuperAdminRole } from '../personal-data/roles';
import type { Caller } from './views-service';

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * The admin behind a request, read from his session and the database (never from a claim in the token): the id the author rule compares,
 * the name shown as author, the e-mail written to Istoric, and whether he holds the Super Admin role. A request that is not an active admin
 * session throws Strapi's UnauthorizedError (401), as the admin policies do.
 */
export async function callerOf(authorization: string | undefined, strapi: AdminUserStrapi): Promise<Caller> {
  const user = await requireAdminUser(authorization, strapi);
  const adminId = Number(user.id);
  if (!Number.isInteger(adminId)) throw new Error('the admin user has no numeric id');
  const email = text(user.email);
  return {
    adminId, email, name: `${text(user.firstname)} ${text(user.lastname)}`.trim() || email,
    superAdmin: user.blocked !== true && hasSuperAdminRole(user),
  };
}
