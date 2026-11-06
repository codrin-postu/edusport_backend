/**
 * The coach portal has its own auth routes. Users-permissions is kept only for
 * its user model and refresh-session manager, so its content-api routes
 * (/api/auth/*, /api/connect/*, /api/users*, /api/users-permissions/*) are removed.
 * In 5.52.1 `plugin.routes['content-api']` is a factory function whose `routes` property is settable.
 */
type RouteGroup = { routes: unknown[] };

export default (plugin: { routes: Record<string, unknown> }) => {
  const api = plugin.routes['content-api'] as RouteGroup | undefined;
  if (api) api.routes = [];
  return plugin;
};
