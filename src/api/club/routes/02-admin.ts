const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [{ method: 'GET', path: '/club/summary', handler: 'club.summary', config: adminGuard }],
};
