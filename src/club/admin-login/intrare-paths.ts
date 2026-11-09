/**
 * Where Strapi's own auth pages go on `/intrare` (spec 4.1, 4.4). Pure and free of Node, Strapi and React: the route gate (server) and
 * the admin bundle's location listener (browser) both read it, so the two never disagree.
 */
export const ADMIN_AUTH_TARGET: Record<string, string> = {
  register: '/intrare/invitatie',
  'forgot-password': '/intrare/parola',
  'reset-password': '/intrare/parola',
};

/** The only query keys that cross over: the invite token and the reset code. */
export const KEEP_QUERY = ['registrationToken', 'code'] as const;

const AUTH_PREFIX = '/admin/auth/';

/** True for `/admin/auth/<anything>`, the pages Strapi's SPA draws for sign-in. */
export const isAdminAuthPath = (pathname: string): boolean => pathname.startsWith(AUTH_PREFIX);

/** The `/intrare` address of an `/admin/auth/<page>` path, keeping `registrationToken` and `code` of `query` (without the `?`). */
export function intrareRedirect(pathname: string, query: string): string {
  const target = ADMIN_AUTH_TARGET[pathname.slice(AUTH_PREFIX.length)] ?? '/intrare';
  const from = new URLSearchParams(query);
  const rest = [...from]
    .filter(([key]) => (KEEP_QUERY as readonly string[]).includes(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return rest ? `${target}?${rest}` : target;
}
