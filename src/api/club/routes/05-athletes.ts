/**
 * Admin API of Sportivi (spec 5, 6) and personal data (3C). Content-api routes (under /api) with auth off and the
 * `global::has-role` policy; anonymizing and hiding the yearly review need `global::has-role (area `superAdmin`)` (3C spec 6).
 * Fixed paths (search, merge, by-profile, inactive-summary, anonymize) come before `/club/athletes/:documentId`.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');
const superAdmin = adminRoute('superAdmin');

export default {
  routes: [
    { method: 'GET', path: '/club/athletes', handler: 'athletes.list', config: club },
    { method: 'GET', path: '/club/athletes/search', handler: 'athletes.search', config: club },
    { method: 'GET', path: '/club/athletes/by-profile/:profileId', handler: 'athletes.byProfile', config: club },
    { method: 'POST', path: '/club/athletes', handler: 'athletes.add', config: club },
    { method: 'GET', path: '/club/athletes/merge-preview', handler: 'athletes.mergePreview', config: club },
    { method: 'POST', path: '/club/athletes/merge', handler: 'athletes.merge', config: club },
    { method: 'GET', path: '/club/athletes/inactive-summary', handler: 'personal-data.inactiveSummary', config: club },
    { method: 'POST', path: '/club/athletes/inactive-summary/hide', handler: 'personal-data.hideReview', config: superAdmin },
    { method: 'POST', path: '/club/athletes/anonymize', handler: 'personal-data.anonymizeMany', config: superAdmin },
    { method: 'POST', path: '/club/athlete-duplicates/:pairId/dismiss', handler: 'athletes.dismissDuplicate', config: club },
    { method: 'GET', path: '/club/athletes/:documentId/history', handler: 'athletes.history', config: club },
    { method: 'GET', path: '/club/athletes/:documentId/export', handler: 'personal-data.export', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/anonymize', handler: 'personal-data.anonymize', config: superAdmin },
    { method: 'GET', path: '/club/athletes/:documentId', handler: 'athletes.record', config: club },
    { method: 'PUT', path: '/club/athletes/:documentId', handler: 'athletes.update', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/profile', handler: 'athletes.createProfile', config: club },
    { method: 'PUT', path: '/club/athletes/:documentId/profile/visibility', handler: 'athletes.profileVisibility', config: club },
    { method: 'POST', path: '/club/athletes/:documentId/status', handler: 'athletes.status', config: club },
    { method: 'DELETE', path: '/club/athletes/:documentId', handler: 'athletes.remove', config: club },
  ],
};
