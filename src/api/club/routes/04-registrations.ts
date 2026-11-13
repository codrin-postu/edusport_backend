/**
 * Admin API of the Înscrieri confirmation (spec 3, 4). Content-api routes (under /api) with auth off and the
 * `global::has-role` policy. Bulk paths first, then the per-registration ones.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'POST', path: '/club/registrations/move-school', handler: 'registrations.moveSchoolBulk', config: club },
    { method: 'GET', path: '/club/registrations/:documentId/history', handler: 'registrations.history', config: club },
    { method: 'GET', path: '/club/registrations/:documentId/match', handler: 'registrations.match', config: club },
    { method: 'GET', path: '/club/registrations/:documentId/confirm-context', handler: 'registrations.confirmContext', config: club },
    { method: 'POST', path: '/club/registrations/:documentId/confirm', handler: 'registrations.confirm', config: club },
    { method: 'POST', path: '/club/registrations/:documentId/undo-confirmation', handler: 'registrations.undo', config: club },
    { method: 'POST', path: '/club/registrations/:documentId/move-school', handler: 'registrations.moveSchool', config: club },
  ],
};
