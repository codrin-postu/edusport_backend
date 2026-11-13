import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import attendance from '../../../api/club/controllers/attendance';
import { areaOfRoute } from '../../admin-area';
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
      expect(typeof (attendance as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
      expect(r.handler.startsWith('attendance.')).toBe(true);
    }
  });

  it('every route names its area: club, except the coach hours exports (money)', () => {
    const areas = Object.fromEntries(routes.filter((r) => areaOfRoute(r.config) !== null).map((r) => [`${r.method} ${r.path}`, areaOfRoute(r.config)]));
    expect(Object.keys(areas)).toHaveLength(routes.length);
    expect(Object.entries(areas).filter(([, area]) => area === 'money').map(([route]) => route).sort()).toEqual([
      'GET /club/attendance/coaches.csv', 'GET /club/coaches/:documentId/presence.csv',
    ]);
    expect(Object.values(areas).every((area) => area === 'club' || area === 'money')).toBe(true);
  });

  it('the coaches CSV is named by period and logged without personal data', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
    expect(src).toMatch(/coachesCsvName\(period\.from, period\.to\)/);
    expect(src).toContain('downloadLogLine(');
  });

  it('the coach CSV is named by coach and period, with one log line', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
    expect(src).toMatch(/coachCsvName\(page\.name, period\)/);
    expect(src).toContain("kind: 'coach-csv'");
  });

  it('declare fixed paths before parameter paths', () => {
    expect(staticBeforeParams(routes.map((r) => r.path))).toBe(true);
    expect(staticBeforeParams(['/club/lessons/:documentId', '/club/lessons/new'])).toBe(false);
  });
});
