import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { strapiTableViewStore } from '../views-store';
import { fakeViewsDb, viewRow } from './fake-views-store';

const SRC = join(__dirname, '..', '..', '..');
const source = (p: string) => readFileSync(join(SRC, p), 'utf8');

/** Records what the store sends; `dialect` is what Strapi reports for the connection. */
function recordingStrapi(calls: string[], dialect = 'postgres'): Core.Strapi {
  let n = 0;
  let current: unknown = null;
  const chain = (table: string) => {
    const q = {
      transacting: (trx: string) => { calls.push(`${table} in ${trx}`); return q; },
      forUpdate: () => { calls.push(`${table} for update`); return q; },
      where: (col: string, id: string) => { calls.push(`${table} ${col}=${id}`); return q; },
      select: async () => [],
    };
    return q;
  };
  const db = {
    dialect: { client: dialect },
    getConnection: (table?: string) => chain(table ?? '*'),
    transaction: async (work: (a: { trx: unknown }) => Promise<unknown>) => {
      if (current) return work({ trx: current });
      n += 1;
      const name = `trx${n}`;
      current = { toString: () => name, raw: async (sql: string, args: unknown[]) => { calls.push(`raw ${sql} ${JSON.stringify(args)}`); } };
      try {
        return await work({ trx: current });
      } finally {
        current = null;
      }
    },
    query: (uid: string) => ({
      deleteMany: async (args: { where: unknown }) => { calls.push(`deleteMany ${uid} ${JSON.stringify(args.where)}`); return { count: 2 }; },
      findMany: async (args: { where: unknown }) => { calls.push(`findMany ${uid} ${JSON.stringify(args.where)}`); return []; },
    }),
  };
  return { db } as unknown as Core.Strapi;
}

describe('the in-memory views store', () => {
  it('has exactly the methods of the Strapi store', () => {
    const real = Object.keys(strapiTableViewStore({} as Core.Strapi)).sort();
    expect(Object.keys(fakeViewsDb().store()).sort()).toEqual(real);
  });

  it('serves copies and hides deleted views unless asked', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'a', definition: { x: 1 } }), viewRow({ id: 'b', deletedAt: '2026-11-20T10:00:00.000Z' })] });
    const s = db.store();
    expect((await s.views()).map((v) => v.id)).toEqual(['a']);
    expect((await s.views({ includeDeleted: true })).map((v) => v.id)).toEqual(['a', 'b']);
    (await s.view('a'))!.name = 'changed';
    expect(db.state.views[0].name).toBe('Vizualizare a');
    expect(await s.view('nope')).toBeNull();
  });

  it('a failed transaction undoes its writes, a successful one keeps them', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'a' })] });
    const s = db.store();
    await expect(s.transaction(async () => {
      await s.setDeleted('a', '2026-11-20T10:00:00.000Z');
      await s.createView({ name: 'N', subject: 'plati', definition: {}, authorId: 1, authorName: 'A' });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(db.state.views.map((v) => [v.id, v.deletedAt])).toEqual([['a', null]]);
    await s.transaction(async () => { await s.setDeleted('a', 'x'); });
    expect(db.state.views[0].deletedAt).toBe('x');
  });
});

describe('per-request stores', () => {
  it('each store has its own transaction scope: a lock outside its own transaction throws, even while another store is inside one', async () => {
    const db = fakeViewsDb({ views: [viewRow({ id: 'a' })] });
    const a = db.store();
    const b = db.store();
    let inside: Promise<void> = Promise.resolve();
    await a.transaction(async () => {
      await a.lockView('a');
      inside = b.lockView('a');
      await expect(inside).rejects.toThrow('outside a transaction');
    });
    await expect(b.lockViewNames()).rejects.toThrow('outside a transaction');
  });

  it('the Strapi store keeps no state between requests: two stores, two scopes', async () => {
    const calls: string[] = [];
    const strapi = recordingStrapi(calls);
    const a = strapiTableViewStore(strapi);
    const b = strapiTableViewStore(strapi);
    expect(a).not.toBe(b);
    await a.transaction(async () => {
      await a.lockView('v1');
      await expect(b.lockView('v1')).rejects.toThrow('outside a transaction');
    });
    expect(calls.filter((c) => c.startsWith('club_table_views'))).toEqual(['club_table_views in trx1', 'club_table_views for update', 'club_table_views document_id=v1']);
    await expect(a.lockView('v1')).rejects.toThrow('outside a transaction');
  });

  it('a nested transaction reuses the outer one', async () => {
    const calls: string[] = [];
    const s = strapiTableViewStore(recordingStrapi(calls));
    await s.transaction(async () => { await s.transaction(async () => { await s.lockView('v1'); }); });
    expect(calls).toContain('club_table_views in trx1');
  });

  it('the module holds no mutable state of its own', () => {
    expect(source('club/tables/views-store.ts')).not.toMatch(/^(let|var) /m);
  });
});

describe('the Strapi views store', () => {
  it('takes the names lock as a Postgres advisory lock inside the transaction, and none elsewhere', async () => {
    const pg: string[] = [];
    const s = strapiTableViewStore(recordingStrapi(pg));
    await expect(s.lockViewNames()).rejects.toThrow('outside a transaction');
    await s.transaction(() => s.lockViewNames());
    expect(pg.filter((c) => c.startsWith('raw'))).toEqual(['raw select pg_advisory_xact_lock(hashtext(?)) ["club_table_views"]']);
    const lite: string[] = [];
    const t = strapiTableViewStore(recordingStrapi(lite, 'sqlite'));
    await t.transaction(() => t.lockViewNames());
    expect(lite.filter((c) => c.startsWith('raw'))).toEqual([]);
  });

  it('lists live views by default and purges by deletedAt', async () => {
    const calls: string[] = [];
    const s = strapiTableViewStore(recordingStrapi(calls));
    await s.views();
    await s.views({ includeDeleted: true });
    expect(await s.purgeDeletedBefore('2026-11-19T12:00:00.000Z')).toBe(2);
    expect(calls.filter((c) => c.startsWith('findMany') || c.startsWith('deleteMany'))).toEqual([
      'findMany api::table-view.table-view {"deletedAt":{"$null":true}}',
      'findMany api::table-view.table-view {}',
      'deleteMany api::table-view.table-view {"deletedAt":{"$lt":"2026-11-19T12:00:00.000Z"}}',
    ]);
  });
});

describe('the table-view content type', () => {
  const schema = JSON.parse(source('api/table-view/content-types/table-view/schema.json'));
  it('is hidden, without draft and publish, with the columns the service needs', () => {
    expect(schema.collectionName).toBe('club_table_views');
    expect(schema.options.draftAndPublish).toBe(false);
    expect(schema.pluginOptions['content-manager'].visible).toBe(false);
    expect(schema.attributes.name).toEqual({ type: 'string', required: true, minLength: 1, maxLength: 80 });
    expect(schema.attributes.subject).toEqual({ type: 'enumeration', enum: ['sportivi', 'plati', 'abonamente', 'prezenta'], required: true });
    expect(schema.attributes.definition).toEqual({ type: 'json', required: true });
    expect(schema.attributes.authorId).toEqual({ type: 'integer', required: true });
    expect(schema.attributes.authorName).toEqual({ type: 'string' });
    expect(schema.attributes.deletedAt).toEqual({ type: 'datetime' });
  });
  it('has no generated content-API routes', () => {
    expect(source('api/table-view/routes/table-view.ts')).toContain("createCoreRouter('api::table-view.table-view', { only: [] })");
  });
});

describe('wiring', () => {
  it('the subject constant and the undo dispatch are in place', () => {
    expect(source('club/subjects.ts')).toContain("tableView: 'table-view'");
    expect(source('api/club/controllers/groups.ts')).toMatch(/undoKindOf\(.*\) === 'table-view'/);
    expect(source('api/club/controllers/groups.ts')).toContain('undoViewDelete(');
    expect(source('club/presence/undo-service.ts')).toContain("'table-view'");
  });
});
