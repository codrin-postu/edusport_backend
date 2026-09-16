/**
 * The only publicly reachable announcement route.
 *
 * There is deliberately no core router for this collection: the full content
 * api would expose scheduled and expired rows to anyone who asked. `current`
 * does the filtering server-side and returns a single trimmed object.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/announcements/current',
      handler: 'announcement.current',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
