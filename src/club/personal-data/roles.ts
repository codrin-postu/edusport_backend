/** The Super Admin role (3C spec 6). Pure: the admin bundle imports it to hide Super Admin actions; the policy is the authority. */
export const SUPER_ADMIN_CODE = 'strapi-super-admin';

type Raw = Record<string, unknown>;
const isRaw = (v: unknown): v is Raw => !!v && typeof v === 'object';

export function hasSuperAdminRole(user: unknown): boolean {
  const roles = isRaw(user) ? user.roles : null;
  return Array.isArray(roles) && roles.some((r) => isRaw(r) && r.code === SUPER_ADMIN_CODE);
}

/** Body of GET /admin/users/me: `{ data: <admin user with roles> }`. */
export const superAdminFromMe = (body: unknown): boolean => hasSuperAdminRole(isRaw(body) ? body.data : null);
