import { errors } from '@strapi/utils';

type AccessCheck =
  | { isValid: true; payload: { userId: unknown; sessionId: unknown } }
  | { isValid: false; payload: null };

/** Strapi 5's admin session manager, as the admin auth strategy uses it. */
type AdminSessions = {
  validateAccessToken: (token: string) => AccessCheck;
  isSessionActive: (sessionId: string) => Promise<boolean>;
};

/** The parts of Strapi the token check needs; `Core.Strapi` satisfies it. */
export type TokenStrapi = { sessionManager?: (origin: 'admin') => AdminSessions };

/** The parts of Strapi the admin policies need; `Core.Strapi` satisfies it. */
export type AdminUserStrapi = TokenStrapi & {
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; populate: string[] }) => Promise<unknown> } };
};

export type AdminUser = Record<string, unknown>;

async function sessionUserId(token: string, sessions: AdminSessions): Promise<unknown> {
  const result = sessions.validateAccessToken(token);
  if (!result.isValid) return null;
  const { userId, sessionId } = result.payload;
  if (typeof sessionId !== 'string' || !(await sessions.isSessionActive(sessionId))) return null;
  return userId;
}

/** The id as Strapi's admin strategy reads it: a numeric string becomes a number; anything not a scalar is no id. */
function adminUserId(raw: unknown): string | number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || !raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && String(n) === raw ? n : raw;
}

/**
 * The admin id behind a request, as Strapi's own admin auth strategy decides it: a Bearer admin ACCESS token whose
 * session is still active. Logged-out, expired and refresh tokens give null; so does everything when Strapi has no
 * session manager (a token cannot be checked against its session then). Never throws.
 */
export async function verifiedAdminId(authorization: string | undefined, strapi: TokenStrapi): Promise<string | number | null> {
  try {
    if (!authorization?.startsWith('Bearer ') || !strapi.sessionManager) return null;
    return adminUserId(await sessionUserId(authorization.slice(7), strapi.sessionManager('admin')));
  } catch {
    return null;
  }
}

const unauthorized = () => new errors.UnauthorizedError('Missing or invalid credentials');
const isActiveUser = (user: unknown): user is AdminUser => !!user && typeof user === 'object' && (user as AdminUser).isActive === true;

/**
 * For the admin policies, step by step as Strapi's admin auth strategy: an access token of an active session, then
 * the admin user (loaded once, with roles) must exist and be active. Otherwise Strapi's UnauthorizedError (401), so
 * the admin fetch client refreshes the access token and retries once. A failing lookup throws (500).
 */
export async function requireAdminUser(authorization: string | undefined, strapi: AdminUserStrapi): Promise<AdminUser> {
  const id = await verifiedAdminId(authorization, strapi);
  if (id === null) throw unauthorized();
  const user = await strapi.db.query('admin::user').findOne({ where: { id }, populate: ['roles'] });
  if (!isActiveUser(user)) throw unauthorized();
  return user;
}

function hasAdminSessions(strapi: object): boolean {
  try {
    return typeof (strapi as TokenStrapi).sessionManager === 'function';
  } catch {
    return false;
  }
}

/** Startup: without Strapi's session manager every custom admin route answers 401; say so once. */
export function warnIfNoAdminSessions(strapi: { log: { error: (message: string) => void } }): void {
  if (!hasAdminSessions(strapi)) strapi.log.error('[admin-auth] Strapi has no admin session manager: every custom admin route answers 401');
}
