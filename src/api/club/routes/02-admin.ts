import { adminRoute } from '../../../club/admin-area';

const any = adminRoute('any');

export default {
  routes: [{ method: 'GET', path: '/club/summary', handler: 'club.summary', config: any }],
};
