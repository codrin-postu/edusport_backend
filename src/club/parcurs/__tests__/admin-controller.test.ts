import type { Core } from '@strapi/strapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import athletes from '../../../api/club/controllers/athletes';
import athleteRoutes from '../../../api/club/routes/05-athletes';
import { A_ANA, A_IOANA, sportivCtx } from '../../portal/sportiv/__tests__/sportiv-seed';
import { givePin } from '../grants';
import { readParcurs, type ParcursStaffDeps } from '../read';

const world = vi.hoisted(() => ({ deps: null as unknown, adminId: null as string | number | null }));
vi.mock('../strapi-port', () => ({ strapiParcursDeps: () => world.deps }));
vi.mock('../../skate/wiring', () => ({ strapiCompetitions: () => ({}) }));
vi.mock('../../admin-auth', () => ({ verifiedAdminId: async () => world.adminId }));

type Ctx = { params: Record<string, string>; query: Record<string, unknown>; request: { body?: unknown; header: Record<string, string> }; status?: number; body?: unknown };
const handlers = athletes as unknown as Record<string, (ctx: Ctx) => Promise<void>>;
const ctxOf = (params: Record<string, string>, body?: unknown): Ctx => ({ params, query: {}, request: { body, header: { authorization: 'Bearer t' } } });

let deps: ParcursStaffDeps;
beforeEach(() => {
  const c = sportivCtx('parinte1@example.invalid');
  deps = { store: c.parcurs, club: c.club.store, presence: c.presence.store, results: async () => null, adminNames: async () => ({ 7: 'Mara Admin' }) };
  world.deps = deps;
  world.adminId = 7;
  Object.assign(globalThis, { strapi: { log: { error: vi.fn() } } as unknown as Core.Strapi });
});

describe('admin Parcurs controller', () => {
  it('reads an athlete and refuses an unknown one with 404', async () => {
    const ok = ctxOf({ documentId: A_ANA });
    await handlers.parcurs(ok);
    expect(ok.body).toMatchObject({ data: { pinsLeft: 2, awards: [] } });
    const unknown = ctxOf({ documentId: 'nope' });
    await handlers.parcurs(unknown);
    expect(unknown.status).toBe(404);
  });

  it('adds an award as the admin that sent it, and removes it', async () => {
    const add = ctxOf({ documentId: A_ANA }, { kind: 'jump', jump: 'lo', level: 1 });
    await handlers.addAward(add);
    expect(add.body).toMatchObject({ data: { awards: [{ pin: 'saritura-1lo', givenBy: 'Mara Admin' }] } });
    const awardId = (add.body as { data: { awards: { id: string }[] } }).data.awards[0].id;
    const remove = ctxOf({ documentId: A_ANA, awardId });
    await handlers.removeAward(remove);
    expect(remove.body).toMatchObject({ data: { awards: [] } });
  });

  it('answers 401 UNAUTHORIZED when the admin cannot be identified, and writes nothing', async () => {
    world.adminId = null;
    const add = ctxOf({ documentId: A_ANA }, { kind: 'steaua' });
    await handlers.addAward(add);
    expect(add).toMatchObject({ status: 401, body: { error: { message: 'UNAUTHORIZED' } } });
    expect((await deps.store.awards({}))).toHaveLength(0);
  });

  it('refuses a bad award with a code', async () => {
    const add = ctxOf({ documentId: A_ANA }, { kind: 'jump', jump: 'zz', level: 1 });
    await handlers.addAward(add);
    expect(add).toMatchObject({ status: 400, body: { error: { message: 'BAD_JUMP' } } });
  });

  it('deletes a pin, and answers 404 NOT_FOUND for a pin of other athletes', async () => {
    await readParcurs(deps, A_ANA, '2026-11-20');
    const given = await givePin(deps.store, { giverId: A_ANA, recipientId: A_IOANA, design: 1, today: '2026-11-20', activeIds: new Set([A_IOANA]) });
    const pinId = given.ok === true ? given.id : '';
    const other = ctxOf({ documentId: 'a-matei', pinId });
    await handlers.removePin(other);
    expect(other).toMatchObject({ status: 404, body: { error: { message: 'NOT_FOUND' } } });
    const done = ctxOf({ documentId: A_ANA, pinId });
    await handlers.removePin(done);
    expect(done.body).toMatchObject({ data: { given: [] } });
  });

  it('every new admin route is club-area, wired to a handler, and listed before /:documentId', () => {
    const routes = athleteRoutes.routes as { method: string; path: string; handler: string }[];
    const mine = routes.filter((r) => ['parcurs', 'addAward', 'removeAward', 'removePin'].includes(r.handler.replace('athletes.', '')));
    expect(mine).toHaveLength(4);
    const byId = routes.findIndex((r) => r.method === 'GET' && r.path === '/club/athletes/:documentId');
    for (const r of mine) {
      expect(routes.indexOf(r), r.path).toBeLessThan(byId);
      expect(typeof handlers[r.handler.replace('athletes.', '')]).toBe('function');
    }
  });
});
