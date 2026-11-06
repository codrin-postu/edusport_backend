import { createHash, randomBytes } from 'node:crypto';
import type { PortalSessions } from './sessions';
import type { AccountRow, PortalStore, SessionRow } from './store';

const ACCESS_MS = 10 * 60 * 1000;
const IDLE_MS = 7 * 24 * 3600 * 1000;
const FAMILY_MS = 30 * 24 * 3600 * 1000;
const TOKEN_BYTES = 32;

const newToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

type Pair = { refreshToken: string; refreshHash: string; accessToken: string; accessHash: string; accessExpiresAt: string };

function freshPair(now: Date): Pair {
  const refreshToken = newToken();
  const accessToken = newToken();
  return { refreshToken, refreshHash: hashToken(refreshToken), accessToken, accessHash: hashToken(accessToken), accessExpiresAt: new Date(now.getTime() + ACCESS_MS).toISOString() };
}

const tokensOf = (p: Pair, sessionId: string) => ({ accessToken: p.accessToken, refreshToken: p.refreshToken, accessExpiresAt: p.accessExpiresAt, sessionId });
const expired = (s: SessionRow, now: Date): boolean => now.getTime() - Date.parse(s.lastUsedAt) > IDLE_MS || now.getTime() - Date.parse(s.familyStartedAt) > FAMILY_MS;

export function ownSessions(store: PortalStore, now: () => Date): PortalSessions {
  const accountOf = async (userId: number): Promise<AccountRow | null> => store.accountByUser(userId);
  const end = async (s: SessionRow): Promise<void> => {
    if (s.revokedAt === null) await store.updateSession(s.id, { revokedAt: now().toISOString(), accessHash: null, accessExpiresAt: null });
  };
  const endWhere = async (userId: number, keep: (s: SessionRow) => boolean): Promise<void> => {
    const account = await accountOf(userId);
    if (!account) return;
    await store.transaction(async () => {
      for (const s of await store.activeSessions(account.id)) if (!keep(s)) await end(s);
    });
  };

  const rotate = async (hash: string) => {
    const found = await store.sessionByRefresh(hash);
    if (!found) return null;
    await store.lockSession(found.id);
    const row = await store.session(found.id);
    if (!row || row.revokedAt !== null) return null;
    if (row.refreshHash !== hash) {
      await end(row);
      return null;
    }
    if (expired(row, now())) return null;
    const pair = freshPair(now());
    await store.updateSession(row.id, {
      previousRefreshHash: row.refreshHash, refreshHash: pair.refreshHash, accessHash: pair.accessHash, accessExpiresAt: pair.accessExpiresAt, lastUsedAt: now().toISOString(),
    });
    return { row, pair };
  };

  return {
    async issue(userId, deviceId) {
      const account = await accountOf(userId);
      if (!account) throw new Error('no portal account for user');
      const pair = freshPair(now());
      const at = now().toISOString();
      const id = await store.createSession({
        accountId: account.id, deviceId, refreshHash: pair.refreshHash, accessHash: pair.accessHash, accessExpiresAt: pair.accessExpiresAt, familyStartedAt: at, lastUsedAt: at,
      });
      return tokensOf(pair, id);
    },
    async refresh(refreshToken) {
      const done = await store.transaction(() => rotate(hashToken(refreshToken)));
      if (!done) return null;
      const account = await store.account(done.row.accountId);
      return account ? { ...tokensOf(done.pair, done.row.id), userId: account.userId, deviceId: done.row.deviceId } : null;
    },
    async verifyAccess(accessToken) {
      const row = await store.sessionByAccess(hashToken(accessToken));
      if (!row || row.revokedAt !== null || !row.accessExpiresAt || Date.parse(row.accessExpiresAt) <= now().getTime()) return null;
      const account = await store.account(row.accountId);
      return account ? { userId: account.userId, sessionId: row.id } : null;
    },
    async revoke(refreshToken) {
      const row = await store.sessionByRefresh(hashToken(refreshToken));
      if (row) await end(row);
    },
    revokeDevice: (userId, deviceId) => endWhere(userId, (s) => s.deviceId !== deviceId),
    revokeAll: (userId, exceptSessionId) => endWhere(userId, (s) => s.id === exceptSessionId),
  };
}
