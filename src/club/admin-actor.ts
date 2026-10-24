import jwt from 'jsonwebtoken';

/** The parts of Strapi the actor lookup needs; `Core.Strapi` satisfies it. */
export type ActorStrapi = {
  config: { get: (key: string) => unknown };
  db: { query: (uid: 'admin::user') => { findOne: (args: { where: { id: unknown }; select: string[] }) => Promise<unknown> } };
};

/** Written on history entries when the admin cannot be identified (the route policy already checked the token). */
export const UNKNOWN_ACTOR = 'admin';

function adminIdFrom(authorization: string | undefined, secret: unknown): unknown {
  if (!authorization?.startsWith('Bearer ') || typeof secret !== 'string' || !secret) return null;
  const payload = jwt.verify(authorization.slice(7), secret);
  if (!payload || typeof payload !== 'object') return null;
  return payload.userId ?? payload.id ?? payload.sub ?? null;
}

/**
 * Who makes an admin request, for history entries: the admin's e-mail, read from the admin JWT
 * the same way `global::is-admin` checks it. Never throws.
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
