/**
 * Admin Securitate routes (spec 4, index "Admin Securitate"): the signed-in admin's own 2FA, devices, password and Google link. Content-api
 * routes with Strapi auth off and `global::is-admin` (T25 swaps it for `has-role`); the controller reads who the token belongs to, and every
 * change checks `Origin` first. Passkey rows (T21) sit before the parameter paths. Fixed paths come before parameter paths.
 */
const guard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/admin-auth/me/security', handler: 'admin-auth.security', config: guard },
    { method: 'POST', path: '/admin-auth/me/2fa/totp', handler: 'admin-auth.totpStart', config: guard },
    { method: 'POST', path: '/admin-auth/me/2fa/totp/confirm', handler: 'admin-auth.totpConfirm', config: guard },
    { method: 'DELETE', path: '/admin-auth/me/2fa/totp', handler: 'admin-auth.totpOff', config: guard },
    { method: 'POST', path: '/admin-auth/me/2fa/email', handler: 'admin-auth.emailStart', config: guard },
    { method: 'POST', path: '/admin-auth/me/2fa/email/confirm', handler: 'admin-auth.emailConfirm', config: guard },
    { method: 'DELETE', path: '/admin-auth/me/2fa/email', handler: 'admin-auth.emailOff', config: guard },
    { method: 'POST', path: '/admin-auth/me/backup-codes', handler: 'admin-auth.backupCodes', config: guard },
    { method: 'POST', path: '/admin-auth/me/reauth', handler: 'admin-auth.reauth', config: guard },
    { method: 'POST', path: '/admin-auth/me/passkeys/options', handler: 'admin-auth.passkeyStart', config: guard },
    { method: 'POST', path: '/admin-auth/me/passkeys', handler: 'admin-auth.passkeyAdd', config: guard },
    { method: 'POST', path: '/admin-auth/me/passkey-offer/dismiss', handler: 'admin-auth.passkeyDismiss', config: guard },
    { method: 'GET', path: '/admin-auth/me/devices', handler: 'admin-auth.devices', config: guard },
    { method: 'POST', path: '/admin-auth/me/password', handler: 'admin-auth.password', config: guard },
    { method: 'GET', path: '/admin-auth/me/google', handler: 'admin-auth.googleRead', config: guard },
    { method: 'DELETE', path: '/admin-auth/me/google', handler: 'admin-auth.googleUnlink', config: guard },
    { method: 'DELETE', path: '/admin-auth/me/devices/:id', handler: 'admin-auth.deviceDisconnect', config: guard },
    { method: 'PUT', path: '/admin-auth/me/passkeys/:id', handler: 'admin-auth.passkeyRename', config: guard },
    { method: 'DELETE', path: '/admin-auth/me/passkeys/:id', handler: 'admin-auth.passkeyDelete', config: guard },
  ],
};
