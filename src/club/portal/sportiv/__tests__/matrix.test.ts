import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sportivController from '../../../../api/portal/controllers/sportiv';
import clubAthleteRoutes from '../../../../api/club/routes/05-athletes';
import coachRoutes from '../../../../api/portal/routes/02-coach';
import sportivRoutes from '../../../../api/portal/routes/04-sportiv';
import isAdmin from '../../../../policies/is-admin';
import isCoach from '../../../../policies/is-coach';
import isSportiv from '../../../../policies/is-sportiv';
import { fakeAccessStore } from '../../access/fake-store';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { fakePortalStore } from '../../__tests__/fake-portal-store';
import { portalSessions } from '../../sessions';
import type { PortalStore } from '../../store';
import { NO_ACCESS } from '../holder';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_IOANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';

const SECRET = 'test-bff-secret-000000000000000000';
const world = vi.hoisted(() => ({ portal: null as unknown, access: null as unknown, seed: null as unknown }));

vi.mock('../../strapi-store', () => ({ strapiPortalStore: () => world.portal }));
vi.mock('../../access/strapi-store', () => ({ strapiAccessStore: () => world.access }));
vi.mock('../context', async (original) => ({
  ...(await original<typeof import('../context')>()),
  /** The seed's stores with the holder the policy has just read. */
  sportivContext: (_strapi: unknown, holder: unknown) => ({ ...(world.seed as object), holder }),
}));

const strapi = { log: { error: vi.fn() } } as unknown as Core.Strapi;
const user = (id: number) => ({ id, email: `u${id}@example.invalid`, passwordHash: 'h', blocked: false, confirmed: true, username: `u${id}`, provider: 'local', role: 'authenticated' });

/** u1 is a coach, u2 holds Ana and Matei (not Ioana). */
async function setup() {
  const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
  fake.state.users.push(user(1), user(2));
  const store: PortalStore = fake.store;
  await store.createAccount({ userId: 1, email: 'u1@example.invalid', status: 'active', teamMemberId: 'tm1' });
  const holder = await store.createAccount({ userId: 2, email: 'u2@example.invalid', status: 'active', teamMemberId: null, name: 'Maria Ionescu' });
  const seed: SportivSeed = sportivCtx('parinte1@example.invalid');
  const access = fakeAccessStore({
    athletes: [A_ANA, A_MATEI, A_IOANA].map((id) => ({ id, name: id, email: 'p@example.invalid', status: 'activ', birthDate: null, contactName: null })),
  });
  const hold = (athleteId: string) => access.store.createAccess({ athleteId, accountId: holder, email: 'p@example.invalid', invitedAt: '2026-11-11T10:00:00.000Z', invitedBy: 'admin' });
  await hold(A_ANA);
  await hold(A_MATEI);
  world.portal = store;
  world.access = access.store;
  seed.portal = store;
  seed.access = access.store;
  world.seed = seed;
  const sessions = portalSessions(store);
  const login = async (userId: number, host: string) => (await sessions.issue(userId, `dev${userId}${host}`, host)).accessToken;
  return { seed, access, holder, login };
}

type Ctx = {
  params: Record<string, string>; query: Record<string, unknown>; state: Record<string, unknown>; status?: number; body?: unknown;
  request: { header: Record<string, string>; headers: Record<string, string>; body: unknown }; headers: Record<string, string>;
  set(h: Record<string, string>): void;
};
const handlers = sportivController as unknown as Record<string, (ctx: Ctx) => Promise<void>>;

const asHeaders = (token: string) => ({ 'x-portal-secret': SECRET, authorization: `Bearer ${token}` });
function ctxFor(token: string, params: Record<string, string> = {}, query: Record<string, unknown> = {}, body: unknown = {}): Ctx {
  const headers = asHeaders(token);
  const ctx: Ctx = { params, query, state: {}, request: { header: headers, headers, body }, headers: {}, set: (h) => { Object.assign(ctx.headers, h); } };
  return ctx;
}

type Route = { method: string; path: string; handler: string; config: { policies: string[] } };
const POLICIES: Record<string, (c: never, cfg: unknown, o: { strapi: Core.Strapi }) => Promise<boolean>> = {
  'global::is-sportiv': isSportiv as never, 'global::is-coach': isCoach as never, 'global::is-admin': isAdmin as never,
};
const runPolicies = async (route: Route, ctx: Ctx): Promise<void> => {
  for (const p of route.config.policies) await POLICIES[p](ctx as never, {}, { strapi });
};
/** The request as the router would run it: the first route of the table that matches, its policies, then its handler. */
async function call(token: string, method: string, path: string, query: Record<string, unknown> = {}, body: unknown = {}): Promise<Ctx> {
  const route = (sportivRoutes.routes as Route[]).find((r) => {
    const names: string[] = [];
    const rx = new RegExp(`^${r.path.replace(/[.]/g, '\\.').replace(/:(\w+)/g, (_m, n: string) => { names.push(n); return '([^/]+)'; })}$`);
    return r.method === method && rx.test(path);
  });
  if (!route) throw new Error(`no route ${method} ${path}`);
  const names: string[] = [];
  const m = new RegExp(`^${route.path.replace(/[.]/g, '\\.').replace(/:(\w+)/g, (_x, n: string) => { names.push(n); return '([^/]+)'; })}$`).exec(path)!;
  const ctx = ctxFor(token, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])), query, body);
  await runPolicies(route, ctx);
  await handlers[route.handler.replace('sportiv.', '')](ctx);
  return ctx;
}

const ATHLETE_ROUTES = (sportivRoutes.routes as Route[]).filter((r) => r.path.includes(':athleteId'));

beforeEach(() => {
  process.env.PORTAL_BFF_SECRET = SECRET;
  Object.assign(globalThis, { strapi });
});

/** Every function of the club data stores (the policy's own session and access reads are not the handler's), spied, so any read can be seen. */
function spyOnStores(seed: SportivSeed): ReturnType<typeof vi.fn>[] {
  const spies: ReturnType<typeof vi.fn>[] = [];
  for (const store of [seed.presence.store, seed.groups.store, seed.club.store]) {
    const target = store as unknown as Record<string, unknown>;
    for (const key of Object.keys(target)) if (typeof target[key] === 'function') spies.push(vi.spyOn(target as Record<string, never>, key as never) as never);
  }
  return spies;
}

describe('athlete routes', () => {
  it('every athlete route refuses a foreign id before reading', async () => {
    const w = await setup();
    const token = await w.login(2, 'sportiv');
    const spies = spyOnStores(w.seed);
    expect(ATHLETE_ROUTES.length).toBe(11);
    for (const r of ATHLETE_ROUTES) {
      const path = r.path.replace('/portal/sportiv', '').replace(':athleteId', A_IOANA);
      const out = await call(token, r.method, `/portal/sportiv${path}`.replace('/portal/sportiv/portal/sportiv', '/portal/sportiv'));
      expect(out.status, r.path).toBe(403);
      expect(out.body, r.path).toEqual({ data: null, error: { status: 403, name: 'ClubAdminError', message: NO_ACCESS } });
    }
    expect(spies.length).toBeGreaterThan(20);
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it('a revoked access closes the door on the next call', async () => {
    const w = await setup();
    const token = await w.login(2, 'sportiv');
    expect((await call(token, 'GET', `/portal/sportiv/athletes/${A_MATEI}/home`)).status).toBeUndefined();
    const row = (await w.access.store.liveByAccount(w.holder)).find((r) => r.athleteId === A_MATEI)!;
    await w.access.store.revokeAccess(row.id, { revokedAt: '2026-11-11T11:00:00.000Z', revokedBy: 'admin', revokeReason: 'scos' });
    const second = await call(token, 'GET', `/portal/sportiv/athletes/${A_MATEI}/home`);
    expect(second.status).toBe(403);
    expect(second.body).toMatchObject({ error: { message: NO_ACCESS } });
  });

  it('calendar.ics reaches the phone calendar handler, not the calendar JSON one', async () => {
    const w = await setup();
    const out = await call(await w.login(2, 'sportiv'), 'GET', `/portal/sportiv/athletes/${A_ANA}/calendar.ics`);
    expect(String(out.body).startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(out.headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(out.headers['Content-Disposition']).toBe('attachment; filename="edusport-ana.ics"');
    expect(String(out.body)).toContain('SUMMARY:');
  });

  it('the registration PDF answers 404 with the shared text when none is stored', async () => {
    const w = await setup();
    const out = await call(await w.login(2, 'sportiv'), 'GET', `/portal/sportiv/athletes/${A_ANA}/documents/acord`);
    expect(out.status).toBe(404);
    expect(out.body).toMatchObject({ error: { message: 'Nu a fost găsit.' } });
  });
});

describe('host matrix', () => {
  it('a coach session is refused on every sportiv route', async () => {
    const w = await setup();
    const token = await w.login(1, 'antrenor');
    for (const r of sportivRoutes.routes as Route[]) {
      await expect(runPolicies(r, ctxFor(token)), r.path).rejects.toBeInstanceOf(errors.ForbiddenError);
    }
  });

  it('a sportiv session is refused on every coach route', async () => {
    const w = await setup();
    const token = await w.login(2, 'sportiv');
    for (const r of coachRoutes.routes as unknown as Route[]) {
      await expect(runPolicies(r, ctxFor(token)), r.path).rejects.toBeInstanceOf(errors.ForbiddenError);
    }
  });

  it('a sportiv session is refused on club admin routes', async () => {
    const w = await setup();
    const token = await w.login(2, 'sportiv');
    const routes = (clubAthleteRoutes.routes as unknown as Route[]).slice(0, 3);
    expect(routes.length).toBe(3);
    for (const r of routes) {
      const refusal = await runPolicies(r, ctxFor(token)).then(() => null, (e: unknown) => e);
      expect(refusal instanceof errors.UnauthorizedError || refusal instanceof errors.ForbiddenError || refusal instanceof Error, r.path).toBe(true);
    }
  });
});

describe('leak walk', () => {
  it('no JSON answer of any route carries a forbidden key outside the allowed note paths', async () => {
    const w = await setup();
    const token = await w.login(2, 'sportiv');
    const answers: Ctx[] = [];
    for (const p of ['/me', '/me/devices', '/athletes']) answers.push(await call(token, 'GET', `/portal/sportiv${p}`));
    for (const id of [A_ANA, A_MATEI]) {
      for (const r of ATHLETE_ROUTES) {
        if (r.path.endsWith('.ics') || r.path.endsWith('/acord')) continue;
        const path = `/portal/sportiv${r.path.replace('/portal/sportiv', '').replace(':athleteId', id)}`;
        answers.push(await call(token, r.method, path, r.path.endsWith('/calendar') ? { month: '2026-11' } : {}));
      }
    }
    expect(answers.length).toBe(3 + 2 * 9);
    for (const a of answers) {
      expect(a.status, JSON.stringify([a.body, (strapi.log.error as ReturnType<typeof vi.fn>).mock.calls])).toBeUndefined();
      expect(forbiddenPathsIn((a.body as { data: unknown }).data, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
    }
  });
});
