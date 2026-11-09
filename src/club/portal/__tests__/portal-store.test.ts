import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import type { PortalStore } from '../store';
import { strapiPortalStore, toAccountRow, toDeviceRow, toLimitRow, toSessionRow, toTokenRow } from '../strapi-store';
import { fakePortalStore } from './fake-portal-store';

const NOW = new Date('2026-11-06T10:00:00.000Z');
const HASH = '$2a$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('PortalStore cases (fake)', () => {
  const make = () => fakePortalStore({ now: () => NOW, teamMembers: { tm1: 'Virgil Ion' } });

  it('creates an account and reads it by e-mail (lower case), Google sub, team member and user', async () => {
    const { store } = make();
    const userId = await store.createUser('ana@example.com', HASH);
    const id = await store.createAccount({ userId, email: 'Ana@Example.com', status: 'invited', teamMemberId: 'tm1', googleSub: 'g-1' });
    const byId = await store.account(id);
    expect(byId).toMatchObject({ id, userId, email: 'ana@example.com', status: 'invited', teamMemberId: 'tm1', googleSub: 'g-1', phone: null });
    expect(await store.accountByEmail('ana@example.com')).toEqual(byId);
    expect(await store.accountByGoogleSub('g-1')).toEqual(byId);
    expect(await store.accountByTeamMember('tm1')).toEqual(byId);
    expect(await store.accountByUser(userId)).toEqual(byId);
    expect(await store.accountByEmail('nobody@example.com')).toBeNull();
  });

  it('updates an account', async () => {
    const { store } = make();
    const id = await store.createAccount({ userId: 1, email: 'a@b.ro', status: 'invited' });
    await store.updateAccount(id, { status: 'active', activatedAt: NOW.toISOString(), phone: '0722' });
    expect(await store.account(id)).toMatchObject({ status: 'active', activatedAt: NOW.toISOString(), phone: '0722' });
  });

  it('createUser stores the e-mail as username, local provider, Authenticated, unconfirmed, the hash verbatim', async () => {
    const { store, state } = make();
    const id = await store.createUser('ana@example.com', HASH);
    expect(state.users.find((u) => u.id === id)).toMatchObject({ username: 'ana@example.com', provider: 'local', role: 'authenticated', confirmed: false, passwordHash: HASH });
    await store.updateUser(id, { passwordHash: `${HASH}x`, confirmed: true, blocked: true });
    expect(await store.user(id)).toEqual({ id, email: 'ana@example.com', passwordHash: `${HASH}x`, blocked: true, confirmed: true });
    expect(await store.user(999)).toBeNull();
  });

  it('createUser accepts a null hash (an invited coach): hasPassword false until one is set', async () => {
    const { store } = make();
    const id = await store.createUser('nou@example.com', null);
    expect((await store.user(id))?.passwordHash).toBeNull();
  });

  it('reads a token by hash and lists by kind', async () => {
    const { store } = make();
    const t = await store.createToken({ accountId: 'acc1', kind: 'invite', secretHash: 'h1', expiresAt: '2026-11-13T10:00:00.000Z' });
    await store.createToken({ accountId: 'acc1', kind: 'reset', secretHash: 'h2', expiresAt: '2026-11-13T10:00:00.000Z' });
    expect(await store.tokenByHash('h1')).toMatchObject({ id: t, accountId: 'acc1', kind: 'invite', usedAt: null, tries: 0 });
    expect(await store.tokenByHash('nope')).toBeNull();
    expect((await store.tokens('acc1', 'reset')).map((x) => x.secretHash)).toEqual(['h2']);
    await store.updateToken(t, { usedAt: NOW.toISOString(), tries: 2 });
    expect(await store.tokenByHash('h1')).toMatchObject({ usedAt: NOW.toISOString(), tries: 2 });
  });

  it('reads a device by key and updates it', async () => {
    const { store } = make();
    const id = await store.createDevice({ accountId: 'acc1', deviceKeyHash: 'k1', sessionId: null, label: 'Android', firstSeenAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() });
    expect(await store.deviceByKey('acc1', 'k1')).toMatchObject({ id, label: 'Android', revokedAt: null });
    expect(await store.deviceByKey('acc2', 'k1')).toBeNull();
    await store.updateDevice(id, { revokedAt: NOW.toISOString(), sessionId: 's1' });
    expect((await store.devices('acc1'))[0]).toMatchObject({ revokedAt: NOW.toISOString(), sessionId: 's1' });
  });

  it('sessions: found by id and by access hash; active list skips revoked', async () => {
    const { store } = make();
    const base = { accountId: 'acc1', deviceId: 'd1', refreshHash: 'r1', accessHash: 'a1', accessExpiresAt: NOW.toISOString(), familyStartedAt: NOW.toISOString(), lastUsedAt: NOW.toISOString() };
    const id = await store.createSession(base);
    const other = await store.createSession({ ...base, refreshHash: 'r9', accessHash: 'a9' });
    await store.updateSession(id, { previousRefreshHash: 'r1', refreshHash: 'r2', accessHash: 'a2' });
    expect(await store.session(id)).toMatchObject({ id, refreshHash: 'r2', previousRefreshHash: 'r1' });
    expect((await store.sessionByAccess('a2'))?.id).toBe(id);
    expect(await store.sessionByAccess('a1')).toBeNull();
    await store.updateSession(other, { revokedAt: NOW.toISOString() });
    expect((await store.activeSessions('acc1')).map((s) => s.id)).toEqual([id]);
    expect(await store.session('missing')).toBeNull();
    await expect(store.lockSession(id)).rejects.toThrow('outside a transaction');
  });

  it('lockLimit creates once and returns the same id', async () => {
    const { store } = make();
    const [a, b] = await store.transaction(async () => [await store.lockLimit('login:a@b.ro'), await store.lockLimit('login:a@b.ro')]);
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ key: 'login:a@b.ro', count: 0, windowStart: NOW.toISOString(), lockedUntil: null });
    await store.saveLimit(a.id, { count: 3, windowStart: a.windowStart, lockedUntil: null, notifiedAt: null });
    expect((await store.transaction(() => store.lockLimit('login:a@b.ro'))).count).toBe(3);
  });

  it('a lock outside a transaction throws', async () => {
    await expect(make().store.lockLimit('k')).rejects.toThrow('outside a transaction');
    await expect(make().store.lockAccount('x')).rejects.toThrow('outside a transaction');
  });

  it('purgeLimits removes old windows that are not locked', async () => {
    const { store, state } = make();
    const old = '2026-11-01T10:00:00.000Z';
    const fresh = '2026-11-06T09:00:00.000Z';
    state.limits.push(
      { id: 'l1', key: 'old', count: 1, windowStart: old, lockedUntil: null, notifiedAt: null },
      { id: 'l2', key: 'old-locked', count: 5, windowStart: old, lockedUntil: '2026-11-06T10:30:00.000Z', notifiedAt: null },
      { id: 'l3', key: 'old-expired-lock', count: 5, windowStart: old, lockedUntil: '2026-11-06T09:30:00.000Z', notifiedAt: null },
      { id: 'l4', key: 'fresh', count: 1, windowStart: fresh, lockedUntil: null, notifiedAt: null },
    );
    expect(await store.purgeLimits(new Date('2026-11-05T10:00:00.000Z'), NOW)).toBe(2);
    expect(state.limits.map((l) => l.key)).toEqual(['old-locked', 'fresh']);
  });

  it('record writes the portal-account subject; teamMemberName reads the name', async () => {
    const { store, state } = make();
    await store.record({ subjectId: 'acc1', action: 'portal.invite', changes: { email: 'a@b.ro' }, actor: 'Ana' });
    expect(state.history).toEqual([{ subjectType: 'portal-account', subjectId: 'acc1', action: 'portal.invite', changes: { email: 'a@b.ro' }, actor: 'Ana' }]);
    expect(await store.teamMemberName('tm1')).toBe('Virgil Ion');
    expect(await store.teamMemberName('tm2')).toBeNull();
  });

  it('a failing transaction restores the rows', async () => {
    const { store, state } = make();
    await expect(store.transaction(async () => {
      await store.createAccount({ userId: 1, email: 'a@b.ro', status: 'invited' });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(state.accounts).toEqual([]);
  });

  it('failOn makes the next call of a method reject once', async () => {
    const { store, failOn } = make();
    failOn('account');
    await expect(store.account('x')).rejects.toThrow('fake failure in account');
    expect(await store.account('x')).toBeNull();
  });
});

type Call = { table: string; op: string; arg?: unknown };

function recordingStrapi(calls: Call[], opts: { rolePresent?: boolean } = {}): Core.Strapi {
  const knex = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const op of ['transacting', 'insert', 'onConflict', 'ignore', 'where', 'forUpdate']) {
      q[op] = (arg?: unknown) => {
        calls.push({ table, op, arg });
        return q;
      };
    }
    q.select = async () => [{ id: 1 }];
    q.first = async () => ({ document_id: 'lim-doc' });
    return q;
  };
  const query = (table: string) => ({
    create: async (a: unknown) => {
      calls.push({ table, op: 'create', arg: a });
      return { id: 42 };
    },
    update: async (a: unknown) => {
      calls.push({ table, op: 'update', arg: a });
    },
    findOne: async () => (opts.rolePresent === false ? null : { id: 3 }),
    deleteMany: async (a: unknown) => {
      calls.push({ table, op: 'deleteMany', arg: a });
      return { count: 2 };
    },
  });
  const documents = (table: string) => ({
    findOne: async () => ({ documentId: 'lim-doc', key: 'k', count: 0, windowStart: '2026-11-06T10:00:00.000Z', lockedUntil: null, notifiedAt: null }),
    create: async (a: unknown) => {
      calls.push({ table, op: 'doc-create', arg: a });
      return { documentId: 'new' };
    },
  });
  const db = { getConnection: knex, query, transaction: async (work: (a: { trx: string }) => Promise<unknown>) => work({ trx: 'trx' }) };
  return { db, documents } as unknown as Core.Strapi;
}

describe('strapiPortalStore', () => {
  it('has exactly the methods of the fake store', () => {
    expect(Object.keys(strapiPortalStore({} as Core.Strapi)).sort()).toEqual(Object.keys(fakePortalStore().store).sort());
  });

  it('maps rows', () => {
    expect(toAccountRow({
      documentId: 'a1', user: { id: 7 }, email: 'a@b.ro', status: 'active', teamMember: { documentId: 'tm1' }, phone: null, googleSub: 'g', invitedAt: new Date('2026-11-01T00:00:00Z'),
    })).toMatchObject({ id: 'a1', userId: 7, email: 'a@b.ro', status: 'active', teamMemberId: 'tm1', googleSub: 'g', invitedAt: '2026-11-01T00:00:00.000Z', lastLoginAt: null });
    expect(toLimitRow({ documentId: 'l1', key: 'k', count: null, windowStart: '2026-11-06T10:00:00.000Z' })).toMatchObject({ id: 'l1', count: 0, lockedUntil: null });
    expect(toTokenRow({ documentId: 't1', account: { documentId: 'a1' }, kind: 'reset', secretHash: 'h', expiresAt: 'x', tries: 1, createdAt: 'c' })).toMatchObject({ accountId: 'a1', kind: 'reset', tries: 1 });
    expect(toSessionRow({ documentId: 's1', account: { documentId: 'a1' }, deviceId: 'd', refreshHash: 'r', familyStartedAt: 'f', lastUsedAt: 'l' }))
      .toMatchObject({ id: 's1', accountId: 'a1', previousRefreshHash: null, accessHash: null, revokedAt: null });
    expect(toDeviceRow({ documentId: 'd1', account: { documentId: 'a1' }, deviceKeyHash: 'k', label: 'L', lastSeenAt: 'x' })).toMatchObject({ accountId: 'a1', sessionId: null, revokedAt: null });
  });

  it('lockLimit inserts with ON CONFLICT DO NOTHING inside the transaction, then locks the row', async () => {
    const calls: Call[] = [];
    const store = strapiPortalStore(recordingStrapi(calls));
    const row = await store.transaction(() => store.lockLimit('login:a@b.ro'));
    expect(row).toMatchObject({ id: 'lim-doc', count: 0 });
    const ops = calls.map((c) => `${c.table}:${c.op}`);
    expect(ops.slice(0, 4)).toEqual(['portal_auth_limits:transacting', 'portal_auth_limits:insert', 'portal_auth_limits:onConflict', 'portal_auth_limits:ignore']);
    expect(calls.find((c) => c.op === 'onConflict')?.arg).toBe('key');
    expect(ops).toContain('portal_auth_limits:forUpdate');
    await expect(strapiPortalStore(recordingStrapi([])).lockLimit('k')).rejects.toThrow('outside a transaction');
  });

  it('createUser writes the hash verbatim through the query engine with the Authenticated role', async () => {
    const calls: Call[] = [];
    const id = await strapiPortalStore(recordingStrapi(calls)).createUser('a@b.ro', HASH);
    expect(id).toBe(42);
    const data = (calls.find((c) => c.op === 'create')?.arg as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ username: 'a@b.ro', email: 'a@b.ro', password: HASH, provider: 'local', confirmed: false, role: 3 });
  });

  it('purgeLimits deletes old windows without an active lock', async () => {
    const calls: Call[] = [];
    const n = await strapiPortalStore(recordingStrapi(calls)).purgeLimits(new Date('2026-11-05T10:00:00.000Z'), NOW);
    expect(n).toBe(2);
    expect(calls[0].arg).toEqual({
      where: { windowStart: { $lt: '2026-11-05T10:00:00.000Z' }, $or: [{ lockedUntil: { $null: true } }, { lockedUntil: { $lte: NOW.toISOString() } }] },
    });
  });

  it('purgeDevices, purgeTokens and purgeSessions delete by the instants', async () => {
    const calls: Call[] = [];
    const store = strapiPortalStore(recordingStrapi(calls));
    const before = new Date('2026-10-07T10:00:00.000Z');
    expect(await store.purgeDevices(before)).toBe(2);
    expect(await store.purgeTokens(before)).toBe(2);
    expect(await store.purgeSessions(before)).toBe(2);
    expect(calls.slice(0, 3).map((c) => c.table)).toEqual(['api::portal-device.portal-device', 'api::portal-token.portal-token', 'api::portal-session.portal-session']);
    expect(calls[0].arg).toEqual({ where: { $or: [{ revokedAt: { $lt: '2026-10-07T10:00:00.000Z' } }] } });
    await store.purgeDevices(before, new Date('2026-11-06T10:00:00.000Z'));
    expect(calls[3].arg).toEqual({ where: { $or: [{ revokedAt: { $lt: '2026-10-07T10:00:00.000Z' } }, { confirmedAt: { $null: true }, sessionId: { $null: true }, firstSeenAt: { $lt: '2026-11-06T10:00:00.000Z' } }] } });
    expect(calls[1].arg).toEqual({ where: { $or: [{ usedAt: { $lt: '2026-10-07T10:00:00.000Z' } }, { expiresAt: { $lt: '2026-10-07T10:00:00.000Z' } }] } });
    expect(JSON.stringify(calls[2].arg)).toContain('"lastUsedAt":{"$lt":"2026-09-30T10:00:00.000Z"}');
  });

  it('record writes a history entry with subject portal-account', async () => {
    const calls: Call[] = [];
    await strapiPortalStore(recordingStrapi(calls)).record({ subjectId: 'acc1', action: 'portal.invite', changes: { a: 1 }, actor: 'Ana' });
    expect(calls[0]).toMatchObject({ table: 'api::history-entry.history-entry', op: 'doc-create' });
    expect((calls[0].arg as { data: unknown }).data).toMatchObject({ subjectType: 'portal-account', subjectId: 'acc1', action: 'portal.invite', actor: 'Ana' });
  });
});
