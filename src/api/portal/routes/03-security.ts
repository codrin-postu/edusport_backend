/**
 * Portal Securitate routes (index "Portal Securitate"): the signed-in coach's own 2FA. `global::is-coach` checks the BFF secret (403), the
 * Bearer session (401) and the account, and leaves the coach on `ctx.state.coach`. Fixed paths before parameter paths (none here yet).
 */
const guard = { auth: false, policies: ['global::is-coach'], middlewares: [] };

const route = (method: 'GET' | 'POST' | 'DELETE', path: string, handler: string) => ({ method, path: `/portal/me${path}`, handler: `portal-security.${handler}`, config: guard });

export default {
  routes: [
    route('GET', '/security', 'security'),
    route('POST', '/2fa/totp', 'totpStart'),
    route('POST', '/2fa/totp/confirm', 'totpConfirm'),
    route('DELETE', '/2fa/totp', 'totpOff'),
    route('POST', '/2fa/email', 'emailStart'),
    route('POST', '/2fa/email/confirm', 'emailConfirm'),
    route('DELETE', '/2fa/email', 'emailOff'),
    route('POST', '/backup-codes', 'backupCodes'),
  ],
};
