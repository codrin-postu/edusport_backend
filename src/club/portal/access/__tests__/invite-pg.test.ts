import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_ERRORS } from '../../../athletes/errors';
import { ensurePortalIndexes } from '../../accounts/team-member-hook';
import { accessContext } from '../context';
import { ensureAccessIndexes } from '../indexes';
import { inviteAccess } from '../invite';

/**
 * Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database): it boots Strapi,
 * which creates the schema, then drives the real stores.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';

describe.skipIf(!enabled)('athlete access invite on Postgres', () => {
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

  /** A context whose after-commit release is recorded instead of attempting a send. */
  const context = (actor: string) => {
    const released: string[] = [];
    const c = accessContext(strapi, actor);
    c.afterCommit = (id) => void released.push(id);
    c.siteUrl = 'https://scoaladepatinaj.com';
    return { c, released };
  };

  it('concurrent invites leave one live access', async () => {
    const email = `parinte-${stamp}@example.invalid`;
    const athleteId = (await strapi.documents('api::athlete.athlete').create({ data: { name: `Race ${stamp}`, status: 'activ', email } as never })).documentId;
    const [a, b] = [context('admin-a@example.invalid'), context('admin-b@example.invalid')];
    const results = await Promise.all([inviteAccess(a.c, athleteId), inviteAccess(b.c, athleteId)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
    const live = await strapi.db.query('api::athlete-access.athlete-access').findMany({ where: { athleteKey: athleteId, revokedAt: { $null: true } } });
    expect(live).toHaveLength(1);
    const accounts = await strapi.db.query('api::portal-account.portal-account').findMany({ where: { email } });
    expect(accounts).toHaveLength(1);
    const jobs = await strapi.db.query('api::email-job.email-job').findMany({ where: { kind: 'portal-invite', recipient: email } });
    expect(jobs).toHaveLength(1);
    expect(a.released.length + b.released.length).toBe(1);
  }, 60_000);
});
