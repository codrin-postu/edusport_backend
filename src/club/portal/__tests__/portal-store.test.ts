import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import { strapiPortalStore, toAccountRow, toDeviceRow, toLimitRow, toSessionRow, toTokenRow } from '../strapi-store';

const NOW = new Date('2026-11-06T10:00:00.000Z');
const HASH = '$2a$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345';

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
