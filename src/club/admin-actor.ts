import { errors } from '@strapi/utils';
import jwt from 'jsonwebtoken';

/** The parts of Strapi the actor lookup needs; `Core.Strapi` satisfies it. */
export type ActorStrapi = {
  config: { get: (key: string) => unknown };
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; select: string[] }) => Promise<unknown> } };
};

type AccessCheck =
  | { isValid: true; payload: { userId: unknown; sessionId: unknown } }
  | { isValid: false; payload: null };

/** Strapi 5's admin session manager, as the admin auth strategy uses it. */
type AdminSessions = {
  validateAccessToken: (token: string) => AccessCheck;
  isSessionActive: (sessionId: string) => Promise<boolean>;
};

/** The parts of Strapi the token check needs; `Core.Strapi` satisfies it. */
export type TokenStrapi = {
  config: { get: (key: string) => unknown };
  sessionManager?: (origin: 'admin') => AdminSessions;
};

/** Written on history entries when the admin cannot be identified (the route policy already checked the token). */
export const UNKNOWN_ACTOR = 'admin';

function adminIdFrom(authorization: string | undefined, secret: unknown): unknown {
  if (!authorization?.startsWith('Bearer ') || typeof secret !== 'string' || !secret) return null;
  const payload = jwt.verify(authorization.slice(7), secret);
  if (!payload || typeof payload !== 'object') return null;
  return payload.userId ?? payload.id ?? payload.sub ?? null;
}

async function sessionUserId(token: string, sessions: AdminSessions): Promise<unknown> {
  const result = sessions.validateAccessToken(token);
  if (!result.isValid) return null;
  const { userId, sessionId } = result.payload;
  if (typeof sessionId !== 'string' || !(await sessions.isSessionActive(sessionId))) return null;
  return userId;
}

/** Only when Strapi has no session manager: an HS256 admin access token, still never a refresh token. */
function accessTokenUserId(token: string, secret: unknown): unknown {
  if (typeof secret !== 'string' || !secret) return null;
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  return payload && typeof payload === 'object' && payload.type === 'access' ? payload.userId : null;
}

/** The id as Strapi's admin strategy reads it: a numeric string becomes a number; anything not a scalar is no id. */
function adminUserId(raw: unknown): string | number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || !raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && String(n) === raw ? n : raw;
}

/**
 * The admin behind a request, as Strapi's own admin auth strategy decides it: a Bearer admin ACCESS token whose
 * session is still active (logged-out, expired and refresh tokens give null). Never throws.
 */
export async function verifiedAdminId(authorization: string | undefined, strapi: TokenStrapi): Promise<string | number | null> {
  try {
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice(7);
    const raw = strapi.sessionManager
      ? await sessionUserId(token, strapi.sessionManager('admin'))
      : accessTokenUserId(token, strapi.config.get('admin.auth.secret'));
    return adminUserId(raw);
  } catch {
    return null;
  }
}

/**
 * For the admin policies: no access token of an active admin session is a 401 (Strapi's own UnauthorizedError and
 * message), so the admin fetch client refreshes the access token and retries once.
 */
export async function requireAdminId(authorization: string | undefined, strapi: TokenStrapi): Promise<string | number> {
  const id = await verifiedAdminId(authorization, strapi);
  if (id === null) throw new errors.UnauthorizedError('Missing or invalid credentials');
  return id;
}

/**
 * Who makes an admin request, for history entries: the admin's e-mail, read from the admin JWT after
 * `global::is-admin` has checked it. Never throws.
 */
export async function adminActor(authorization: string | undefined, strapi: ActorStrapi): Promise<string> {
  try {
    const id = adminIdFrom(authorization, strapi.config.get('admin.auth.secret'));
    if (id === null || id === undefined) return UNKNOWN_ACTOR;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, select: ['email'] });
    const email = user && typeof user === 'object' ? (user as { email?: unknown }).email : null;
    return typeof email === 'string' && email ? email : UNKNOWN_ACTOR;
  } catch {
    return UNKNOWN_ACTOR;
  }
}
