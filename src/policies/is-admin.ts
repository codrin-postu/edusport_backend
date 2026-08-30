/**
 * Global policy `global::is-admin`.
 *
 * Allows a request only when it carries a valid **admin** JWT (the token the
 * CMS admin panel stores after login and that `useFetchClient` attaches as a
 * Bearer header). Used to protect custom content-api routes that must be usable
 * from the admin UI but never from the public API, without granting
 * content-manager RBAC on a hidden collection.
 *
 * Strapi v5 admin access tokens are signed with `admin.auth.secret` and carry a
 * `userId` claim (not `id`).
 */
export default async (policyContext: any, _config: any, { strapi }: { strapi: any }) => {
  const authHeader = policyContext.request?.header?.authorization as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  try {
    const jwt = require('jsonwebtoken');
    const secret = strapi.config.get('admin.auth.secret');
    if (!secret) return false;
    const payload = jwt.verify(token, secret) as any;
    return Boolean(payload && (payload.userId ?? payload.id ?? payload.sub));
  } catch {
    return false;
  }
};
