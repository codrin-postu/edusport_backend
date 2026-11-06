import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addNewAthlete } from '../athletes';
import { coachContexts } from '../context';

/**
 * Runs only with PORTAL_PG_TEST=1, DATABASE_* on a throwaway Postgres 16 and IDS_FILE of the phase 4 and 6 fixtures
 * (a Club group and the team member who coaches it). "Sportiv nou" writes the athlete and the membership in one
 * transaction: a forced failure on the second write leaves neither.
 */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const idsFile = process.env.IDS_FILE;
const enabled = process.env.PORTAL_PG_TEST === '1' && !!idsFile && existsSync(idsFile);

describe.skipIf(!enabled)('"Sportiv nou" on Postgres', () => {
  let strapi: Core.Strapi;
  let ids: { groups: Record<string, string>; team: Record<string, string> };
  beforeAll(async () => {
    ids = JSON.parse(readFileSync(idsFile as string, 'utf8'));
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  const coachOf = () => coachContexts(strapi, { accountId: 'x', userId: 0, sessionId: 'x', teamMemberId: ids.team['Andreea Pascu'], name: 'Andreea Pascu' });
  const athletesNamed = (name: string) => strapi.db.query('api::athlete.athlete').findMany({ where: { name } });
  const membershipsOf = (athleteDocumentId: string) => strapi.db.query('api::group-membership.group-membership').findMany({ where: { athlete: { documentId: athleteDocumentId } } });

  it('writes the athlete and the group membership together', async () => {
    const name = `Sportiv Nou Test ${Date.now()}`;
    const out = await addNewAthlete(coachOf(), { groupId: ids.groups['Profesioniști'], name });
    expect(out).toMatchObject({ ok: true });
    const rows = await athletesNamed(name);
    expect(rows).toHaveLength(1);
    expect(await membershipsOf(rows[0].documentId as string)).toHaveLength(1);
  });

  it('a forced failure on the membership write leaves neither the athlete nor a membership', async () => {
    const name = `Sportiv Cazut Test ${Date.now()}`;
    const before = Number((await strapi.db.connection('group_memberships').count('* as c'))[0].c);
    const c = coachOf();
    c.groups.store.createMembership = async () => { throw new Error('forced failure on the second write'); };
    await expect(addNewAthlete(c, { groupId: ids.groups['Profesioniști'], name })).rejects.toThrow();
    expect(await athletesNamed(name)).toHaveLength(0);
    expect(Number((await strapi.db.connection('group_memberships').count('* as c'))[0].c)).toBe(before);
  });
});
