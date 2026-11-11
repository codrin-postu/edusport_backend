import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import athletes from '../../../api/club/controllers/athletes';
import groups from '../../../api/club/controllers/groups';
import payments from '../../../api/club/controllers/payments';
import subscriptions from '../../../api/club/controllers/subscriptions';
import groupRoutes from '../../../api/club/routes/06-groups';
import paymentRoutes from '../../../api/club/routes/11-payments';
import subscriptionRoutes from '../../../api/club/routes/10-subscriptions';
import { areaOfRoute } from '../../admin-area';
import { staticBeforeParams } from '../../groups/__tests__/route-order';

const SRC = join(__dirname, '../../..');
const CONTROLLERS: Record<string, Record<string, unknown>> = { groups, athletes, payments, subscriptions };

describe('money routes (spec 6, 11.3)', () => {
  it('every route is admin only (6, 11.3); the money routes name their area', () => {
    for (const r of [...subscriptionRoutes.routes, ...paymentRoutes.routes]) {
      if (r.path.startsWith('/club/money/')) expect(areaOfRoute(r.config), r.path).toBe('money');
      else expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
    }
  });
  it('static before parameter paths in each file; move preview in 06-groups (P4 8.2)', () => {
    for (const file of [subscriptionRoutes, paymentRoutes, groupRoutes]) expect(staticBeforeParams(file.routes.map((r) => r.path))).toBe(true);
    expect(groupRoutes.routes.some((r) => r.path === '/club/memberships/:documentId/move-preview' && r.handler === 'groups.movePreview')).toBe(true);
  });
});
