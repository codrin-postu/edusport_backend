import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import tables from '../../../api/club/controllers/tables';
import tableRoutes from '../../../api/club/routes/13-tables';
import { areaOfRoute } from '../../admin-area';

const SRC = join(__dirname, '../../..');
const routes = tableRoutes.routes;
const source = readFileSync(join(SRC, 'api/club/controllers/tables.ts'), 'utf8');

function staticBeforeParams(paths: string[]): boolean {
  const prefixes = [...new Set(paths.map((p) => p.split('/').slice(0, 3).join('/')))];
  return prefixes.every((prefix) => {
    const own = paths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix);
    const firstParam = own.findIndex((p) => p.includes(':'));
    return firstParam < 0 || own.slice(firstParam).every((p) => p.includes(':'));
  });
}

describe('13-tables routes', () => {

  it('every route is adminRoute money, and every handler exists', () => {
    for (const r of routes) {
      expect(areaOfRoute(r.config), r.path).toBe('money');
      expect(typeof (tables as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
    }
    expect(source).not.toMatch(/areaOfRoute|adminGuard/);
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
  });
});
