/**
 * Admin API of Abonamente (spec 6). Content-api routes (under /api), auth off, `global::has-role`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
import { adminRoute, featureRoute } from '../../../club/admin-area';

const club = featureRoute('abonamente', 'club');
/** The athlete record's groups tab reads this with `abonamente` off too; the controller then leaves the abonamente out. */
const groupsRead = adminRoute('club');

export default {
  routes: [
    { method: 'GET', path: '/club/subscriptions', handler: 'subscriptions.list', config: club },
    { method: 'GET', path: '/club/subscriptions/extend/preview', handler: 'subscriptions.extendPreview', config: club },
    { method: 'POST', path: '/club/subscriptions/extend', handler: 'subscriptions.extend', config: club },
    { method: 'POST', path: '/club/subscriptions/:documentId/cancel', handler: 'subscriptions.cancel', config: club },
    { method: 'GET', path: '/club/athletes/:documentId/subscriptions/new', handler: 'subscriptions.form', config: club },
    { method: 'GET', path: '/club/athletes/:documentId/subscriptions', handler: 'subscriptions.athlete', config: groupsRead },
    { method: 'POST', path: '/club/athletes/:documentId/subscriptions', handler: 'subscriptions.add', config: club },
  ],
};
