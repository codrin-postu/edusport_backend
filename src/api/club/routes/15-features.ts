/** Funcții: the five club-wide switches. Everyone signed in may read them, only the Super Admin saves. */
import { adminRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/features', handler: 'features.read', config: adminRoute('any') },
    { method: 'PUT', path: '/club/features', handler: 'features.save', config: adminRoute('superAdmin') },
  ],
};
