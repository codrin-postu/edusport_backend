/**
 * Admin routes for the Google Sheets integration, mounted under /api/sheets.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::is-admin` policy — usable from the custom admin settings page (whose
 * fetch client attaches the admin Bearer token) but never from the public API.
 * Mirrors the submission admin route pattern.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/sheets/status', handler: 'sheet-link.status', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/verify', handler: 'sheet-link.verify', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/connect', handler: 'sheet-link.connect', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/create', handler: 'sheet-link.create', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/disconnect', handler: 'sheet-link.disconnect', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/sync', handler: 'sheet-link.sync', config: adminGuard },
    { method: 'GET', path: '/sheets/:form/history', handler: 'sheet-link.history', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/tab', handler: 'sheet-link.setTab', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/enabled', handler: 'sheet-link.setEnabled', config: adminGuard },
    { method: 'POST', path: '/sheets/:form/schedule', handler: 'sheet-link.setSchedule', config: adminGuard },
  ],
};
