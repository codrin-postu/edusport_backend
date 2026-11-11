import { describe, expect, it } from 'vitest';
import routes from '../../../api/club/routes/08-new-season';

describe('08-new-season routes (10.9)', () => {
  it('are admin-only (any admin, W22)', () => {
    for (const r of routes.routes) expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
  });

  it('declare the preview path before the start path', () => {
    const paths = routes.routes.map((r) => `${r.method} ${r.path}`);
    expect(paths.indexOf('POST /club/seasons/:documentId/start/preview')).toBeLessThan(paths.indexOf('POST /club/seasons/:documentId/start'));
    expect(paths).toHaveLength(5);
  });
});
