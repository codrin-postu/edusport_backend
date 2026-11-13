import { isRecord } from '../narrow';
import { ROLE_CODES } from '../roles/map';

/** The Super Admin role (3C spec 6). Pure: the admin bundle imports it to hide Super Admin actions; the policy is the authority. */
export const SUPER_ADMIN_CODE = ROLE_CODES.superAdmin;

export function hasSuperAdminRole(user: unknown): boolean {
  const roles = isRecord(user) ? user.roles : null;
  return Array.isArray(roles) && roles.some((r) => isRecord(r) && r.code === SUPER_ADMIN_CODE);
}

/** Body of GET /admin/users/me: `{ data: <admin user with roles> }`. */
export const superAdminFromMe = (body: unknown): boolean => hasSuperAdminRole(isRecord(body) ? body.data : null);
