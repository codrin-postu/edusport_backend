import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiPortalStore } from '../../strapi-store';
import { ensurePortalIndexes } from '../../accounts/team-member-hook';
import { accessContext } from '../context';
import { ensureAccessIndexes } from '../indexes';
import { inviteAccess } from '../invite';
import { endForAthlete, moveOnEmailChange } from '../lifecycle';

/**
 * Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database). The lifecycle functions run inside
 * the caller's transaction (anonymize, delete, merge, the athlete edit): when the caller fails afterwards, the access change must roll back too.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';

describe.skipIf(!enabled)('access lifecycle inside an outer transaction on Postgres', () => {
  let strapi: Core.Strapi;
  const stamp = Date.now();

  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
    await ensurePortalIndexes(strapi.db.connection);
    await ensureAccessIndexes(strapi.db.connection);
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  const context = () => {
    const c = accessContext(strapi, 'admin@example.invalid');
    c.afterCommit = () => undefined;
    c.siteUrl = 'https://scoaladepatinaj.com';
    return c;
  };
  const invited = async (n: string) => {
    const email = `lc-${stamp}-${n}@example.invalid`;
    const athleteId = (await strapi.documents('api::athlete.athlete').create({ data: { name: `Lifecycle ${n}`, status: 'activ', email } as never })).documentId;
    const c = context();
    expect((await inviteAccess(c, athleteId)).ok).toBe(true);
    return { athleteId, email, c };
  };
  const liveRows = (athleteId: string) => strapi.db.query('api::athlete-access.athlete-access').findMany({ where: { athleteKey: athleteId, revokedAt: { $null: true } } });

  it('endForAthlete is undone when the outer transaction fails afterwards, and kept when it commits', async () => {
    const { athleteId, c } = await invited('end');
    await expect(c.store.transaction(async () => {
      await endForAthlete(c, athleteId, 'anonimizat');
      throw new Error('later step failed');
    })).rejects.toThrow('later step failed');
    expect(await liveRows(athleteId)).toHaveLength(1);
    await c.store.transaction(() => endForAthlete(c, athleteId, 'anonimizat'));
    expect(await liveRows(athleteId)).toHaveLength(0);
  }, 60_000);

  it('an e-mail move is undone with the edit that failed', async () => {
    const { athleteId, email, c } = await invited('move');
    const target = `lc-${stamp}-target@example.invalid`;
    await expect(c.store.transaction(async () => {
      expect((await moveOnEmailChange(c, athleteId, email, target)).ok).toBe(true);
      throw new Error('edit failed');
    })).rejects.toThrow('edit failed');
    const rows = await liveRows(athleteId);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { email: string }).email).toBe(email);
    expect(await strapiPortalStore(strapi).accountByEmail(target)).toBeNull();
  }, 60_000);
});
