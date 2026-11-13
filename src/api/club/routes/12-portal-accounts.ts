/**
 * Admin API of the coach accounts (phase 6-3, spec 4). Content-api routes (under /api), auth off, `global::has-role`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
import { adminRoute } from '../../../club/admin-area';

const coachAccounts = adminRoute('coachAccounts');

export default {
  routes: [
    { method: 'GET', path: '/club/team-members/:documentId/account', handler: 'portal-accounts.read', config: coachAccounts },
    { method: 'POST', path: '/club/team-members/:documentId/account/invite', handler: 'portal-accounts.invite', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/resend', handler: 'portal-accounts.resend', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/disable', handler: 'portal-accounts.disable', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/disable-all', handler: 'portal-accounts.disableAll', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/enable', handler: 'portal-accounts.enable', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/email', handler: 'portal-accounts.email', config: coachAccounts },
    { method: 'POST', path: '/club/portal-accounts/:documentId/reset-2fa', handler: 'portal-accounts.reset2fa', config: coachAccounts },
  ],
};
