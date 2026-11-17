import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiParcursStore } from '../strapi-store';

/** Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database). */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';

describe.skipIf(!enabled)('strapiParcursStore on Postgres', () => {
  let strapi: Core.Strapi;
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  const athlete = async (n: string) => text(await strapi.documents('api::athlete.athlete').create({ data: { firstName: n, lastName: `pg${Date.now()}` } as never }));
  const text = (r: unknown) => String((r as { documentId: string }).documentId);

  it('stores, filters, drops and merges awards, grants and pins', async () => {
    const store = strapiParcursStore(strapi);
    const [a, b, c] = [await athlete('A'), await athlete('B'), await athlete('C')];
    const award = { athleteId: a, kind: 'jump' as const, jump: 'lz' as const, level: 2 as const, givenBy: { adminId: '1' }, givenOn: '2026-11-01' };
    const awardId = await store.addAward(award);
    expect(await store.awards({ athleteId: a })).toEqual([{ ...award, id: awardId }]);
    const grantId = await store.addGrant({ athleteId: a, source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2027-01-31' });
    await store.addPin({ grantId, giverId: a, recipientId: b, design: 3, givenOn: '2026-11-02' });
    expect(await store.pins({ recipientId: b })).toHaveLength(1);
    await store.moveForMerge(c, b);
    expect(await store.pins({ recipientId: c })).toHaveLength(1);
    await store.transaction(() => store.lockAthlete(a));
    await store.dropForAthlete(a);
    expect(await store.awards({ athleteId: a })).toEqual([]);
    expect(await store.grants({ athleteId: a })).toEqual([]);
    expect(await store.pins({})).not.toContainEqual(expect.objectContaining({ giverId: a }));
  });
});
