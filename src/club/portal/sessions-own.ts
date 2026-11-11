import { createHash, randomBytes } from 'node:crypto';
import type { PortalSessions } from './sessions';
import type { PortalStore, SessionRow } from './store';

const ACCESS_MS = 10 * 60 * 1000;
const IDLE_MS = 7 * 24 * 3600 * 1000;
const FAMILY_MS = 30 * 24 * 3600 * 1000;
export const GRACE_MS = 30 * 1000;
export const SESSION_IDLE_MS = IDLE_MS;
export const SESSION_FAMILY_MS = FAMILY_MS;
const TOKEN_BYTES = 32;

const newSecret = (): string => randomBytes(TOKEN_BYTES).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** A refresh token is `<sessionId>.<secret>`; only the hash of the secret is stored. */
const refreshTokenOf = (sessionId: string, secret: string): string => `${sessionId}.${secret}`;
function parseRefresh(token: string): { sessionId: string; hash: string } | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { sessionId: token.slice(0, dot), hash: hashToken(token.slice(dot + 1)) };
}

type Pair = { secret: string; refreshHash: string; accessToken: string; accessHash: string; accessExpiresAt: string };

function freshPair(now: Date): Pair {
  const secret = newSecret();
  const accessToken = newSecret();
  return { secret, refreshHash: hashToken(secret), accessToken, accessHash: hashToken(accessToken), accessExpiresAt: new Date(now.getTime() + ACCESS_MS).toISOString() };
}

const tokensOf = (p: Pair, sessionId: string) => ({ accessToken: p.accessToken, refreshToken: refreshTokenOf(sessionId, p.secret), accessExpiresAt: p.accessExpiresAt, sessionId });
const expired = (s: SessionRow, now: Date): boolean => now.getTime() - Date.parse(s.lastUsedAt) > IDLE_MS || now.getTime() - Date.parse(s.familyStartedAt) > FAMILY_MS;
const inGrace = (s: SessionRow, hash: string, now: Date): boolean => hash === s.previousRefreshHash && now.getTime() - Date.parse(s.lastUsedAt) < GRACE_MS;

export function ownSessions(store: PortalStore, now: () => Date): PortalSessions {
  const end = async (s: SessionRow): Promise<void> => {
    if (s.revokedAt === null) await store.updateSession(s.id, { revokedAt: now().toISOString(), accessHash: null, accessExpiresAt: null });
  };
  const mayUse = async (accountId: string): Promise<{ userId: number } | null> => {
    const account = await store.account(accountId);
    const user = account ? await store.user(account.userId) : null;
    return account && account.status === 'active' && user && !user.blocked ? { userId: account.userId } : null;
  };
  const endWhere = async (userId: number, keep: (s: SessionRow) => boolean): Promise<void> => {
    const account = await store.accountByUser(userId);
    if (!account) return;
    await store.transaction(async () => {
      await store.lockAccount(account.id);
      for (const s of await store.activeSessions(account.id)) if (!keep(s)) await end(s);
    });
  };

  const rotate = async (token: string) => {
    const parsed = parseRefresh(token);
    const found = parsed ? await store.session(parsed.sessionId) : null;
    if (!parsed || !found) return null;
    await store.lockSession(found.id);
    const row = await store.session(found.id);
    if (!row || row.revokedAt !== null) return null;
    if (row.refreshHash !== parsed.hash) {
      if (!inGrace(row, parsed.hash, now())) await end(row);
      return null;
    }
    const who = expired(row, now()) ? null : await mayUse(row.accountId);
    if (!who) {
      await end(row);
      return null;
    }
    const pair = freshPair(now());
    await store.updateSession(row.id, {
      previousRefreshHash: row.refreshHash, refreshHash: pair.refreshHash, accessHash: pair.accessHash, accessExpiresAt: pair.accessExpiresAt, lastUsedAt: now().toISOString(),
    });
    return { row, pair, userId: who.userId };
  };

  return {
    async issue(userId, deviceId, host) {
      const known = await store.accountByUser(userId);
      if (!known) throw new Error('no portal account for user');
      return store.transaction(async () => {
        await store.lockAccount(known.id);
        if (!(await mayUse(known.id))) throw new Error('portal account is not active');
        const pair = freshPair(now());
        const at = now().toISOString();
        const id = await store.createSession({
          accountId: known.id, deviceId, host, refreshHash: pair.refreshHash, accessHash: pair.accessHash, accessExpiresAt: pair.accessExpiresAt, familyStartedAt: at, lastUsedAt: at,
        });
        return tokensOf(pair, id);
      });
    },
    async refresh(refreshToken) {
      const done = await store.transaction(() => rotate(refreshToken));
      return done ? { ...tokensOf(done.pair, done.row.id), userId: done.userId, deviceId: done.row.deviceId, host: done.row.host } : null;
    },
    async verifyAccess(accessToken) {
      const row = await store.sessionByAccess(hashToken(accessToken));
      if (!row || row.revokedAt !== null || !row.accessExpiresAt || Date.parse(row.accessExpiresAt) <= now().getTime()) return null;
      const account = await store.account(row.accountId);
      return account ? { userId: account.userId, sessionId: row.id, host: row.host } : null;
    },
    async revoke(refreshToken) {
      const parsed = parseRefresh(refreshToken);
      const row = parsed ? await store.session(parsed.sessionId) : null;
      if (row && (row.refreshHash === parsed?.hash || row.previousRefreshHash === parsed?.hash)) await end(row);
    },
    revokeDevice: (userId, deviceId) => endWhere(userId, (s) => s.deviceId !== deviceId),
    revokeAll: (userId, exceptSessionId) => endWhere(userId, (s) => s.id === exceptSessionId),
    revokeAllOnHost: (userId, host) => endWhere(userId, (s) => s.host !== host),
  };
}
