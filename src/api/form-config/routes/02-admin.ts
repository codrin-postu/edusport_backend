/**
 * Admin form-config endpoints. Content-api routes (served under /api) with auth
 * disabled but guarded by `global::has-role` — usable from the custom admin
 * form editor (whose fetch client attaches the admin Bearer token) but never
 * from the public API. Mirrors the registration-submission admin route pattern.
 */
import { adminRoute } from '../../../club/admin-area';

const club = adminRoute('club');

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/:type/config/edit',
      handler: 'form-config.editConfig',
      config: club,
    },
    {
      method: 'PUT',
      path: '/forms/:type/config',
      handler: 'form-config.saveConfig',
      config: club,
    },
  ],
};
