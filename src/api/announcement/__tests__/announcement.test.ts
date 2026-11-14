import { afterEach, describe, expect, it, vi } from 'vitest';
import controller from '../controllers/announcement';

type Call = { method: string; args: any };

function setup(found: any[] = [], stored: any = { showOnSite: true, showOnPortal: false, portalAuthor: null }) {
  const calls: Call[] = [];
  const documents = () => ({
    findMany: async (args: any) => (calls.push({ method: 'findMany', args }), found),
    findOne: async (args: any) => (calls.push({ method: 'findOne', args }), stored),
    create: async (args: any) => (calls.push({ method: 'create', args }), { documentId: 'd1', ...args.data }),
    update: async (args: any) => (calls.push({ method: 'update', args }), { documentId: args.documentId, ...args.data }),
  });
  (globalThis as any).strapi = { documents, config: { get: () => undefined }, db: { query: () => ({ findOne: async () => null }) } };
  return calls;
}

const ctxOf = (data: any) => {
  const ctx: any = { request: { body: { data }, header: {} }, params: {}, body: null };
  ctx.badRequest = vi.fn((m: string) => (ctx.bad = m));
  return ctx;
};
const base = { title: 'T', message: 'M', startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-02T00:00:00.000Z' };

afterEach(() => {
  delete (globalThis as any).strapi;
});

describe('current', () => {
  it('filters out rows not shown on the site but keeps null showOnSite', async () => {
    const calls = setup([{ slug: 'a', showOnSite: null }]);
    const ctx: any = {};
    await (controller as any).current(ctx);
    expect(calls[0].args.filters.$or).toEqual([{ showOnSite: true }, { showOnSite: { $null: true } }]);
    expect(calls[0].args.filters.showOnSite).toBeUndefined();
    expect(ctx.body.data.slug).toBe('a');
  });
});

describe('create', () => {
  it('refuses when neither place is ticked', async () => {
    const calls = setup();
    const ctx = ctxOf({ ...base, showOnSite: false, showOnPortal: false });
    await (controller as any).createAnnouncement(ctx);
    expect(ctx.bad).toBe('Alege unde apare.');
    expect(calls.some((c) => c.method === 'create')).toBe(false);
  });

  it('refuses an empty group list', async () => {
    setup();
    const ctx = ctxOf({ ...base, showOnPortal: true, portalGroupIds: [] });
    await (controller as any).createAnnouncement(ctx);
    expect(ctx.bad).toBe('Alege cel puțin o grupă.');
  });

  it('keeps portalGroupIds sorted and unique and sets the author', async () => {
    const calls = setup();
    const ctx = ctxOf({ ...base, showOnPortal: true, portalGroupIds: ['b', 'a', 'b'], portalAuthor: 'spoof' });
    await (controller as any).createAnnouncement(ctx);
    const data = calls.find((c) => c.method === 'create')!.args.data;
    expect(data.portalGroupIds).toEqual(['a', 'b']);
    expect(data.portalAuthor).toBe('admin');
  });
});

describe('update', () => {
  it('keeps portalGroupIds sorted and unique', async () => {
    const calls = setup();
    const ctx = ctxOf({ showOnSite: true, showOnPortal: true, portalGroupIds: ['z', 'y', 'z'] });
    ctx.params = { documentId: 'd1' };
    await (controller as any).updateAnnouncement(ctx);
    expect(calls.find((c) => c.method === 'update')!.args.data.portalGroupIds).toEqual(['y', 'z']);
  });
});

describe('update places and author', () => {
  const put = async (data: any, stored?: any) => {
    const calls = setup([], stored);
    const ctx = ctxOf(data);
    ctx.params = { documentId: 'd1' };
    await (controller as any).updateAnnouncement(ctx);
    return { calls, ctx };
  };

  it('refuses a patch that leaves the merged row with no place', async () => {
    const { calls, ctx } = await put({ showOnSite: false }, { showOnSite: true, showOnPortal: false, portalAuthor: null });
    expect(ctx.bad).toBe('Alege unde apare.');
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });

  it('accepts the same patch when the portal is stored as ticked', async () => {
    const { ctx } = await put({ showOnSite: false }, { showOnSite: true, showOnPortal: true, portalAuthor: 'x' });
    expect(ctx.bad).toBeUndefined();
  });

  it('sets the author when the portal is ticked on an existing row without one', async () => {
    const { calls } = await put({ showOnPortal: true });
    expect(calls.find((c) => c.method === 'update')!.args.data.portalAuthor).toBe('admin');
  });

  it('keeps a stored author', async () => {
    const { calls } = await put({ showOnPortal: true }, { showOnSite: true, showOnPortal: false, portalAuthor: 'a@b.ro' });
    expect(calls.find((c) => c.method === 'update')!.args.data.portalAuthor).toBeUndefined();
  });
});
