import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiPortalStore } from '../../strapi-store';
import { backfillDeviceHosts, ensureAccessIndexes } from '../indexes';
import { strapiAccessStore } from '../strapi-store';
import type { AccessStore } from '../store';

/**
 * Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then drives the real access store.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';

describe.skipIf(!enabled)('athlete access store on Postgres', () => {
  let strapi: Core.Strapi;
  let access: AccessStore;
  const stamp = Date.now();
  const at = '2026-11-11T10:00:00.000Z';
  const athlete = async (n: string) => (await strapi.documents('api::athlete.athlete').create({ data: { name: `Access PG ${n}`, status: 'activ' } as never })).documentId;
  const account = async (n: string) => {
    const store = strapiPortalStore(strapi);
    const email = `access-${stamp}-${n}@example.invalid`;
    return store.createAccount({ userId: await store.createUser(email, null), email, status: 'invited' });
  };

  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    await ensureAccessIndexes(strapi.db.connection);
    access = strapiAccessStore(strapi);
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  it('a second live access for one athlete is refused by the database; after a revoke a new one is accepted', async () => {
    const athleteId = await athlete('one');
    const [a, b] = [await account('a'), await account('b')];
    const first = await access.createAccess({ athleteId, accountId: a, email: 'a@example.invalid', invitedAt: at, invitedBy: 'admin' });
    await expect(access.createAccess({ athleteId, accountId: b, email: 'b@example.invalid', invitedAt: at, invitedBy: 'admin' })).rejects.toMatchObject({ code: '23505' });
    await access.revokeAccess(first, { revokedAt: at, revokedBy: 'admin', revokeReason: 'scos' });
    const second = await access.createAccess({ athleteId, accountId: b, email: 'b@example.invalid', invitedAt: at, invitedBy: 'admin' });
    expect((await access.liveByAthlete(athleteId))?.id).toBe(second);
  });

  it('live reads ignore revoked rows', async () => {
    const [x, y] = [await athlete('x'), await athlete('y')];
    const holder = await account('holder');
    const keep = await access.createAccess({ athleteId: x, accountId: holder, email: 'h@example.invalid', invitedAt: at, invitedBy: 'admin' });
    const gone = await access.createAccess({ athleteId: y, accountId: holder, email: 'h@example.invalid', invitedAt: at, invitedBy: 'admin' });
    await access.revokeAccess(gone, { revokedAt: at, revokedBy: 'admin', revokeReason: 'email_schimbat' });
    expect(await access.liveByAthlete(y)).toBeNull();
    expect((await access.liveByAccount(holder)).map((r) => r.id)).toEqual([keep]);
  });

  it('device and token rows without a host get the coach host, and a second run changes nothing', async () => {
    const accountId = await account('backfill');
    const now = new Date();
    await strapi.db.query('api::portal-device.portal-device').create({
      data: { documentId: `dev-${stamp}`, account: (await strapi.documents('api::portal-account.portal-account').findOne({ documentId: accountId }))!.id, deviceKeyHash: 'h', label: 'x', lastSeenAt: now, publishedAt: now },
    });
    expect(await backfillDeviceHosts(strapi.db.connection)).toBeGreaterThanOrEqual(1);
    expect(await backfillDeviceHosts(strapi.db.connection)).toBe(0);
  });
});
