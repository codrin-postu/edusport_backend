/**
 * Portal sportiv routes (7-2). The policy `global::is-sportiv` checks the BFF secret, the session, the host and the live accesses on every call and sets
 * `ctx.state.holder`; each `:athleteId` handler then checks that the holder holds that athlete (controller `withAthlete`). Fixed paths before parameter paths:
 * `/me/*` and `/athletes` before `/athletes/:athleteId/*`, and `calendar.ics` has no parameter sibling.
 */
const guard = { auth: false, policies: ['global::is-sportiv'], middlewares: [] };

const gated = (feature: 'prezenta' | 'abonamente' | 'parcurs') => ({ ...guard, policies: ['global::is-sportiv', { name: 'global::portal-feature', config: { feature } }] });

const route = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, handler: string, config: object = guard) => ({ method, path: `/portal/sportiv${path}`, handler: `sportiv.${handler}`, config });

export default {
  routes: [
    route('GET', '/me', 'me'),
    route('PUT', '/me', 'saveMe'),
    route('PUT', '/me/notifications', 'saveNotifications'),
    route('POST', '/me/password', 'password'),
    route('GET', '/me/devices', 'devices'),
    route('DELETE', '/me/devices/:id', 'revokeDevice'),
    route('GET', '/me/notices', 'notices'),
    route('POST', '/me/notices/:noticeId/dismiss', 'dismissNotice'),
    route('GET', '/athletes', 'athletes'),
    route('GET', '/athletes/:athleteId/home', 'home'),
    route('POST', '/athletes/:athleteId/promotion/seen', 'promotionSeen'),
    route('GET', '/athletes/:athleteId/profile', 'profile'),
    route('GET', '/athletes/:athleteId/history', 'history', gated('prezenta')),
    route('GET', '/athletes/:athleteId/calendar.ics', 'calendarIcs'),
    route('GET', '/athletes/:athleteId/calendar', 'calendar'),
    route('GET', '/athletes/:athleteId/competitions', 'competitions'),
    route('GET', '/athletes/:athleteId/competitions/:resultId', 'competition'),
    route('GET', '/athletes/:athleteId/path', 'path', gated('parcurs')),
    route('GET', '/athletes/:athleteId/pin-recipients', 'pinRecipients', gated('parcurs')),
    route('POST', '/athletes/:athleteId/pins', 'givePin', gated('parcurs')),
    route('GET', '/athletes/:athleteId/money', 'money', gated('abonamente')),
    route('GET', '/athletes/:athleteId/payments', 'payments', gated('abonamente')),
    route('GET', '/athletes/:athleteId/subscriptions', 'subscriptions', gated('abonamente')),
    route('GET', '/athletes/:athleteId/documents/acord', 'acord'),
  ],
};
