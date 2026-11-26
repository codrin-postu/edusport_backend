import { beforeEach, describe, expect, it, vi } from 'vitest';
import onboarding from '../../../api/club/controllers/onboarding';
import { changeWith, type ProgressPort } from '../strapi-store';
import type { Progress } from '../progress';

const world = vi.hoisted(() => ({ adminId: null as string | number | null, port: null as unknown }));
vi.mock('../../admin-auth', () => ({ verifiedAdminId: async () => world.adminId }));
vi.mock('../strapi-store', async (orig) => {
  const real = await orig<typeof import('../strapi-store')>();
  return {
    ...real,
    changeProgress: (_s: unknown, id: number, change: (p: Progress) => Progress) => real.changeWith(world.port as ProgressPort, id, change),
    readProgress: async () => ({ introAt: null, flows: {} }),
  };
});

type Ctx = { params: Record<string, string>; query: Record<string, unknown>; request: { body?: unknown; header: Record<string, string> }; status?: number; body?: unknown };
const handlers = onboarding as unknown as Record<string, (ctx: Ctx) => Promise<void>>;
const ctxOf = (body?: unknown): Ctx => ({ params: {}, query: {}, request: { body, header: { authorization: 'Bearer t' } } });

function fakePort(rows: Map<number, unknown>): ProgressPort {
  const ids = new Map<number, string>();
  return {
    transaction: (work) => work(),
    ensureAccount: async (n) => {
      if (!rows.has(n)) rows.set(n, null);
      ids.set(n, `acc${n}`);
      return `acc${n}`;
    },
    lock: async () => {},
    read: async (id) => rows.get(Number(id.slice(3))),
    write: async (id, next) => void rows.set(Number(id.slice(3)), next),
  };
}

let rows: Map<number, unknown>;
beforeEach(() => {
  rows = new Map();
  world.port = fakePort(rows);
  world.adminId = 7;
  Object.assign(globalThis, { strapi: {} });
});

describe('onboarding controller', () => {
  it('refuses an unknown flow id and a malformed body with 400, writing nothing', async () => {
    for (const body of [{ flow: 'nope' }, { intro: false }, { intro: true, flow: 'anunt' }, null]) {
      const ctx = ctxOf(body);
      await handlers.mark(ctx);
      expect(ctx.status).toBe(400);
    }
    expect(rows.size).toBe(0);
  });

  it('answers 401 without a session, on read and on mark', async () => {
    world.adminId = null;
    const read = ctxOf();
    const mark = ctxOf({ intro: true });
    await handlers.read(read);
    await handlers.mark(mark);
    expect([read.status, mark.status]).toEqual([401, 401]);
    expect(rows.size).toBe(0);
  });

  it('creates the account row on the first mark and keeps earlier marks', async () => {
    const first = ctxOf({ flow: 'anunt' });
    await handlers.mark(first);
    expect(rows.has(7)).toBe(true);
    const second = ctxOf({ intro: true });
    await handlers.mark(second);
    const data = (second.body as { data: Progress }).data;
    expect(Object.keys(data.flows)).toEqual(['anunt']);
    expect(data.introAt).not.toBeNull();
  });
});

describe('changeWith', () => {
  it('locks the row before reading', async () => {
    const calls: string[] = [];
    const port = { ...fakePort(rows), lock: async () => void calls.push('lock'), read: async () => (calls.push('read'), null) };
    await changeWith(port, 7, (p) => p);
    expect(calls).toEqual(['lock', 'read']);
  });
});
