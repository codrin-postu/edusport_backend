/**
 * Coach routes (spec 6.2). The policy `global::is-coach` checks the BFF secret, the session and the account on every
 * call and sets `ctx.state.coach`. Fixed paths before parameter paths within each prefix.
 */
const guard = { auth: false, policies: ['global::is-coach'], middlewares: [] };

const gated = (feature: 'prezenta' | 'parcurs') => ({ ...guard, policies: ['global::is-coach', { name: 'global::portal-feature', config: { feature } }] });

const route = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, handler: string, config: object = guard) => ({ method, path: `/portal/coach${path}`, handler: `coach.${handler}`, config });

export default {
  routes: [
    route('GET', '/me', 'me'),
    route('PUT', '/me', 'saveMe'),
    route('POST', '/me/password', 'password'),
    route('GET', '/me/devices', 'devices'),
    route('DELETE', '/me/devices/:id', 'revokeDevice'),
    route('GET', '/today/club', 'todayClub'),
    route('GET', '/today', 'today'),
    route('GET', '/calendar', 'calendar'),
    route('GET', '/competitions', 'competitions'),
    route('GET', '/groups', 'groups'),
    route('GET', '/groups/:documentId', 'group'),
    route('GET', '/groups/:documentId/program', 'program'),
    route('GET', '/groups/:documentId/saved-days', 'savedDays', gated('prezenta')),
    route('POST', '/groups/:documentId/program', 'addProgram'),
    route('PUT', '/groups/:documentId/program-public', 'programPublic'),
    route('POST', '/groups/:documentId/members', 'addMembers'),
    route('POST', '/groups/:documentId/members/:athleteId/move', 'moveMember'),
    route('POST', '/groups/:documentId/members/:athleteId/remove', 'removeMember'),
    route('GET', '/session', 'session', gated('prezenta')),
    route('POST', '/session/check', 'sessionCheck', gated('prezenta')),
    route('PUT', '/session', 'saveSession', gated('prezenta')),
    route('POST', '/lessons', 'createLesson', gated('prezenta')),
    route('PUT', '/lessons/:documentId/plan', 'planLesson', gated('prezenta')),
    route('GET', '/lessons/:documentId', 'lesson', gated('prezenta')),
    route('PUT', '/lessons/:documentId', 'saveLesson', gated('prezenta')),
    route('POST', '/lessons/:documentId/cancel', 'cancelLesson', gated('prezenta')),
    route('DELETE', '/lessons/:documentId', 'deleteLesson', gated('prezenta')),
    route('GET', '/athletes/search', 'searchAthletes'),
    route('POST', '/athletes', 'addAthlete'),
    route('GET', '/athletes/:athleteId/parcurs', 'parcurs', gated('parcurs')),
    route('POST', '/athletes/:athleteId/awards', 'addAward', gated('parcurs')),
    route('DELETE', '/athletes/:athleteId/awards/:awardId', 'removeAward', gated('parcurs')),
    route('GET', '/athletes/:documentId', 'athlete'),
    route('GET', '/athletes/:athleteId/competitions/:resultId/protocol', 'protocol'),
    route('GET', '/history', 'history', gated('prezenta')),
    route('PUT', '/program/:eventId', 'changeProgram'),
    route('POST', '/program/:eventId/end', 'endProgram'),
    route('DELETE', '/program/:eventId', 'deleteClass'),
    route('PUT', '/program/:eventId/dates/:date', 'setDate'),
  ],
};
