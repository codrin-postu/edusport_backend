import { describe, expect, it } from 'vitest';
import controller from '../../../../api/club/controllers/portal-accounts';
import routes from '../../../../api/club/routes/12-portal-accounts';
import { staticBeforeParams } from '../../../groups/__tests__/route-order';

describe('portal account routes (spec 4)', () => {
  it('every handler exists in the controller; static before parameter paths', () => {
    for (const r of routes.routes) {
      const [name, fn] = r.handler.split('.');
      expect(name).toBe('portal-accounts');
      expect(typeof (controller as Record<string, unknown>)[fn], r.handler).toBe('function');
    }
    expect(staticBeforeParams(routes.routes.map((r) => r.path))).toBe(true);
  });
});
