import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TableDefinition } from '../types';
import { createView, deleteView, updateView, type Caller } from '../views-service';
import { strapiTableViewStore } from '../views-store';

/**
 * Runs only with PRESENCE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi, which
 * creates the schema, then drives the real views store. Every parallel caller builds its own store, as every request does.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PRESENCE_PG_TEST === '1';

const ana: Caller = { adminId: 1, name: 'Ana Pop', email: 'ana@club.ro', superAdmin: false };
const def: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: { kind: 'current' } }, columns: ['data', 'sportiv', 'suma'], filters: [], groupBy: null, sort: null };
const other: TableDefinition = { ...def, columns: ['data', 'suma'] };

describe.skipIf(!enabled)('saved views on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });
  const fresh = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const store = () => strapiTableViewStore(strapi);
  const rows = async (name: string) => (await store().views({ includeDeleted: true })).filter((v) => v.name === name);

  it('the names lock serializes creates: 12 parallel saves of one name end with exactly one row', async () => {
    const name = fresh('Plăți');
    const results = await Promise.all(Array.from({ length: 12 }, () => createView(store(), ana, { name, definition: def })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => (r.ok ? 0 : r.status))).toEqual(Array(11).fill(400));
    expect(await rows(name)).toHaveLength(1);
  });

  it('the same holds across cases of one name', async () => {
    const name = fresh('Rămas');
    const results = await Promise.all([name, name.toUpperCase(), name.toLowerCase(), name].map((n) => createView(store(), ana, { name: n, definition: def })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('the row lock keeps a parallel edit and delete consistent: the row ends deleted, with one whole name and one whole definition', async () => {
    for (let round = 0; round < 12; round += 1) {
      const name = fresh('Editat');
      const made = await createView(store(), ana, { name, definition: def });
      if (!made.ok) throw new Error('setup');
      const id = made.data.value.view.id;
      const renamed = `${name} nou`;
      const [edit, del] = await Promise.all([
        updateView(store(), ana, id, { name: renamed, definition: other }),
        deleteView(store(), ana, id),
      ]);
      expect(del.ok, `round ${round}`).toBe(true);
      if (!edit.ok) expect(edit.status).toBe(404);
      const row = await store().view(id);
      expect(row?.deletedAt, `round ${round}`).not.toBeNull();
      const whole = edit.ok ? [renamed, other] : [name, def];
      expect([row?.name, row?.definition], `round ${round}`).toEqual(whole);
    }
  });

  it('two parallel edits of one view both apply in turn and end with one whole row', async () => {
    const name = fresh('Dublu');
    const made = await createView(store(), ana, { name, definition: def });
    if (!made.ok) throw new Error('setup');
    const id = made.data.value.view.id;
    const [a, b] = await Promise.all([updateView(store(), ana, id, { definition: other }), updateView(store(), ana, id, { definition: def, name: `${name} b` })]);
    expect(a.ok && b.ok).toBe(true);
    const row = await store().view(id);
    // Either order is whole: the name only b writes, and the definition of whichever ran last.
    expect(row?.name).toBe(`${name} b`);
    expect([def, other]).toContainEqual(row?.definition);
  });

  it('lockView is a real row lock: a second transaction waits for the first to end', async () => {
    const made = await createView(store(), ana, { name: fresh('Blocat'), definition: def });
    if (!made.ok) throw new Error('setup');
    const id = made.data.value.view.id;
    const log: string[] = [];
    const a = store();
    const b = store();
    const first = a.transaction(async () => {
      await a.lockView(id);
      log.push('a locked');
      await new Promise((r) => setTimeout(r, 400));
      log.push('a done');
    });
    await new Promise((r) => setTimeout(r, 100));
    const second = b.transaction(async () => {
      await b.lockView(id);
      log.push('b locked');
    });
    await Promise.all([first, second]);
    expect(log).toEqual(['a locked', 'a done', 'b locked']);
  });
});
