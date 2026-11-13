import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { adminRoute } from '../../admin-area';
import schedule from '../../../api/club/controllers/schedule';
import scheduleRoutes from '../../../api/club/routes/07-schedule';
import { SCHEDULE_ERRORS } from '../copy';
import { refuseGroupKey } from '../occurrences';

const routes = scheduleRoutes.routes;
const ADMIN = adminRoute('club');

describe('07-schedule routes (8.2, 8.3)', () => {
  it('are admin-only, except the public notebook read', () => {
    for (const r of routes) expect(r.config, r.path).toEqual(r.path === '/club/schedule' ? { auth: false, policies: [], middlewares: [] } : ADMIN);
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

  it('the old create and update routes check the group key through refuseGroupKey', () => {
    const code = readFileSync(join(__dirname, '..', '..', '..', 'api', 'calendar-event', 'controllers', 'calendar-event.ts'), 'utf8');
    expect(code.match(/refuseGroupKey\(strapi, data\)/g)).toHaveLength(2);
  });
});

describe('refuseGroupKey (F6)', () => {
  const strapi = { documents: () => ({ findOne: async ({ documentId }: { documentId: string }) => (documentId === 'g-real' ? { name: 'Primii Pași' } : null) }) } as unknown as Core.Strapi;

  it('lets data without a group key through', async () => {
    expect(await refuseGroupKey(strapi, { title: 'x' })).toBeNull();
    expect(await refuseGroupKey(strapi, null)).toBeNull();
    expect(await refuseGroupKey(strapi, 'group')).toBeNull();
  });

  it('refuses a null, an object, a { connect } and an unknown id with the generic message', async () => {
    for (const group of [null, { documentId: 'g-real' }, { connect: ['g-real'] }, 'unknown-id']) {
      expect(await refuseGroupKey(strapi, { group }), JSON.stringify(group)).toBe(SCHEDULE_ERRORS.groupKey);
    }
  });

  it('names the group for a real id', async () => {
    expect(await refuseGroupKey(strapi, { group: 'g-real' })).toBe(SCHEDULE_ERRORS.groupEvent('Primii Pași'));
  });
});
