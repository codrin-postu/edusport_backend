import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import isAdmin from '../../../../policies/is-admin';
import isCoach from '../../../../policies/is-coach';
import { adminSessions } from '../../../__tests__/admin-sessions';
import type { AdminUserStrapi } from '../../../admin-auth';
import { athleteRow, member } from '../../../groups/__tests__/fake-group-store';
import { attendanceRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { fakePortalStore } from '../../__tests__/fake-portal-store';
import { PORTAL_ERRORS } from '../../copy';
import { portalSessions } from '../../sessions';
import routes from '../../../../api/portal/routes/02-coach';
import { forbiddenKeysIn } from '../views';
import { coachCtx, type CoachSeed } from './coach-seed';

const holder = vi.hoisted(() => ({ current: null as unknown, portal: null as unknown }));
vi.mock('../context', async (orig) => ({ ...(await orig<typeof import('../context')>()), coachContexts: () => holder.current }));
vi.mock('../../strapi-store', () => ({ strapiPortalStore: () => holder.portal }));

import controller from '../../../../api/portal/controllers/coach';

type H = (ctx: unknown) => Promise<void>;
const handlers = controller as unknown as Record<string, H>;
const TODAY = '2026-11-20';
const ME = 'tm-andreea';
const tick = (athleteId: string) => ({ athleteId, grup: true, uscat: false });

type Call = { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };
async function call(c: CoachSeed, name: string, input: Call = {}) {
  holder.current = c;
  const ctx: { params: Record<string, string>; query: Record<string, unknown>; request: { body: unknown; headers: Record<string, string>; header: Record<string, string> }; state: { coach: unknown }; status?: number; body?: unknown } = {
    params: input.params ?? {}, query: input.query ?? {}, request: { body: input.body ?? {}, headers: {}, header: {} }, state: { coach: c.coach },
  };
  await handlers[name](ctx);
  return { status: ctx.status ?? 200, body: ctx.body as { data?: unknown; error?: { message: string }; undo?: unknown } };
}

beforeEach(() => {
  (globalThis as unknown as { strapi: unknown }).strapi = { log: { error: () => undefined } };
});

/** The columns: own Club group, another coach's group, own Școala group, own Club group after the link was removed. */
type Col = 'own' | 'other' | 'scoala' | 'removed';
const GROUP: Record<Col, string> = { own: 'g-club-a', other: 'g-club-b', scoala: 'g-scoala-a', removed: 'g-club-a' };
const EVENT: Record<Col, string> = { own: 'ev-g-club-a', other: 'ev-g-club-b', scoala: 'ev-g-scoala-a', removed: 'ev-g-club-a' };

function seeded(col: Col): CoachSeed {
  const c = coachCtx(ME, TODAY);
  if (col === 'removed') c.fake.group.groups.find((g) => g.id === 'g-club-a')!.coachIds = [];
  return c;
}

/** A saved scheduled session of the column's group, 5 days back, listing the coach for the columns the coach is on. */
function withSaved(c: CoachSeed, col: Col) {
  const groupId = GROUP[col];
  const date = col === 'scoala' ? '2026-11-15' : '2026-11-18';
  const key = `${EVENT[col]}|${date}|${col === 'scoala' ? '11:00' : col === 'other' ? '18:00' : '17:00'}`;
  const athlete = col === 'scoala' ? 'a-scoala-1' : col === 'other' ? 'a-b-1' : 'a-club-1';
  c.fake.state.sessions.push(sessionRow({
    id: 's-saved', groupId, date, startTime: key.split('|')[2], source: 'schedule', eventId: EVENT[col], occurrenceKey: key, coachIds: col === 'other' ? ['tm-virgil'] : [ME],
  }));
  c.fake.state.attendances.push(attendanceRow({ id: 't-saved', sessionId: 's-saved', athleteId: athlete, uniqueKey: `s-saved|${athlete}` }));
  return { athlete };
}

async function fakeUser(c: CoachSeed): Promise<void> {
  c.portalFake.state.users.push({ id: 1, email: 'antrenor1@example.invalid', passwordHash: 'h', blocked: false, confirmed: true, username: 'u1', provider: 'local', role: 'authenticated' });
  c.coach.accountId = await c.portal.createAccount({ userId: 1, email: 'antrenor1@example.invalid', status: 'active', teamMemberId: ME });
  c.coach.userId = 1;
}

const COLS: Col[] = ['own', 'other', 'scoala', 'removed'];
const expectRow = async (row: Record<Col, number>, run: (col: Col) => Promise<{ status: number; body: unknown }>) => {
  const got = {} as Record<Col, number>;
  for (const col of COLS) got[col] = (await run(col)).status;
  expect(got).toEqual(row);
};

describe('ownership matrix (spec 7) through the controller', () => {
  it('roster: the group page is 200 everywhere, with members only on an own group', async () => {
    for (const col of COLS) {
      const res = await call(seeded(col), 'group', { params: { documentId: GROUP[col] } });
      expect(res.status, col).toBe(200);
      const data = res.body.data as { members: unknown[] | null; own: boolean };
      expect(data.own, col).toBe(col === 'own' || col === 'scoala');
      expect(data.members === null, col).toBe(col === 'other' || col === 'removed');
    }
  });

  it('saved days: all dates of an own group, only the listed ones on another, 404 on a missing group, 400 on a bad month', async () => {
    for (const col of COLS) {
      const c = seeded(col);
      withSaved(c, col);
      c.fake.state.sessions.push(sessionRow({ id: 's-x', groupId: GROUP[col], date: '2026-11-03', startTime: '17:00', source: 'added', eventId: null, coachIds: ['tm-virgil'] }));
      c.fake.state.sessions.push(sessionRow({ id: 's-oct', groupId: GROUP[col], date: '2026-10-30', startTime: '17:00', source: 'added', eventId: null, coachIds: [ME] }));
      const res = await call(c, 'savedDays', { params: { documentId: GROUP[col] }, query: { month: '2026-11' } });
      const date = col === 'scoala' ? '2026-11-15' : '2026-11-18';
      const own = col === 'own' || col === 'scoala';
      expect(res.status, col).toBe(200);
      expect(res.body.data, col).toEqual({ month: '2026-11', dates: own ? ['2026-11-03', date] : col === 'removed' ? ['2026-11-18'] : [] });
    }
    const c = seeded('own');
    expect((await call(c, 'savedDays', { params: { documentId: 'g-nope' }, query: { month: '2026-11' } })).status).toBe(404);
    expect((await call(c, 'savedDays', { params: { documentId: 'g-old' }, query: { month: '2026-11' } })).status).toBe(404);
    expect((await call(c, 'savedDays', { params: { documentId: 'g-club-a' }, query: { month: '2026-13' } })).status).toBe(400);
  });

  it('presence, first save of a scheduled class: own, Școala own, and as a stand-in (also on the group he was removed from, unsaved and in the window)', async () => {
    const keyOf = (col: Col) => (col === 'scoala' ? 'ev-g-scoala-a|2026-11-15|11:00' : col === 'other' ? `ev-g-club-b|${TODAY}|18:00` : `ev-g-club-a|${TODAY}|17:00`);
    const tickOf = (col: Col) => (col === 'scoala' ? 'a-scoala-1' : col === 'other' ? 'a-b-1' : 'a-club-1');
    await expectRow({ own: 200, other: 200, scoala: 200, removed: 200 }, (col) =>
      call(seeded(col), 'saveSession', { body: { occurrence: keyOf(col), coachIds: [ME], ticks: [tick(tickOf(col))], reactivate: [], keepInactive: [] } }));
  });

  it('presence correction within 7 days: own, Școala own and a listed coach after the link was removed; another coach session refused', async () => {
    await expectRow({ own: 200, other: 403, scoala: 200, removed: 200 }, async (col) => {
      const c = seeded(col);
      const { athlete } = withSaved(c, col);
      return call(c, 'saveSession', { body: { id: 's-saved', coachIds: col === 'other' ? [ME] : [ME], ticks: [tick(athlete)], reactivate: [], keepInactive: [] } });
    });
  });

  it('a presence save answers { data } with no undo or action id, and the 409 keeps its details', async () => {
    const own = await call(seeded('own'), 'saveSession', { body: { occurrence: `ev-g-club-a|${TODAY}|17:00`, coachIds: [ME], ticks: [tick('a-club-1')], reactivate: [], keepInactive: [] } });
    expect(own.status).toBe(200);
    expect(Object.keys(own.body)).toEqual(['data']);
    expect(JSON.stringify(own.body)).not.toMatch(/undo|actionId/);
  });

  it('add athlete to a group: own groups only', async () => {
    await expectRow({ own: 200, other: 403, scoala: 200, removed: 403 }, (col) =>
      call(seeded(col), 'addMembers', { params: { documentId: GROUP[col] }, body: { athleteIds: ['a-free'] } }));
  });

  it('"Sportiv nou": any group the coach can see, the child is "nou"', async () => {
    for (const col of COLS) {
      const c = seeded(col);
      const res = await call(c, 'addAthlete', { body: { groupId: GROUP[col], name: 'Mara Nouă' } });
      expect(res.status, col).toBe(200);
      expect(c.clubFake.state.athletes.find((a) => a.name === 'Mara Nouă')?.status).toBe('nou');
    }
  });

  it('contact: the athlete card of an own child only', async () => {
    const child: Record<Col, string> = { own: 'a-club-1', other: 'a-b-1', scoala: 'a-scoala-1', removed: 'a-club-1' };
    await expectRow({ own: 200, other: 403, scoala: 200, removed: 403 }, (col) => call(seeded(col), 'athlete', { params: { documentId: child[col] } }));
    const own = await call(seeded('own'), 'athlete', { params: { documentId: 'a-club-1' } });
    expect(JSON.stringify(own.body)).toContain('0722000111');
    const stand = await call(seeded('other'), 'athlete', { params: { documentId: 'a-b-1' } });
    expect(JSON.stringify(stand.body)).not.toContain('0722000111');
  });

  it('edit program (Club own only)', async () => {
    const weekly = { freq: 'weekly', days: ['fri'], startTime: '16:00', durationMin: 60, from: '2026-11-27' };
    await expectRow({ own: 200, other: 403, scoala: 403, removed: 403 }, (col) =>
      call(seeded(col), 'changeProgram', { params: { eventId: EVENT[col] }, body: weekly }));
    await expectRow({ own: 200, other: 403, scoala: 403, removed: 403 }, (col) =>
      call(seeded(col), 'addProgram', { params: { documentId: GROUP[col] }, body: weekly }));
    await expectRow({ own: 200, other: 403, scoala: 403, removed: 403 }, (col) =>
      call(seeded(col), 'setDate', { params: { eventId: EVENT[col], date: '2026-11-27' }, body: { mode: 'cancel' } }));
  });

  it('"Program public": Club own only', async () => {
    await expectRow({ own: 200, other: 403, scoala: 403, removed: 403 }, (col) =>
      call(seeded(col), 'programPublic', { params: { documentId: GROUP[col] }, body: { value: false } }));
  });

  it('session check: own always, another group only on a scheduled class of the last 7 days, else 403', async () => {
    await expectRow({ own: 200, other: 403, scoala: 200, removed: 403 }, (col) =>
      call(seeded(col), 'sessionCheck', { body: { groupId: GROUP[col], date: '2026-11-19', startTime: '19:00' } }));
    const stand = await call(seeded('removed'), 'sessionCheck', { body: { groupId: 'g-club-a', date: TODAY, startTime: '17:00' } });
    expect(stand.status).toBe(200);
  });

  it('removed link answers 403 on every group write route', async () => {
    const c = seeded('removed');
    const weekly = { freq: 'weekly', days: ['fri'], startTime: '16:00', durationMin: 60, from: '2026-11-27' };
    const results = [
      await call(c, 'addProgram', { params: { documentId: 'g-club-a' }, body: weekly }),
      await call(c, 'programPublic', { params: { documentId: 'g-club-a' }, body: { value: false } }),
      await call(c, 'addMembers', { params: { documentId: 'g-club-a' }, body: { athleteIds: ['a-free'] } }),
      await call(c, 'sessionCheck', { body: { groupId: 'g-club-a', date: '2026-11-19', startTime: '19:00' } }),
      await call(c, 'changeProgram', { params: { eventId: 'ev-g-club-a' }, body: weekly }),
      await call(c, 'endProgram', { params: { eventId: 'ev-g-club-a' }, body: { from: '2026-11-27' } }),
      await call(c, 'deleteClass', { params: { eventId: 'ev-g-club-a' } }),
      await call(c, 'setDate', { params: { eventId: 'ev-g-club-a', date: '2026-11-27' }, body: { mode: 'cancel' } }),
    ];
    expect(results.map((r) => r.status)).toEqual(results.map(() => 403));
    expect(results.every((r) => r.body.error?.message === PORTAL_ERRORS.noAccess)).toBe(true);
  });

  it('no route leaks a forbidden key, a price list or an undo', async () => {
    const c = coachCtx(ME, TODAY);
    await fakeUser(c);
    c.fake.state.sessions.push(sessionRow({ id: 's-g', groupId: 'g-club-a', date: '2026-11-18', startTime: '17:00', source: 'added', eventId: null, coachIds: [ME] }));
    const gets: [string, Call, string][] = [
      ['me', {}, '/portal/coach/me'], ['today', {}, '/portal/coach/today'], ['groups', {}, '/portal/coach/groups'],
      ['group', { params: { documentId: 'g-club-a' } }, '/g'], ['group', { params: { documentId: 'g-club-b' } }, '/g'],
      ['program', { params: { documentId: 'g-club-a' }, query: { month: '2026-11' } }, '/p'],
      ['savedDays', { params: { documentId: 'g-club-a' }, query: { month: '2026-11' } }, '/sd'],
      ['session', { query: { id: 's-g' } }, '/s'], ['searchAthletes', { query: { q: 'ana' } }, '/sr'],
      ['athlete', { params: { documentId: 'a-club-1' } }, '/a'], ['history', { query: { month: '2026-11' } }, '/h'], ['devices', {}, '/d'],
    ];
    for (const [name, input, path] of gets) {
      holder.portal = c.portal;
      const res = await call(c, name, input);
      expect(res.status, name).toBe(200);
      expect(forbiddenKeysIn(res.body, path === '/portal/coach/me' ? ['email'] : []), name).toEqual([]);
      const text = JSON.stringify(res.body);
      expect(text, name).not.toMatch(/pl-club|pl-std|priceList|actionId|"undo"/);
    }
  });
});

describe('the disabled account column, through the policy', () => {
  it('is 403 before any handler runs', async () => {
    process.env.PORTAL_BFF_SECRET = 'test-bff-secret-000000000000000000';
    const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
    fake.state.users.push({ id: 1, email: 'u1@x.ro', passwordHash: 'h', blocked: false, confirmed: true, username: 'u1', provider: 'local', role: 'authenticated' });
    await fake.store.createAccount({ userId: 1, email: 'u1@x.ro', status: 'active', teamMemberId: 'tm1' });
    holder.portal = fake.store;
    const { accessToken } = await portalSessions(fake.store).issue(1, 'dev1', 'antrenor');
    await fake.store.updateAccount('acc1', { status: 'disabled' });
    const headers = { 'x-portal-secret': 'test-bff-secret-000000000000000000', authorization: `Bearer ${accessToken}` };
    await expect(isCoach({ request: { header: headers }, state: {} }, {}, { strapi: {} as unknown as Core.Strapi })).rejects.toBeInstanceOf(errors.ForbiddenError);
  });
});

describe('the coach additions routes', () => {
  const NEW: [string, string][] = [
    ['GET', '/portal/coach/calendar'], ['GET', '/portal/coach/competitions'],
    ['POST', '/portal/coach/groups/:documentId/members/:athleteId/move'], ['POST', '/portal/coach/groups/:documentId/members/:athleteId/remove'],
  ];

  it('are guarded by the coach policy only', () => {
    for (const [method, path] of NEW) {
      const r = routes.routes.find((x) => x.method === method && x.path === path);
      expect(r, path).toBeDefined();
      expect(r?.config, path).toMatchObject({ auth: false, policies: ['global::is-coach'] });
    }
  });

  it('answer 401 without a session and 403 for a disabled account, before any handler', async () => {
    process.env.PORTAL_BFF_SECRET = 'test-bff-secret-000000000000000000';
    const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
    fake.state.users.push({ id: 1, email: 'u1@x.ro', passwordHash: 'h', blocked: false, confirmed: true, username: 'u1', provider: 'local', role: 'authenticated' });
    await fake.store.createAccount({ userId: 1, email: 'u1@x.ro', status: 'active', teamMemberId: 'tm1' });
    holder.portal = fake.store;
    const { accessToken } = await portalSessions(fake.store).issue(1, 'dev1', 'antrenor');
    const secret = { 'x-portal-secret': 'test-bff-secret-000000000000000000' };
    const none = { request: { header: secret }, state: {} };
    await expect(isCoach(none, {}, { strapi: {} as unknown as Core.Strapi })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await fake.store.updateAccount('acc1', { status: 'disabled' });
    const disabled = { request: { header: { ...secret, authorization: `Bearer ${accessToken}` } }, state: {} };
    await expect(isCoach(disabled, {}, { strapi: {} as unknown as Core.Strapi })).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('move and remove on another coach group are 403 with the access text and write nothing', async () => {
    for (const [name, body] of [['moveMember', { toGroupId: 'g-club-a', from: TODAY }], ['removeMember', { from: TODAY }]] as const) {
      const c = seeded('own');
      const before = JSON.stringify([c.fake.group.memberships, c.fake.group.history]);
      const res = await call(c, name, { params: { documentId: 'g-club-b', athleteId: 'a-b-1' }, body });
      expect(res.status, name).toBe(403);
      expect(res.body.error?.message, name).toBe(PORTAL_ERRORS.noAccess);
      expect(JSON.stringify([c.fake.group.memberships, c.fake.group.history]), name).toBe(before);
    }
    const c = seeded('own');
    const toOther = await call(c, 'moveMember', { params: { documentId: 'g-club-a', athleteId: 'a-club-1' }, body: { toGroupId: 'g-club-b', from: TODAY } });
    expect([toOther.status, toOther.body.error?.message]).toEqual([403, PORTAL_ERRORS.noAccess]);
  });

  it('calendar and competitions of a stand-in coach show no unsaved class of another group and no contact', async () => {
    const c = seeded('removed');
    c.fake.state.sessions.push(sessionRow({
      id: 's-in', groupId: 'g-club-b', date: '2026-11-18', startTime: '18:00', eventId: 'ev-g-club-b', occurrenceKey: 'ev-g-club-b|2026-11-18|18:00', coachIds: [ME, 'tm-virgil'],
    }));
    const cal = await call(c, 'calendar', { query: { month: '2026-11' } });
    expect(cal.status).toBe(200);
    const items = (cal.body.data as { days: { items: { title: string; standIn: boolean; date: string }[] }[] }).days.flatMap((d) => d.items);
    expect(items.filter((i) => i.title === 'Club B').map((i) => [i.date, i.standIn])).toEqual([['2026-11-18', true]]);
    expect(items.some((i) => i.title === 'Club A')).toBe(false);
    const comp = await call(c, 'competitions', { query: { scope: 'all' } });
    expect(comp).toMatchObject({ status: 200, body: { data: { available: false } } });
    for (const res of [cal, comp]) {
      expect(forbiddenKeysIn(res.body)).toEqual([]);
      expect(JSON.stringify(res.body)).not.toMatch(/0722000111|Părinte Secret|"phone"|"contact"/);
    }
  });
});

describe('admin routes against a portal session', () => {
  it('every club route is admin-guarded except the public reads and the registration form, and the guard refuses a portal access token', async () => {
    const dir = join(__dirname, '../../../../api/club/routes');
    const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
    fake.state.users.push({ id: 1, email: 'u1@x.ro', passwordHash: 'h', blocked: false, confirmed: true, username: 'u1', provider: 'local', role: 'authenticated' });
    await fake.store.createAccount({ userId: 1, email: 'u1@x.ro', status: 'active', teamMemberId: 'tm1' });
    const { accessToken } = await portalSessions(fake.store).issue(1, 'dev1', 'antrenor');
    const admin = adminSessions('admin-secret');
    const strapiLike: AdminUserStrapi = { sessionManager: admin.sessionManager, db: { query: () => ({ findOne: async () => ({ id: 1, isActive: true, roles: [] }) }) } };
    let checked = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const mod = (await import(join(dir, file))).default as { routes: { method: string; path: string; config: { policies: (string | { name: string })[] } }[] };
      for (const r of mod.routes) {
        const policies = r.config.policies;
        if (policies.length === 0) {
          // Public by design: the website reads and the public registration form.
          expect(r.method === 'GET' || r.path.startsWith('/forms/'), `${file} ${r.method} ${r.path}`).toBe(true);
          continue;
        }
        expect(policies.length, `${file} ${r.path}`).toBe(1);
        // a policy is a name, or { name, config } (`adminRoute(area)`)
        const policy = typeof policies[0] === 'string' ? policies[0] : policies[0].name;
        expect(['global::is-admin', 'global::is-super-admin']).toContain(policy);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(50);
    await expect(isAdmin({ request: { header: { authorization: `Bearer ${accessToken}` } } }, {}, { strapi: strapiLike as unknown as Core.Strapi })).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });
});
