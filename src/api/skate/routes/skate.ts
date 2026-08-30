/**
 * Admin-guarded proxy routes to the skate-results API. Auth disabled but
 * gated by `global::is-admin`, so only a logged-in CMS admin (whose Bearer
 * token the admin fetch client attaches) can reach them, never the public API.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/skate/skaters', handler: 'skate.searchSkaters', config: adminGuard },
    { method: 'GET', path: '/skate/skaters/:slug', handler: 'skate.getSkater', config: adminGuard },
    { method: 'GET', path: '/skate/skaters/:slug/results', handler: 'skate.skaterResults', config: adminGuard },
    { method: 'GET', path: '/skate/events', handler: 'skate.listEvents', config: adminGuard },
    { method: 'GET', path: '/skate/events/:id/results', handler: 'skate.eventResults', config: adminGuard },
    { method: 'DELETE', path: '/skate/events/:id', handler: 'skate.deleteEvent', config: adminGuard },
    { method: 'POST', path: '/skate/import', handler: 'skate.importCompetition', config: adminGuard },
    { method: 'POST', path: '/skate/skater-competitions', handler: 'skate.skaterCompetitions', config: adminGuard },
    { method: 'POST', path: '/skate/import-competition', handler: 'skate.importCompetitionById', config: adminGuard },
    { method: 'POST', path: '/skate/import-skater', handler: 'skate.importSkater', config: adminGuard },
  ],
};
