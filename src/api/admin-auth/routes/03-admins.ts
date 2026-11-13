/** Administratori (Super Admin only, spec 4): the list and "Resetează 2FA" of another admin. Area `superAdmin`. */
import { adminRoute } from '../../../club/admin-area';

const superAdmin = adminRoute('superAdmin');

export default {
  routes: [
    { method: 'GET', path: '/admin-auth/admins', handler: 'admin-auth.admins', config: superAdmin },
    { method: 'POST', path: '/admin-auth/admins/:id/reset-2fa', handler: 'admin-auth.adminReset2fa', config: superAdmin },
  ],
};
