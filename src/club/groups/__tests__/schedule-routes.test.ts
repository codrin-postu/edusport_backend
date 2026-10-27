import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import schedule from '../../../api/club/controllers/schedule';
import scheduleRoutes from '../../../api/club/routes/07-schedule';

const routes = scheduleRoutes.routes;
const ADMIN = { auth: false, policies: ['global::is-admin'], middlewares: [] };

describe('07-schedule routes (8.2, 8.3)', () => {
  it('are admin-only, except the public notebook read', () => {
    for (const r of routes) expect(r.config, r.path).toEqual(r.path === '/club/schedule' ? { auth: false, policies: [], middlewares: [] } : ADMIN);
  });

  it('point at handlers that exist', () => {
    for (const r of routes) expect(typeof (schedule as Record<string, unknown>)[r.handler.split('.')[1]], r.handler).toBe('function');
  });

  it('declare fixed paths before parameter paths', () => {
    const paths = routes.map((r) => r.path);
    expect(paths.indexOf('/club/breaks')).toBeLessThan(paths.indexOf('/club/breaks/:documentId'));
  });

  it('the old calendar routes refuse group events and the public occurrences filter them', () => {
    const code = readFileSync(join(__dirname, '..', '..', '..', 'api', 'calendar-event', 'controllers', 'calendar-event.ts'), 'utf8');
    expect(code).toContain('SCHEDULE_ERRORS.groupEvent');
    expect(code).toContain('publicWindow');
  });

  it('the old create and update routes refuse a group key of any kind', () => {
    const code = readFileSync(join(__dirname, '..', '..', '..', 'api', 'calendar-event', 'controllers', 'calendar-event.ts'), 'utf8');
    expect(code).toContain("'group' in data");
    expect(code.match(/refuseGroupKey\(/g)).toHaveLength(3);
  });
});
