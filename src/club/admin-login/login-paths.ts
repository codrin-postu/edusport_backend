/**
 * Where Strapi's own auth pages go on `/login` (spec 4.1, 4.4). Pure and free of Node, Strapi and React: the route gate (server) and
 * the admin bundle's location listener (browser) both read it, so the two never disagree.
 */
export const ADMIN_AUTH_TARGET: Record<string, string> = {
  register: '/invite',
  'forgot-password': '/forgot-password',
  'reset-password': '/forgot-password',
};

/** The only query key that crosses over: the invite token. A reset code never does: our reset mail carries the code, not a link. */
export const KEEP_QUERY = ['registrationToken'] as const;

const AUTH_PREFIX = '/admin/auth/';

/** True for `/admin/auth/<anything>`, the pages Strapi's SPA draws for sign-in. */
export const isAdminAuthPath = (pathname: string): boolean => pathname.startsWith(AUTH_PREFIX);

/** The `/login` address of an `/admin/auth/<page>` path, keeping `registrationToken` of `query` (without the `?`). */
export function loginRedirect(pathname: string, query: string): string {
  const target = ADMIN_AUTH_TARGET[pathname.slice(AUTH_PREFIX.length)] ?? '/login';
  const from = new URLSearchParams(query);
  const rest = [...from]
    .filter(([key]) => (KEEP_QUERY as readonly string[]).includes(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return rest ? `${target}?${rest}` : target;
}
