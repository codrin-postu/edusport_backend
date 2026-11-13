/**
 * Admin-guarded proxy routes to the skate-results API. Auth disabled but
 * gated by `global::has-role`, so only a logged-in CMS admin (whose Bearer
 * token the admin fetch client attaches) can reach them, never the public API.
 */
import { adminRoute } from '../../../club/admin-area';

const website = adminRoute('website');

export default {
  routes: [
    { method: 'GET', path: '/skate/skaters', handler: 'skate.searchSkaters', config: website },
    { method: 'GET', path: '/skate/skaters/:slug', handler: 'skate.getSkater', config: website },
    { method: 'GET', path: '/skate/skaters/:slug/results', handler: 'skate.skaterResults', config: website },
    { method: 'GET', path: '/skate/events', handler: 'skate.listEvents', config: website },
    { method: 'GET', path: '/skate/events/:id/results', handler: 'skate.eventResults', config: website },
    { method: 'DELETE', path: '/skate/events/:id', handler: 'skate.deleteEvent', config: website },
    { method: 'POST', path: '/skate/import', handler: 'skate.importCompetition', config: website },
    { method: 'POST', path: '/skate/skater-competitions', handler: 'skate.skaterCompetitions', config: website },
    { method: 'POST', path: '/skate/import-competition', handler: 'skate.importCompetitionById', config: website },
    { method: 'POST', path: '/skate/import-skater', handler: 'skate.importSkater', config: website },
    { method: 'POST', path: '/skate/jobs', handler: 'skate.createJob', config: website },
    { method: 'GET', path: '/skate/jobs', handler: 'skate.listJobs', config: website },
    { method: 'GET', path: '/skate/jobs/:id', handler: 'skate.getJob', config: website },
    { method: 'POST', path: '/skate/jobs/:id/cancel', handler: 'skate.cancelJob', config: website },
  ],
};
