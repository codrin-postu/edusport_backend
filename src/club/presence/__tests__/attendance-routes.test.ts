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

  it('new phase 11 routes name their area; the others keep the phase 5 guard', () => {
    const areas = Object.fromEntries(routes.filter((r) => areaOfRoute(r.config) !== null).map((r) => [`${r.method} ${r.path}`, areaOfRoute(r.config)]));
    expect(areas).toEqual({
      'GET /club/attendance/period': 'club', 'GET /club/attendance/grid': 'club', 'GET /club/athletes/:documentId/presence': 'club',
      'GET /club/coaches/:documentId/presence.csv': 'money', 'GET /club/coaches/:documentId/presence': 'club',
    });
    for (const r of routes.filter((x) => areaOfRoute(x.config) === null)) expect(r.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
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

  it('are exactly the attendance routes', () => {
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /club/attendance/period', 'GET /club/attendance/grid', 'GET /club/attendance/session/defaults', 'POST /club/attendance/session/check', 'GET /club/attendance/session',
      'PUT /club/attendance/session', 'GET /club/attendance/coaches', 'GET /club/attendance/coaches.csv', 'GET /club/lessons', 'GET /club/lessons/new',
      'POST /club/lessons', 'GET /club/lessons/:documentId', 'PUT /club/lessons/:documentId', 'DELETE /club/lessons/:documentId',
      'GET /club/groups/:documentId/attendance', 'GET /club/athletes/:documentId/presence',
      'GET /club/coaches/:documentId/presence.csv', 'GET /club/coaches/:documentId/presence']);
  });

  it('the CSV handler sends a file and the save handler answers the inactive 409 (C43, decided 2)', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
    expect(src).toContain("'text/csv; charset=utf-8'");
    expect(src).toMatch(/attachment; filename="\$\{coachesCsvName\(/);
    expect(src).toContain('respondSave(');
  });

  it('the athlete presence history is one line over readPresenceHistory with the documentId, season and page', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/attendance.ts'), 'utf8');
    expect(src).toMatch(/async athletePresence\(ctx: AdminCtx\) \{\s+respond\(ctx, await readPresenceHistory\(store\(\), param\(ctx, 'documentId'\), ctx\.query\.season, ctx\.query\.page\)\);\s+\},/);
  });
});
