import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiParcursStore, AWARD, GRANT, PIN } from '../strapi-store';

/** Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database). */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';
const ATHLETE = 'api::athlete.athlete';
const TEAM = 'api::team-member.team-member';

describe.skipIf(!enabled)('strapiParcursStore on Postgres', () => {
  let strapi: Core.Strapi;
  const athletes: string[] = [];
  const members: string[] = [];
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    if (!strapi) return;
    const where = { id: { $notNull: true } };
    for (const uid of [PIN, GRANT, AWARD] as const) await strapi.db.query(uid).deleteMany({ where });
    if (athletes.length) await strapi.db.query(ATHLETE).deleteMany({ where: { documentId: { $in: athletes } } });
    if (members.length) await strapi.db.query(TEAM).deleteMany({ where: { documentId: { $in: members } } });
    await strapi.db.connection.destroy();
  });

  const docId = (r: unknown) => String((r as { documentId: string }).documentId);
  const athlete = async (n: string) => {
    const id = docId(await strapi.documents(ATHLETE).create({ data: { firstName: n, lastName: `pg${Date.now()}` } as never }));
    athletes.push(id);
    return id;
  };
  const member = async () => {
    const id = docId(await strapi.documents(TEAM).create({ data: { name: 'Antrenor' } as never }));
    members.push(id);
    return id;
  };
  const grantOf = (athleteId: string) => ({ athleteId, source: 'm:2026-11', size: 2, createdOn: '2026-11-01', expiresOn: '2027-01-31' });
  const awardOf = (athleteId: string, givenBy: { teamMemberId: string } | { adminId: string }) => ({ athleteId, kind: 'jump' as const, jump: 'lz' as const, level: 2 as const, givenBy, givenOn: '2026-11-01' });

  it('stores awards with admin or team-member giver, and deletes one', async () => {
    const store = strapiParcursStore(strapi);
    const [a, tm] = [await athlete('A'), await member()];
    const byAdmin = awardOf(a, { adminId: '1' });
    const byMember = awardOf(a, { teamMemberId: tm });
    const [id1, id2] = [await store.addAward(byAdmin), await store.addAward(byMember)];
    expect(await store.awards({ athleteId: a })).toEqual([{ ...byAdmin, id: id1 }, { ...byMember, id: id2 }]);
    await store.deleteAward(id1);
    expect((await store.awards({ athleteId: a })).map((r) => r.id)).toEqual([id2]);
  });

  it('stores grants and pins, filters pins, deletes a pin', async () => {
    const store = strapiParcursStore(strapi);
    const [a, b] = [await athlete('A'), await athlete('B')];
    const grantId = await store.addGrant(grantOf(a));
    expect(await store.grants({ athleteId: a })).toEqual([{ ...grantOf(a), id: grantId }]);
    const pin = { grantId, giverId: a, recipientId: b, design: 3, givenOn: '2026-11-02' };
    const pinId = await store.addPin(pin);
    expect(await store.pins({ grantId })).toEqual([{ ...pin, id: pinId }]);
    expect(await store.pins({ giverId: a, recipientId: b })).toHaveLength(1);
    await store.deletePin(pinId);
    expect(await store.pins({ grantId })).toEqual([]);
  });

  it('moveForMerge repoints awards, grants and pins; dropForAthlete removes them', async () => {
    const store = strapiParcursStore(strapi);
    const [kept, removed, other] = [await athlete('K'), await athlete('R'), await athlete('O')];
    await store.addAward(awardOf(removed, { adminId: '1' }));
    const grantId = await store.addGrant(grantOf(removed));
    const otherGrant = await store.addGrant(grantOf(other));
    await store.addPin({ grantId, giverId: removed, recipientId: other, design: 1, givenOn: '2026-11-02' });
    await store.addPin({ grantId: otherGrant, giverId: other, recipientId: removed, design: 2, givenOn: '2026-11-02' });
    await store.moveForMerge(kept, removed);
    expect(await store.awards({ athleteId: removed })).toEqual([]);
    expect(await store.awards({ athleteId: kept })).toHaveLength(1);
    expect(await store.grants({ athleteId: kept })).toHaveLength(1);
    expect(await store.pins({ giverId: kept, recipientId: other })).toHaveLength(1);
    expect(await store.pins({ giverId: other, recipientId: kept })).toHaveLength(1);
    await store.dropForAthlete(kept);
    expect(await store.awards({ athleteId: kept })).toEqual([]);
    expect(await store.grants({ athleteId: kept })).toEqual([]);
    expect(await store.pins({ giverId: kept })).toEqual([]);
    expect(await store.pins({ recipientId: kept })).toEqual([]);
    expect(await store.grants({ athleteId: other })).toHaveLength(1);
    await store.dropForAthlete(kept);
  });

  it('lockAthlete runs inside a transaction and throws outside one', async () => {
    const store = strapiParcursStore(strapi);
    const a = await athlete('L');
    await store.transaction(() => store.lockAthlete(a));
    await expect(store.lockAthlete(a)).rejects.toThrow(/outside a transaction/);
  });
});
