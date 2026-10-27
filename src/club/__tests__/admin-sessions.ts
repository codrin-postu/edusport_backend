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

type RouteCtx = {
  request: { header: { authorization?: string } };
  response: { _explicitStatus: boolean };
  status: number;
  body: unknown;
  notFound: () => void;
};
type Middleware = (ctx: RouteCtx, next: () => Promise<void>) => Promise<void>;
type PolicyHandler = (context: never, config: never, deps: never) => Promise<boolean>;
type PolicyRoute = { config: { policies: string[] }; info: Record<string, never> };

const coreDir = dirname(requireCjs.resolve('@strapi/core'));
const { createPolicicesMiddleware } = requireCjs(join(coreDir, 'services', 'server', 'policy.js')) as {
  createPolicicesMiddleware: (route: PolicyRoute, strapi: unknown) => Middleware;
};
const { errors: errorMiddleware } = requireCjs(join(coreDir, 'middlewares', 'errors.js')) as { errors: () => Middleware };

/** Status and body a route guarded by `policy` answers, through Strapi 5.52.1's real policy and error middlewares. */
export async function routeAnswer(policy: PolicyHandler, authorization: string | undefined, strapi: object) {
  const withPolicy = { ...strapi, get: () => ({ resolve: () => [{ handler: policy, config: {} }] }) };
  const policies = createPolicicesMiddleware({ config: { policies: ['guard'] }, info: {} }, withPolicy);
  const ctx: RouteCtx = {
    request: { header: { authorization } },
    response: { _explicitStatus: false },
    status: 404,
    body: null,
    notFound: () => { ctx.status = 404; },
  };
  const handler = async () => { ctx.status = 200; ctx.response._explicitStatus = true; };
  await errorMiddleware()(ctx, () => policies(ctx, handler));
  return { status: ctx.status, body: ctx.body };
}
