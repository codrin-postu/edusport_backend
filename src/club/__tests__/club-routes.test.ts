import { expect, it } from 'vitest';
import adminRoutes from '../../api/club/routes/02-admin';
import publicRoutes from '../../api/club/routes/01-public';

it('serves the public read without auth', () => {
  expect(publicRoutes.routes).toEqual([
    { method: 'GET', path: '/club/public', handler: 'club.publicInfo', config: { auth: false, policies: [], middlewares: [] } },
  ]);
});

it('keeps the summary admin-only', () => {
  expect(adminRoutes.routes[0].config.policies).toEqual(['global::is-admin']);
});
