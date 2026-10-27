import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import attendance from '../../../api/club/controllers/attendance';
import attendanceRoutes from '../../../api/club/routes/09-attendance';

const SRC = join(__dirname, '../../..');
const routes = attendanceRoutes.routes;

/** Within one path prefix, every path after the first parameter path is a parameter path too (spec 10.9 rule). */
function staticBeforeParams(paths: string[]): boolean {
  const prefixes = [...new Set(paths.map((p) => p.split('/').slice(0, 3).join('/')))];
  return prefixes.every((prefix) => {
    const own = paths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix);
    const firstParam = own.findIndex((p) => p.includes(':'));
    return firstParam < 0 || own.slice(firstParam).every((p) => p.includes(':'));
  });
}

describe('09-attendance routes (6)', () => {
  it('are all admin-only and point at handlers that exist (6, 11.3)', () => {
    for (const r of routes) {
      expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
      expect(typeof (attendance as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
      expect(r.handler.startsWith('attendance.')).toBe(true);
    }
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
    expect(staticBeforeParams(['/club/lessons/:documentId', '/club/lessons/new'])).toBe(false);
  });

  it('are exactly the attendance routes', () => {
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /club/attendance/day', 'GET /club/attendance/session/defaults', 'POST /club/attendance/session/check', 'GET /club/attendance/session',
      'PUT /club/attendance/session', 'GET /club/attendance/coaches', 'GET /club/attendance/coaches.csv', 'GET /club/lessons', 'GET /club/lessons/new',
      'POST /club/lessons', 'GET /club/lessons/:documentId', 'PUT /club/lessons/:documentId', 'DELETE /club/lessons/:documentId',
      'GET /club/groups/:documentId/attendance', 'GET /club/athletes/:documentId/attendance']);
  });

  it('the CSV handler sends a file and the save handler answers the inactive 409 (C43, decided 2)', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
    expect(src).toContain("'text/csv; charset=utf-8'");
    expect(src).toMatch(/attachment; filename="\$\{coachesCsvName\(/);
    expect(src).toContain('respondSave(');
  });
});
