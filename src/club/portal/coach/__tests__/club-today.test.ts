import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import isCoach from '../../../../policies/is-coach';
import { lessonRow } from '../../../presence/__tests__/fake-store';
import { fakePortalStore } from '../../__tests__/fake-portal-store';
import { portalSessions } from '../../sessions';
import routes from '../../../../api/portal/routes/02-coach';
import type { CoachClubToday } from '../api-types';
import { readClubToday } from '../club-today';
import { addOneOffClass, coachCtx, type CoachSeed } from './coach-seed';

const holder = vi.hoisted(() => ({ current: null as unknown, portal: null as unknown }));
vi.mock('../context', async (orig) => ({ ...(await orig<typeof import('../context')>()), coachContexts: () => holder.current }));
vi.mock('../../strapi-store', () => ({ strapiPortalStore: () => holder.portal }));

import controller from '../../../../api/portal/controllers/coach';

const FRIDAY = '2026-11-20';
const SATURDAY = '2026-11-21';
const SECRET = 'test-bff-secret-000000000000000000';

async function read(c: CoachSeed): Promise<CoachClubToday> {
  const r = await readClubToday(c);
  if (!r.ok) throw new Error(`refused ${r.status}`);
  return r.data;
}

describe('readClubToday', () => {
  it('lists own and other groups sorted by start time, with coaches, location and own flags', async () => {
    const out = await read(coachCtx('tm-andreea', FRIDAY));
    expect(out.date).toBe(FRIDAY);
    expect(out.rows.map((r) => (r.kind === 'group' ? [r.name, r.startTime, r.own, r.coaches] : null))).toEqual([
      ['Club A', '17:00', true, ['Andreea Pascu']],
      ['Club B', '18:00', false, ['Virgil Pascu']],
    ]);
    expect(out.rows[0]).toMatchObject({ kind: 'group', groupId: 'g-club-a', durationMin: 90, school: false });
  });

  it('the same answer for the other coach flips the own flags', async () => {
    const out = await read(coachCtx('tm-virgil', FRIDAY));
    expect(out.rows.map((r) => r.own)).toEqual([false, true]);
  });

  it('flags a Școala group', async () => {
    const out = await read(coachCtx('tm-virgil', SATURDAY));
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ kind: 'group', name: 'Școala A', school: true, own: false, startTime: '11:00' });
  });

  it('leaves out a removed date and an inactive group, includes a one-off class', async () => {
    const c = coachCtx('tm-andreea', FRIDAY);
    c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-a')!.exceptions = [{ date: FRIDAY, kind: 'sters' }];
    c.fake.group.groups.find((g) => g.id === 'g-club-b')!.active = false;
    addOneOffClass(c, FRIDAY, '15:00', '16:00');
    const out = await read(c);
    expect(out.rows.map((r) => (r.kind === 'group' ? [r.name, r.startTime] : null))).toEqual([['Club A', '15:00']]);
  });

  it('gives no lesson id, no child data and no counts for a lesson of another coach', async () => {
    const c = coachCtx('tm-andreea', FRIDAY);
    c.fake.state.lessons.push(
      lessonRow({ id: 'l-mine', athleteId: 'a-club-1', startTime: '16:00', coachIds: ['tm-andreea'] }),
      lessonRow({ id: 'l-theirs', athleteId: 'a-club-2', startTime: '16:30', coachIds: ['tm-virgil'], date: FRIDAY }),
    );
    c.fake.state.lessons[0].date = FRIDAY;
    const out = await read(c);
    const lessons = out.rows.filter((r) => r.kind === 'lesson');
    expect(lessons).toEqual([
      { kind: 'lesson', lessonId: 'l-mine', startTime: '16:00', durationMin: 50, coach: 'Andreea Pascu', own: true },
      { kind: 'lesson', lessonId: null, startTime: '16:30', durationMin: 50, coach: 'Virgil Pascu', own: false },
    ]);
    expect(out.rows.map((r) => r.startTime)).toEqual(['16:00', '16:30', '17:00', '18:00']);
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/a-club-|Ana Club|Bogdan|athlete|children|listed|count/i);
    expect(text).not.toContain('l-theirs');
  });
});

describe('GET /portal/coach/today/club', () => {
  beforeEach(() => {
    process.env.PORTAL_BFF_SECRET = SECRET;
    (globalThis as unknown as { strapi: unknown }).strapi = { log: { error: () => undefined } };
  });

  it('is declared with the coach policy, before any parameter path', () => {
    const paths = routes.routes.map((r) => r.path);
    const club = routes.routes.find((r) => r.method === 'GET' && r.path === '/portal/coach/today/club');
    expect(club?.handler).toBe('coach.todayClub');
    expect(club?.config).toEqual({ auth: false, policies: ['global::is-coach'], middlewares: [] });
    expect(paths.filter((p) => /^\/portal\/coach\/today\/:/.test(p))).toEqual([]);
  });

  it('answers a coach with the rows', async () => {
    const c = coachCtx('tm-andreea', FRIDAY);
    holder.current = c;
    const ctx: { params: object; query: object; request: { body: unknown; headers: object; header: object }; state: { coach: unknown }; status?: number; body?: unknown } = {
      params: {}, query: {}, request: { body: {}, headers: {}, header: {} }, state: { coach: c.coach },
    };
    await (controller as unknown as Record<string, (x: unknown) => Promise<void>>).todayClub(ctx);
    expect((ctx.body as { data: CoachClubToday }).data.rows.map((r) => r.startTime)).toEqual(['17:00', '18:00']);
  });

  it('the policy refuses a request without a session (401) and an account that is not a coach (403)', async () => {
    const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
    fake.state.users.push({ id: 1, email: 'u1@x.ro', passwordHash: 'h', blocked: false, confirmed: true, username: 'u1', provider: 'local', role: 'authenticated' });
    await fake.store.createAccount({ userId: 1, email: 'u1@x.ro', status: 'active', teamMemberId: 'tm1' });
    holder.portal = fake.store;
    const { accessToken } = await portalSessions(fake.store).issue(1, 'dev1', 'antrenor');
    const strapi = {} as unknown as Core.Strapi;
    await expect(isCoach({ request: { header: { 'x-portal-secret': SECRET } }, state: {} }, {}, { strapi })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await fake.store.updateAccount('acc1', { status: 'disabled' });
    const headers = { 'x-portal-secret': SECRET, authorization: `Bearer ${accessToken}` };
    await expect(isCoach({ request: { header: headers }, state: {} }, {}, { strapi })).rejects.toBeInstanceOf(errors.ForbiddenError);
  });
});
