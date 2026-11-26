/** Tour progress of the signed-in admin. Each admin reads and writes only their own. */
import { adminRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/onboarding', handler: 'onboarding.read', config: adminRoute('any') },
    { method: 'POST', path: '/club/onboarding', handler: 'onboarding.mark', config: adminRoute('any') },
  ],
};
