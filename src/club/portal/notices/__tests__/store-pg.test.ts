import { createRequire } from 'node:module';
import type { Core } from '@strapi/strapi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { strapiNoticeStore, NOTICE, DELIVERY } from '../strapi-store';
import { strapiAccessStore } from '../../access/strapi-store';
import { strapiPortalStore } from '../../strapi-store';

/** Runs only with PORTAL_PG_TEST=1 and DATABASE_* pointing at a throwaway Postgres 16 (never a shared database). */
const { compileStrapi, createStrapi } = createRequire(__filename)('@strapi/strapi') as typeof import('@strapi/strapi');
const enabled = process.env.PORTAL_PG_TEST === '1';
const T1 = '2026-11-14T10:00:00.000Z';
const T2 = '2026-11-14T11:00:00.000Z';

describe.skipIf(!enabled)('strapiNoticeStore on Postgres', () => {
  let strapi: Core.Strapi;
  const stamp = Date.now();
  beforeAll(async () => {
    strapi = await createStrapi(await compileStrapi()).load();
  }, 240_000);
  afterAll(async () => {
    await strapi?.db.connection.destroy();
  });

  const account = async (n: string) => {
    const portal = strapiPortalStore(strapi);
    const email = `nt-${stamp}-${n}@example.invalid`;
    return portal.createAccount({ userId: await portal.createUser(email, null), email, status: 'active', name: 'Parinte', invitedAt: T1 });
  };
  const draft = (accountId: string | null, athleteIds: string[]) => ({ kind: 'auto' as const, accountId, announcementId: null, key: 'k', title: 't', rows: [{ date: '2026-11-20', text: 'x', reason: null }], athleteIds, groupIds: [], lastDate: '2026-11-20' });

  it('creates, delivers once per account, dismisses, marks seen once, ends', async () => {
    const store = strapiNoticeStore(strapi);
    const a = await account('a');
    const id = await store.createNotice(draft(a, ['ath1']), T1);
    expect(await store.deliver(id, [a, a], T1)).toBe(1);
    expect(await store.deliver(id, [a], T2)).toBe(0);
    const [d] = await store.deliveries({ accountId: a, open: true });
    await store.markSeen([d.id], T1);
    await store.markSeen([d.id], T2);
    expect((await store.deliveries({ noticeId: id }))[0].seenAt).toBe(T1);
    await store.dismiss(d.id, T2);
    expect(await store.deliveries({ accountId: a, open: true })).toEqual([]);
    expect((await store.liveAutoNotice(a))?.id).toBe(id);
    await store.endNotice(id, T2);
    expect(await store.liveAutoNotice(a)).toBeNull();
    expect((await store.notice(id))).toMatchObject({ createdAt: T1, rows: [{ text: 'x' }], athleteIds: ['ath1'] });
  });

  it('deliveriesFor reads several notices in one call', async () => {
    const store = strapiNoticeStore(strapi);
    const a = await account('c');
    const one = await store.createNotice(draft(a, ['x1']), T1);
    const two = await store.createNotice(draft(a, ['x2']), T1);
    await store.deliver(one, [a], T1);
    await store.deliver(two, [a], T1);
    expect((await store.deliveriesFor([one, two])).map((d) => d.noticeId).sort()).toEqual([one, two].sort());
    expect(await store.deliveriesFor([])).toEqual([]);
  });

  it('noticesOfAnnouncements reads several in one call', async () => {
    const store = strapiNoticeStore(strapi);
    expect(await store.noticesOfAnnouncements([])).toEqual([]);
    expect(await store.noticesOfAnnouncements([`none-${stamp}`])).toEqual([]);
  });

  it('dropNoticesForAthlete removes the named notices with their deliveries only', async () => {
    const store = strapiNoticeStore(strapi);
    const a = await account('b');
    const named = await store.createNotice(draft(a, [`gone-${stamp}`]), T1);
    const other = await store.createNotice(draft(a, ['keep']), T1);
    await store.deliver(named, [a], T1);
    await store.deliver(other, [a], T1);
    await strapiAccessStore(strapi).dropNoticesForAthlete(`gone-${stamp}`);
    expect(await store.notice(named)).toBeNull();
    expect(await store.deliveries({ noticeId: named })).toEqual([]);
    expect(await store.deliveries({ noticeId: other })).toHaveLength(1);
  });

  it('purgeOrphans removes what a deleted account left behind', async () => {
    const store = strapiNoticeStore(strapi);
    const a = await account('c');
    const id = await store.createNotice(draft(a, ['x']), T1);
    await store.deliver(id, [a], T1);
    await strapi.documents('api::portal-account.portal-account').delete({ documentId: a });
    const gone = await store.purgeOrphans();
    expect(gone.notices).toBeGreaterThanOrEqual(1);
    expect(await strapi.db.query(NOTICE).count({ where: { documentId: id } })).toBe(0);
    expect(await strapi.db.query(DELIVERY).count({ where: { notice: { documentId: id } } })).toBe(0);
  });

  it('purgeEnded removes ended automatic notices before the instant with their deliveries; liveNotices skips ended ones', async () => {
    const store = strapiNoticeStore(strapi);
    const a = await account('d');
    const old = await store.createNotice(draft(a, ['x']), T1);
    const live = await store.createNotice(draft(a, ['y']), T1);
    await store.deliver(old, [a], T1);
    await store.endNotice(old, T1);
    const gone = await store.purgeEnded(T2);
    expect(gone.notices).toBeGreaterThanOrEqual(1);
    expect(await store.notice(old)).toBeNull();
    expect(await store.deliveries({ noticeId: old })).toEqual([]);
    expect((await store.liveNotices()).some((n) => n.id === live)).toBe(true);
  });
});
