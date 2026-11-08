import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiPresenceStore } from '../strapi-store';

/**
 * Runs only with PRESENCE_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then drives the real counter. Every parallel caller builds its own store, as every request does.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PRESENCE_PG_TEST === '1';

describe.skipIf(!enabled)('club counters on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });
  const fresh = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const take = async (key: string, holdMs = 0): Promise<number> => {
    const store = strapiPresenceStore(strapi);
    return store.transaction(async () => {
      const n = await store.nextCounter(key);
      await new Promise((r) => setTimeout(r, holdMs));
      return n;
    });
  };

  it('the counter key has a database unique index', async () => {
    const rows = await strapi.db.connection.raw("select indexdef from pg_indexes where tablename = 'club_counters' and indexdef ilike '%unique%'");
    expect((rows.rows as { indexdef: string }[]).map((r) => r.indexdef).join('\n')).toMatch(/\(key\)/);
  });

  it('20 parallel creates on a brand-new key get 1..20, one each, and one row', async () => {
    const key = fresh('subscription');
    const numbers = await Promise.all(Array.from({ length: 20 }, () => take(key, 20)));
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(await strapiPresenceStore(strapi).counterValue(key)).toBe(20);
    const n = await strapi.db.connection('club_counters').where('key', key).count('* as c');
    expect(Number(n[0].c)).toBe(1);
  });

  it('a second wave on the existing key continues after the first', async () => {
    const key = fresh('receipt:2026');
    await Promise.all(Array.from({ length: 5 }, () => take(key)));
    const wave = await Promise.all(Array.from({ length: 5 }, () => take(key, 10)));
    expect([...wave].sort((a, b) => a - b)).toEqual([6, 7, 8, 9, 10]);
  });

  it('a rolled back transaction gives its number back; a number taken is not lost on commit', async () => {
    const key = fresh('subscription');
    const store = strapiPresenceStore(strapi);
    await expect(store.transaction(async () => {
      await store.nextCounter(key);
      throw new Error('refused');
    })).rejects.toThrow('refused');
    expect(await store.counterValue(key)).toBe(0);
    expect(await take(key)).toBe(1);
  });

  it('raiseCounter only goes up and creates a missing row', async () => {
    const key = fresh('subscription');
    const store = strapiPresenceStore(strapi);
    await store.transaction(() => store.raiseCounter(key, 40));
    await store.transaction(() => store.raiseCounter(key, 10));
    expect(await store.counterValue(key)).toBe(40);
    expect(await take(key)).toBe(41);
  });

  it('a counter outside a transaction is refused', async () => {
    await expect(strapiPresenceStore(strapi).nextCounter(fresh('x'))).rejects.toThrow('outside a transaction');
  });
});
