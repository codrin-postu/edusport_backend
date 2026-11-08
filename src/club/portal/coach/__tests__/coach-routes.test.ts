import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import routes from '../../../../api/portal/routes/02-coach';
import controller from '../../../../api/portal/controllers/coach';
import { staticBeforeParams } from '../../../groups/__tests__/route-order';

const EXPECTED = [
  'GET /portal/coach/me', 'PUT /portal/coach/me', 'POST /portal/coach/me/password', 'GET /portal/coach/me/devices', 'DELETE /portal/coach/me/devices/:id',
  'GET /portal/coach/today', 'GET /portal/coach/groups', 'GET /portal/coach/groups/:documentId', 'GET /portal/coach/groups/:documentId/program',
  'GET /portal/coach/groups/:documentId/saved-days',
  'POST /portal/coach/groups/:documentId/program', 'PUT /portal/coach/groups/:documentId/program-public', 'POST /portal/coach/groups/:documentId/members',
  'POST /portal/coach/groups/:documentId/members/:athleteId/move', 'POST /portal/coach/groups/:documentId/members/:athleteId/remove',
  'GET /portal/coach/session', 'POST /portal/coach/session/check', 'PUT /portal/coach/session',
  'POST /portal/coach/lessons', 'GET /portal/coach/lessons/:documentId', 'PUT /portal/coach/lessons/:documentId', 'DELETE /portal/coach/lessons/:documentId',
  'GET /portal/coach/athletes/search', 'POST /portal/coach/athletes', 'GET /portal/coach/athletes/:documentId',
  'GET /portal/coach/history',
  'PUT /portal/coach/program/:eventId', 'POST /portal/coach/program/:eventId/end', 'DELETE /portal/coach/program/:eventId', 'PUT /portal/coach/program/:eventId/dates/:date',
];

describe('portal coach routes', () => {
  it('are exactly the listed ones, in this order', () => {
    expect(routes.routes.map((r) => `${r.method} ${r.path}`)).toEqual(EXPECTED);
  });

  it('keep fixed paths before parameter paths', () => {
    const paths = routes.routes.map((r) => r.path);
    const resources = [...new Set(paths.map((p) => p.split('/')[3]))];
    for (const resource of resources) expect(staticBeforeParams(paths.filter((p) => p.split('/')[3] === resource).map((p) => p.replace('/portal/coach', '/portal/coach/x'))), resource).toBe(true);
  });

  it('turn off Strapi auth and run only global::is-coach', () => {
    for (const r of routes.routes) expect(r.config).toEqual({ auth: false, policies: ['global::is-coach'], middlewares: [] });
  });

  it('point at handlers that exist, each used once', () => {
    const handlers = controller as unknown as Record<string, unknown>;
    const names = routes.routes.map((r) => r.handler);
    for (const n of names) {
      const [name, action] = n.split('.');
      expect(name).toBe('coach');
      expect(typeof handlers[action], n).toBe('function');
    }
    expect(new Set(names).size).toBe(names.length);
  });
});

const IMPORT = /(?:from|import\()\s*['"]([^'"]+)['"]/g;
const MONEY = /(money-api|\/due\/|\/payments\/|billing)/;
const filesUnder = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.isDirectory()) return e.name === '__tests__' ? [] : filesUnder(join(dir, e.name));
  return e.name.endsWith('.ts') ? [join(dir, e.name)] : [];
});

describe('coach code stays off the money side', () => {
  it('no coach file or the coach controller imports money-api, due, payments or billing', () => {
    const files = [...filesUnder(join(__dirname, '..')), join(__dirname, '../../../../api/portal/controllers/coach.ts')];
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const imports = [...readFileSync(f, 'utf8').matchAll(IMPORT)].map((m) => m[1]);
      expect(imports.filter((i) => MONEY.test(i)), f).toEqual([]);
    }
  });
});
