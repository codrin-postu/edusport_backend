import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiSnapshotStore } from '../strapi-store';

/**
 * Runs only with SKATE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi, which
 * creates the schema, then drives the real snapshot store.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.SKATE_PG_TEST === '1';

describe.skipIf(!enabled)('skate snapshots on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });
  const fresh = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rowCount = async (key: string) => Number((await strapi.db.connection('skate_snapshots').where('key', key).count('* as c'))[0].c);

  it('put then get returns the body with no failure', async () => {
    const key = fresh('skater');
    const store = strapiSnapshotStore(strapi);
    await store.put(key, { name: 'x', points: [1, 2] }, '2026-11-10T08:00:00.000Z');
    const snap = await store.get(key);
    expect(snap?.body).toEqual({ name: 'x', points: [1, 2] });
    expect(snap?.fetchedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(snap?.failedAt).toBeNull();
  });

  it('fail keeps the body and sets failedAt', async () => {
    const key = fresh('protocol');
    const store = strapiSnapshotStore(strapi);
    await store.put(key, { rank: 3 }, '2026-11-10T08:00:00.000Z');
    await store.fail(key, '2026-11-10T09:00:00.000Z');
    const snap = await store.get(key);
    expect(snap?.body).toEqual({ rank: 3 });
    expect(snap?.failedAt).toBe('2026-11-10T09:00:00.000Z');
  });

  it('a later put clears failedAt and replaces the body', async () => {
    const key = fresh('field');
    const store = strapiSnapshotStore(strapi);
    await store.put(key, { n: 1 }, '2026-11-10T08:00:00.000Z');
    await store.fail(key, '2026-11-10T09:00:00.000Z');
    await store.put(key, { n: 2 }, '2026-11-10T10:00:00.000Z');
    const snap = await store.get(key);
    expect(snap?.body).toEqual({ n: 2 });
    expect(snap?.fetchedAt).toBe('2026-11-10T10:00:00.000Z');
    expect(snap?.failedAt).toBeNull();
  });

  it('a second put on one key updates the row; the unique key holds', async () => {
    const key = fresh('skater');
    const store = strapiSnapshotStore(strapi);
    await store.put(key, { v: 1 }, '2026-11-10T08:00:00.000Z');
    await store.put(key, { v: 2 }, '2026-11-10T08:30:00.000Z');
    expect(await rowCount(key)).toBe(1);
    expect((await store.get(key))?.body).toEqual({ v: 2 });
  });

  it('parallel first puts on a new key leave one row', async () => {
    const key = fresh('skater');
    const store = strapiSnapshotStore(strapi);
    await Promise.all(Array.from({ length: 5 }, (_, i) => store.put(key, { i }, '2026-11-10T08:00:00.000Z')));
    expect(await rowCount(key)).toBe(1);
  });

  it('get of an unknown key answers null', async () => {
    expect(await strapiSnapshotStore(strapi).get(fresh('skater'))).toBeNull();
  });
});
