/**
 * Coach routes (spec 6.2). The policy `global::is-coach` checks the BFF secret, the session and the account on every
 * call and sets `ctx.state.coach`. Fixed paths before parameter paths within each prefix.
 */
const guard = { auth: false, policies: ['global::is-coach'], middlewares: [] };

const route = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, handler: string) => ({ method, path: `/portal/coach${path}`, handler: `coach.${handler}`, config: guard });

export default {
  routes: [
    route('GET', '/me', 'me'),
    route('PUT', '/me', 'saveMe'),
    route('POST', '/me/password', 'password'),
    route('GET', '/me/devices', 'devices'),
    route('DELETE', '/me/devices/:id', 'revokeDevice'),
    route('GET', '/today', 'today'),
    route('GET', '/groups', 'groups'),
    route('GET', '/groups/:documentId', 'group'),
    route('GET', '/groups/:documentId/program', 'program'),
    route('GET', '/groups/:documentId/saved-days', 'savedDays'),
    route('POST', '/groups/:documentId/program', 'addProgram'),
    route('PUT', '/groups/:documentId/program-public', 'programPublic'),
    route('POST', '/groups/:documentId/members', 'addMembers'),
    route('GET', '/session', 'session'),
    route('POST', '/session/check', 'sessionCheck'),
    route('PUT', '/session', 'saveSession'),
    route('POST', '/lessons', 'createLesson'),
    route('GET', '/lessons/:documentId', 'lesson'),
    route('PUT', '/lessons/:documentId', 'saveLesson'),
    route('DELETE', '/lessons/:documentId', 'deleteLesson'),
    route('GET', '/athletes/search', 'searchAthletes'),
    route('POST', '/athletes', 'addAthlete'),
    route('GET', '/athletes/:documentId', 'athlete'),
    route('GET', '/history', 'history'),
    route('PUT', '/program/:eventId', 'changeProgram'),
    route('POST', '/program/:eventId/end', 'endProgram'),
    route('DELETE', '/program/:eventId', 'deleteClass'),
    route('PUT', '/program/:eventId/dates/:date', 'setDate'),
  ],
};
