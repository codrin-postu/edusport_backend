import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { TokenStrapi } from '../admin-actor';

/** Strapi 5.52.1's real admin session manager (not exported by @strapi/core), over an in-memory `admin::session` table. */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type OriginSessions = {
  generateRefreshToken: (userId: string, deviceId: string) => Promise<{ token: string; sessionId: string }>;
  generateAccessToken: (refreshToken: string) => Promise<{ token?: string }>;
  invalidateRefreshToken: (userId: string) => Promise<void>;
};
type Manager = ((origin: 'admin') => OriginSessions) & {
  defineOrigin: (origin: string, config: Record<string, unknown>) => void;
};

const requireCjs = createRequire(__filename);
const sessionModule = join(dirname(requireCjs.resolve('@strapi/core')), 'services', 'session-manager.js');
const { createSessionManager } = requireCjs(sessionModule) as { createSessionManager: (deps: { db: unknown }) => Manager };

/** Plain equality only: Strapi's periodic `deleteExpired` (`$lt`) matches nothing here. */
const matches = (row: Row, where: Where) => Object.entries(where).every(([k, v]) => (v === null || typeof v !== 'object') && row[k] === v);

function memoryDb(rows: Row[]) {
  const remove = async ({ where }: { where: Where }) => {
    for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], where)) rows.splice(i, 1);
  };
  const table = {
    create: async ({ data }: { data: Row }) => { const row = { ...data, createdAt: new Date() }; rows.push(row); return row; },
    findOne: async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null,
    delete: remove,
    deleteMany: remove,
  };
  return { query: () => table };
}

export function adminSessions(secret: string) {
  const rows: Row[] = [];
  const manager = createSessionManager({ db: memoryDb(rows) });
  const lifespan = { accessTokenLifespan: 1800, maxRefreshTokenLifespan: 3600, idleRefreshTokenLifespan: 3600, maxSessionLifespan: 3600, idleSessionLifespan: 3600 };
  manager.defineOrigin('admin', { jwtSecret: secret, ...lifespan });
  const login = async (userId: number) => {
    const refresh = await manager('admin').generateRefreshToken(String(userId), 'device-1');
    const access = await manager('admin').generateAccessToken(refresh.token);
    return { refresh: `Bearer ${refresh.token}`, access: `Bearer ${access.token}`, sessionId: refresh.sessionId };
  };
  const logout = (userId: number) => manager('admin').invalidateRefreshToken(String(userId));
  const expire = (sessionId: string) => rows.filter((r) => r.sessionId === sessionId).forEach((r) => { r.expiresAt = new Date(0); });
  return { sessionManager: manager as unknown as TokenStrapi['sessionManager'], login, logout, expire };
}
