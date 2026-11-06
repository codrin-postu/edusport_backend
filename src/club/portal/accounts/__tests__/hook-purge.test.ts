import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import cronTasks from '../../../../../config/cron-tasks';
import { purgePortal } from '../../purge';
import { ensurePortalIndexes, disableForTeamMembers, teamMemberHandlers } from '../team-member-hook';
import { harness, NOW, seedAccount } from './harness';

const DAY = 86_400_000;
const ago = (days: number, hours = 0): string => new Date(NOW.getTime() - days * DAY - hours * 3600_000).toISOString();

describe('team member delete hook', () => {
  it('disables an active account: sessions revoked, history line by "sistem"', async () => {
    const h = harness({ actor: 'sistem' });
    const { id } = await seedAccount(h, 'active');
    expect(await disableForTeamMembers(h.c, ['tm1', 'tm2'])).toBe(1);
    expect(h.fake.state.accounts[0]).toMatchObject({ id, status: 'disabled', disabledBy: 'sistem' });
    expect(h.fake.state.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(h.fake.state.history).toEqual([expect.objectContaining({ action: 'portal-disabled', actor: 'sistem' })]);
  });
  it('writes nothing for a team member without an account or an already disabled one', async () => {
    const h = harness({ actor: 'sistem' });
    expect(await disableForTeamMembers(h.c, ['tm2'])).toBe(0);
    await seedAccount(h, 'disabled');
    expect(await disableForTeamMembers(h.c, ['tm1'])).toBe(0);
    expect(h.fake.state.history).toHaveLength(0);
  });
  it('a failing disable throws, so the delete is refused', async () => {
    const h = harness({ actor: 'sistem' });
    await seedAccount(h, 'active');
    h.c.sessions = { ...h.c.sessions, revokeAll: async () => { throw new Error('x'); } };
    await expect(disableForTeamMembers(h.c, ['tm1'])).rejects.toThrow(/could not be disabled/);
    expect(h.fake.state.accounts[0].status).toBe('active');
  });
  it('the lifecycle handlers resolve the documentIds from the where and disable', async () => {
    const h = harness({ actor: 'sistem' });
    await seedAccount(h, 'active');
    const seen: unknown[] = [];
    const strapi = { db: { query: () => ({ findMany: async (a: { where: unknown }) => { seen.push(a.where); return [{ documentId: 'tm1' }]; } }) } } as unknown as Core.Strapi;
    const handlers = teamMemberHandlers(strapi, () => h.c);
    await handlers.beforeDelete({ params: { where: { id: 7 } } });
    expect(seen).toEqual([{ id: 7 }]);
    expect(h.fake.state.accounts[0].status).toBe('disabled');
    const h2 = harness();
    await seedAccount(h2, 'active');
    await teamMemberHandlers(strapi, () => h2.c).beforeDeleteMany({ params: { where: { id: { $in: [7] } } } });
    expect(h2.fake.state.accounts[0].status).toBe('disabled');
    await handlers.beforeDeleteMany({ params: {} });
  });
});

describe('unique link index', () => {
  const knexFake = (tables: string[], sql: string[]): Knex =>
    Object.assign((t: string) => t, { schema: { hasTable: async (t: string) => tables.includes(t) }, raw: async (q: string) => { sql.push(q); } }) as unknown as Knex;
  it('creates the unique index on the team member link, idempotently (if not exists), skipping a missing table', async () => {
    const sql: string[] = [];
    await ensurePortalIndexes(knexFake(['portal_accounts_team_member_lnk'], sql));
    await ensurePortalIndexes(knexFake(['portal_accounts_team_member_lnk'], sql));
    expect(sql).toEqual(Array(2).fill('create unique index if not exists "portal_accounts_team_member_lnk_team_member_uq" on "portal_accounts_team_member_lnk" ("team_member_id")'));
    const none: string[] = [];
    await ensurePortalIndexes(knexFake([], none));
    expect(none).toEqual([]);
  });
});

describe('purgePortal', () => {
  it('purge keeps a running lock, removes an unlocked row of 25 h ago, keeps one of 23 h ago', async () => {
    const h = harness();
    h.fake.state.limits.push(
      { id: 'old', key: 'k1', count: 1, windowStart: ago(0, 25), lockedUntil: null, notifiedAt: null },
      { id: 'recent', key: 'k2', count: 1, windowStart: ago(0, 23), lockedUntil: null, notifiedAt: null },
      { id: 'locked', key: 'k3', count: 5, windowStart: ago(0, 26), lockedUntil: new Date(NOW.getTime() + 600_000).toISOString(), notifiedAt: null },
    );
    const n = await purgePortal(h.fake.store, NOW);
    expect(n.limits).toBe(1);
    expect(h.fake.state.limits.map((l) => l.id)).toEqual(['recent', 'locked']);
  });
  it('purge keeps devices revoked 29 days ago, removes 31 days, keeps a live one', async () => {
    const h = harness();
    const dev = (key: string, revokedAt: string | null) => ({ accountId: 'a', deviceKeyHash: key, sessionId: null, label: 'L', firstSeenAt: ago(60), lastSeenAt: ago(60) });
    for (const [k, r] of [['d29', ago(29)], ['d31', ago(31)], ['live', null]] as const) {
      const id = await h.fake.store.createDevice(dev(k, r));
      if (r) await h.fake.store.updateDevice(id, { revokedAt: r });
    }
    expect((await purgePortal(h.fake.store, NOW)).devices).toBe(1);
    expect(h.fake.state.devices.map((d) => d.deviceKeyHash)).toEqual(['d29', 'live']);
  });
  it('purge removes sessions revoked or expired 31 days ago and keeps a live one and one ended 29 days ago', async () => {
    const h = harness();
    const base = { accountId: 'a', deviceId: 'd', host: 'antrenor', accessHash: null, accessExpiresAt: null };
    const row = (refreshHash: string, lastUsedAt: string, familyStartedAt: string, revokedAt: string | null) =>
      h.fake.state.sessions.push({ ...base, id: refreshHash, refreshHash, previousRefreshHash: null, lastUsedAt, familyStartedAt, revokedAt });
    row('live', ago(0), ago(1), null);
    row('revoked31', ago(40), ago(41), ago(31));
    row('revoked29', ago(30), ago(31), ago(29));
    row('idle31', ago(38), ago(39), null);
    row('idle29', ago(36), ago(37), null);
    row('family31', ago(0), ago(61), null);
    expect((await purgePortal(h.fake.store, NOW)).sessions).toBe(3);
    expect(h.fake.state.sessions.map((s) => s.id)).toEqual(['live', 'revoked29', 'idle29']);
  });
  it('tokens used 31 days ago are removed, an unused valid invite is kept', async () => {
    const h = harness();
    const future = new Date(NOW.getTime() + 7 * DAY).toISOString();
    await h.fake.store.createToken({ accountId: 'a', kind: 'invite', secretHash: 'valid', expiresAt: future });
    const used31 = await h.fake.store.createToken({ accountId: 'a', kind: 'invite', secretHash: 'used31', expiresAt: future });
    await h.fake.store.updateToken(used31, { usedAt: ago(31) });
    const used5 = await h.fake.store.createToken({ accountId: 'a', kind: 'reset', secretHash: 'used5', expiresAt: future });
    await h.fake.store.updateToken(used5, { usedAt: ago(5) });
    await h.fake.store.createToken({ accountId: 'a', kind: 'reset', secretHash: 'expired31', expiresAt: ago(31) });
    expect((await purgePortal(h.fake.store, NOW)).tokens).toBe(2);
    expect(h.fake.state.tokens.map((t) => t.secretHash)).toEqual(['valid', 'used5']);
  });
});

describe('portalPurge cron', () => {
  it('runs daily at 03:30 Bucharest', () => {
    expect(cronTasks.portalPurge.options).toEqual({ hour: 3, minute: 30, tz: 'Europe/Bucharest' });
    expect(typeof cronTasks.portalPurge.task).toBe('function');
  });
});
