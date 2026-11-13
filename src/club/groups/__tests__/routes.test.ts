import { describe, expect, it } from 'vitest';
import { adminRoute } from '../../admin-area';
import groups from '../../../api/club/controllers/groups';
import groupRoutes from '../../../api/club/routes/06-groups';
import { staticBeforeParams } from './route-order';

const routes = groupRoutes.routes;
const controllers: Record<string, Record<string, unknown>> = { groups };

describe('06-groups routes (8.2)', () => {
  it('are all admin-only', () => {
    for (const r of routes) expect(r.config, r.path).toEqual(adminRoute('club'));
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
    expect(staticBeforeParams(['/club/groups/:documentId', '/club/groups/unassigned'])).toBe(false);
  });
});
