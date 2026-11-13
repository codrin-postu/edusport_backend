/** "Începe sezonul <next>" and the per-group copies (spec 10.9). Admin only; fixed paths before parameter paths. */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'GET', path: '/club/seasons/:documentId/start', handler: 'new-season.data', config: club },
    { method: 'POST', path: '/club/seasons/:documentId/start/preview', handler: 'new-season.preview', config: club },
    { method: 'POST', path: '/club/seasons/:documentId/start', handler: 'new-season.apply', config: club },
    { method: 'POST', path: '/club/groups/:documentId/copy-members', handler: 'new-season.copyMembers', config: club },
    { method: 'POST', path: '/club/groups/:documentId/copy-program', handler: 'new-season.copyProgram', config: club },
  ],
};
