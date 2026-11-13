/**
 * Admin routes for the Google Sheets integration, mounted under /api/sheets.
 *
 * Content-api routes (served under /api) with auth disabled but guarded by the
 * `global::has-role` policy — usable from the custom admin settings page (whose
 * fetch client attaches the admin Bearer token) but never from the public API.
 * Mirrors the submission admin route pattern.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    { method: 'GET', path: '/sheets/status', handler: 'sheet-link.status', config: club },
    { method: 'POST', path: '/sheets/:form/verify', handler: 'sheet-link.verify', config: club },
    { method: 'POST', path: '/sheets/:form/connect', handler: 'sheet-link.connect', config: club },
    { method: 'POST', path: '/sheets/:form/create', handler: 'sheet-link.create', config: club },
    { method: 'POST', path: '/sheets/:form/disconnect', handler: 'sheet-link.disconnect', config: club },
    { method: 'POST', path: '/sheets/:form/sync', handler: 'sheet-link.sync', config: club },
    { method: 'GET', path: '/sheets/:form/history', handler: 'sheet-link.history', config: club },
    { method: 'POST', path: '/sheets/:form/tab', handler: 'sheet-link.setTab', config: club },
    { method: 'POST', path: '/sheets/:form/enabled', handler: 'sheet-link.setEnabled', config: club },
    { method: 'POST', path: '/sheets/:form/schedule', handler: 'sheet-link.setSchedule', config: club },
  ],
};
