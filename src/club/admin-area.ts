/** Role areas of the admin routes (6b spec 9.2, keys verbatim). Pure and free of imports: the admin bundle may use it. */
export type AdminArea = 'any' | 'website' | 'club' | 'money' | 'coachAccounts' | 'settings' | 'superAdmin';

export const ADMIN_AREAS: readonly AdminArea[] = ['any', 'website', 'club', 'money', 'coachAccounts', 'settings', 'superAdmin'];

export type AdminRouteConfig = {
  auth: false;
  policies: [{ name: 'global::has-role'; config: { area: AdminArea } }];
  middlewares: [];
};

/** Route config of an admin-only route that names its area. `global::has-role` grants it by role. */
export const adminRoute = (area: AdminArea): AdminRouteConfig => ({
  auth: false,
  policies: [{ name: 'global::has-role', config: { area } }],
  middlewares: [],
});

/** The area of an `adminRoute` config, else null (a route that names no area). */
export function areaOfRoute(config: unknown): AdminArea | null {
  if (typeof config !== 'object' || config === null) return null;
  const policies = (config as { policies?: unknown }).policies;
  if (!Array.isArray(policies)) return null;
  for (const p of policies) {
    if (typeof p !== 'object' || p === null || (p as { name?: unknown }).name !== 'global::has-role') continue;
    const area = (p as { config?: { area?: unknown } }).config?.area;
    if (typeof area === 'string' && (ADMIN_AREAS as readonly string[]).includes(area)) return area as AdminArea;
  }
  return null;
}
