import type { Core } from '@strapi/strapi';
import { adminById } from '../club/admin-login/admins';
import { normalizeAdminPath } from '../club/admin-login/admin-path';
import { adminSessionManager } from '../club/admin-login/session';

export type GateDecision = 'pass' | 'notFound' | 'forbidden' | 'profileEmail' | { redirect: string };

/** Strapi's own session issuers, closed (spec 4.4): sessions start only through `/api/admin-auth/*`. */
const CLOSED_POSTS = new Set(['/admin/login', '/admin/register', '/admin/register-admin', '/admin/reset-password', '/admin/forgot-password']);
const PASSWORD_KEYS = ['password', 'currentPassword'] as const;
const KEEP_QUERY = ['registrationToken', 'code'] as const;

const ADMIN_AUTH_TARGET: Record<string, string> = {
  register: '/intrare/invitatie',
  'forgot-password': '/intrare/parola',
  'reset-password': '/intrare/parola',
};

const hasKey = (body: unknown, key: string): boolean => typeof body === 'object' && body !== null && Object.prototype.hasOwnProperty.call(body, key);

function redirectFor(pathname: string, query: string): GateDecision {
  const target = ADMIN_AUTH_TARGET[pathname.slice('/admin/auth/'.length)] ?? '/intrare';
  const from = new URLSearchParams(query);
  const rest = [...from].filter(([key]) => (KEEP_QUERY as readonly string[]).includes(key)).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return { redirect: rest ? `${target}?${rest}` : target };
}

/**
 * Pure: what the gate does with a request. `path` may carry the query string (it is read only for the `/admin/auth/*` redirect).
 * Disabled (`ADMIN_GATE=off`) everything passes.
 */
export function gateDecision(method: string, path: string, body: unknown, enabled: boolean): GateDecision {
  if (!enabled) return 'pass';
  const [rawPath, ...queryParts] = path.split('?');
  const pathname = normalizeAdminPath(rawPath);
  const verb = method.toUpperCase();
  if (verb === 'POST' && CLOSED_POSTS.has(pathname)) return 'notFound';
  if (verb === 'PUT' && pathname === '/admin/users/me') {
    if (PASSWORD_KEYS.some((k) => hasKey(body, k))) return 'forbidden';
    return hasKey(body, 'email') ? 'profileEmail' : 'pass';
  }
  if (verb === 'PUT' && /^\/admin\/users\/[^/]+$/.test(pathname)) return hasKey(body, 'password') ? 'forbidden' : 'pass';
  if (verb === 'GET' && pathname.startsWith('/admin/auth/')) return redirectFor(pathname, queryParts.join('?'));
  return 'pass';
}

type GateCtx = {
  method: string; path: string; querystring: string; status: number; body: unknown; request: { body?: unknown };
  headers?: Record<string, string | string[] | undefined>; redirect: (to: string) => void;
};

const FORBIDDEN = 'Parola și e-mailul se schimbă din Securitate.';

const sameEmail = (a: unknown, b: unknown): boolean => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The gate runs before Strapi's auth, so for a profile save that carries `email` it reads the bearer token itself: an access token that
 * validates, whose admin still exists and has this e-mail. Anything else (no token, a bad one, a throw) is false (B3 M2).
 */
async function emailIsCurrent(strapi: Core.Strapi | undefined, ctx: GateCtx): Promise<boolean> {
  try {
    if (!strapi) return false;
    const header = ctx.headers?.authorization;
    const match = typeof header === 'string' ? /^Bearer (\S+)$/i.exec(header.trim()) : null;
    if (!match) return false;
    const checked = (await adminSessionManager(strapi).validateAccessToken(match[1])) as { isValid?: boolean; payload?: { userId?: string } };
    const id = Number(checked.payload?.userId);
    if (!checked.isValid || !Number.isInteger(id)) return false;
    const admin = await adminById(strapi, id);
    return admin !== null && sameEmail((ctx.request.body as Record<string, unknown>).email, admin.email);
  } catch {
    return false;
  }
}

/** Global middleware, right after `strapi::body` so the profile body is parsed (`ADMIN_GATE=off` opens the five routes again). */
export default (_config?: unknown, deps?: { strapi?: Core.Strapi }) => async (ctx: GateCtx, next: () => Promise<void>): Promise<void> => {
  let decision = gateDecision(ctx.method, ctx.querystring ? `${ctx.path}?${ctx.querystring}` : ctx.path, ctx.request.body, process.env.ADMIN_GATE !== 'off');
  if (decision === 'profileEmail') decision = (await emailIsCurrent(deps?.strapi, ctx)) ? 'pass' : 'forbidden';
  if (decision === 'pass') return next();
  if (typeof decision === 'object') return ctx.redirect(decision.redirect);
  ctx.status = decision === 'notFound' ? 404 : 403;
  ctx.body = decision === 'notFound'
    ? { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found', details: {} } }
    : { data: null, error: { status: 403, name: 'ForbiddenError', message: FORBIDDEN, details: {} } };
};
