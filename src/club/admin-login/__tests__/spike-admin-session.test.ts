import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Spike (6b-1 T1): Strapi 5.52.1's real admin session manager and cookie helpers, with the defaults
 * `@strapi/admin` bootstrap passes (access 30 min, session idle 2 h / max 1 day, refresh idle 14 d / max 30 d).
 * Facts the admin login handoff (T10) relies on.
 */
type Row = Record<string, unknown> & { sessionId: string; createdAt: Date; expiresAt: Date; absoluteExpiresAt: Date };
type Issued = { token: string; sessionId: string; absoluteExpiresAt: string };
type Rotated = Partial<Issued> & { error?: string; type?: string };
type OriginSessions = {
  generateRefreshToken: (userId: string, deviceId: string, options?: { type: 'session' | 'refresh' }) => Promise<Issued>;
  generateAccessToken: (refreshToken: string) => Promise<{ token?: string; error?: string }>;
  rotateRefreshToken: (refreshToken: string) => Promise<Rotated>;
  validateAccessToken: (token: string) => { isValid: boolean; payload: { userId?: string; type?: string } | null };
  invalidateRefreshToken: (userId: string, deviceId?: string) => Promise<void>;
};
type Manager = ((origin: 'admin') => OriginSessions) & { defineOrigin: (origin: string, config: Record<string, unknown>) => void };
type CookieOptions = { httpOnly: boolean; sameSite: string; path: string; domain?: string; secure: boolean; expires?: Date; maxAge?: number; overwrite: boolean };
type SessionAuth = {
  REFRESH_COOKIE_NAME: string;
  DEFAULT_IDLE_SESSION_LIFESPAN: number;
  DEFAULT_MAX_SESSION_LIFESPAN: number;
  DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN: number;
  DEFAULT_MAX_REFRESH_TOKEN_LIFESPAN: number;
  buildCookieOptionsWithExpiry: (type: 'session' | 'refresh', absoluteExpiresAt: string, secureRequest: boolean) => CookieOptions;
};

const requireCjs = createRequire(__filename);
const coreDir = dirname(requireCjs.resolve('@strapi/core'));
const { createSessionManager } = requireCjs(join(coreDir, 'services', 'session-manager.js')) as {
  createSessionManager: (deps: { db: unknown }) => Manager;
};
const adminDist = join(dirname(requireCjs.resolve('@strapi/admin/package.json')), 'dist');
const sessionAuth = requireCjs(join(adminDist, 'server', 'shared', 'utils', 'session-auth.js')) as SessionAuth;

const DAY = 24 * 60 * 60;
const defaults = {
  accessTokenLifespan: 30 * 60,
  maxRefreshTokenLifespan: 30 * DAY,
  idleRefreshTokenLifespan: 14 * DAY,
  maxSessionLifespan: DAY,
  idleSessionLifespan: 2 * 60 * 60,
};

const equal = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => row[k] === v);

function memoryDb(rows: Row[]) {
  const table = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...data, createdAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    findOne: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => equal(r, where)) ?? null,
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      Object.assign(rows.find((r) => equal(r, where)) ?? {}, data);
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const i = rows.findIndex((r) => equal(r, where));
      if (i >= 0) rows.splice(i, 1);
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (Object.values(where).some((v) => typeof v === 'object')) return;
      for (let i = rows.length - 1; i >= 0; i -= 1) if (equal(rows[i], where)) rows.splice(i, 1);
    },
  };
  return { query: () => table };
}

function setup() {
  const rows: Row[] = [];
  const manager = createSessionManager({ db: memoryDb(rows) });
  manager.defineOrigin('admin', { jwtSecret: 'spike-secret', ...defaults });
  return { rows, admin: manager('admin') };
}

const seconds = (ms: number) => Math.round(ms / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T10:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('spike 1: issue and validate', () => {
  it('generateRefreshToken answers { token, sessionId, absoluteExpiresAt }; the access token validates with the user id', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    expect(Object.keys(issued).sort()).toEqual(['absoluteExpiresAt', 'sessionId', 'token']);
    expect(typeof issued.token).toBe('string');
    expect(typeof issued.absoluteExpiresAt).toBe('string');
    const access = await admin.generateAccessToken(issued.token);
    expect(typeof access.token).toBe('string');
    const checked = admin.validateAccessToken(access.token as string);
    expect(checked.isValid).toBe(true);
    expect(checked.payload?.userId).toBe('7');
    expect(checked.payload?.type).toBe('access');
  });

  it('the access token lives 30 minutes, then validateAccessToken is false', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'session' });
    const access = (await admin.generateAccessToken(issued.token)).token as string;
    vi.setSystemTime(Date.now() + 29 * 60 * 1000);
    expect(admin.validateAccessToken(access).isValid).toBe(true);
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    expect(admin.validateAccessToken(access).isValid).toBe(false);
  });
});

describe('spike 2: lifetimes', () => {
  it('type session: idle 2 hours, max 1 day', async () => {
    const { admin, rows } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'session' });
    const row = rows[0];
    expect(seconds(row.expiresAt.getTime() - row.createdAt.getTime())).toBe(2 * 60 * 60);
    expect(seconds(new Date(issued.absoluteExpiresAt).getTime() - row.createdAt.getTime())).toBe(DAY);
    expect(row.type).toBe('session');
  });

  it('type refresh: idle 14 days, max 30 days', async () => {
    const { admin, rows } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const row = rows[0];
    expect(seconds(row.expiresAt.getTime() - row.createdAt.getTime())).toBe(14 * DAY);
    expect(seconds(new Date(issued.absoluteExpiresAt).getTime() - row.createdAt.getTime())).toBe(30 * DAY);
    expect(row.type).toBe('refresh');
  });

  it('a session refresh token stops giving access tokens after the idle window; rotation after 2 hours is refused (the JWT exp trips first)', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'session' });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000 + 1000);
    expect((await admin.generateAccessToken(issued.token)).error).toBe('invalid_refresh_token');
    expect((await admin.rotateRefreshToken(issued.token)).error).toBe('invalid_refresh_token');
  });

  it('rotation keeps the family maximum: the child ends when the root would', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'session' });
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    const child = await admin.rotateRefreshToken(issued.token);
    expect(child.absoluteExpiresAt).toBe(issued.absoluteExpiresAt);
    vi.setSystemTime(new Date(issued.absoluteExpiresAt).getTime() + 1000);
    const again = await admin.rotateRefreshToken(child.token as string);
    expect(again.error).toBe('invalid_refresh_token');
  });
});

describe('spike 3: rotation', () => {
  it('rotateRefreshToken answers a new token with a new session id', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const child = await admin.rotateRefreshToken(issued.token);
    expect(child.error).toBeUndefined();
    expect(child.token).not.toBe(issued.token);
    expect(child.sessionId).not.toBe(issued.sessionId);
    expect(child.type).toBe('refresh');
  });

  it('the old token no longer gives access tokens after rotation', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    await admin.rotateRefreshToken(issued.token);
    expect((await admin.generateAccessToken(issued.token)).error).toBe('invalid_refresh_token');
  });

  it('a second rotation of the old token answers the same child (idempotent), not an error', async () => {
    const { admin } = setup();
    const issued = await admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const first = await admin.rotateRefreshToken(issued.token);
    const second = await admin.rotateRefreshToken(issued.token);
    // Observed: Strapi answers the same child again, so two tabs refreshing at once both succeed.
    expect(second.error).toBeUndefined();
    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe('spike 4: invalidation', () => {
  async function twoDevices() {
    const ctx = setup();
    const a = await ctx.admin.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const b = await ctx.admin.generateRefreshToken('7', 'dev-2', { type: 'refresh' });
    const other = await ctx.admin.generateRefreshToken('8', 'dev-1', { type: 'refresh' });
    return { ...ctx, a, b, other };
  }
  const works = async (admin: OriginSessions, token: string) => typeof (await admin.generateAccessToken(token)).token === 'string';

  it('invalidateRefreshToken(userId) ends every session of that admin only', async () => {
    const { admin, a, b, other } = await twoDevices();
    await admin.invalidateRefreshToken('7');
    expect(await works(admin, a.token)).toBe(false);
    expect(await works(admin, b.token)).toBe(false);
    expect(await works(admin, other.token)).toBe(true);
  });

  it('invalidateRefreshToken(userId, deviceId) ends only that device', async () => {
    const { admin, a, b, other } = await twoDevices();
    await admin.invalidateRefreshToken('7', 'dev-1');
    expect(await works(admin, a.token)).toBe(false);
    expect(await works(admin, b.token)).toBe(true);
    expect(await works(admin, other.token)).toBe(true);
  });
});

describe('spike 5: refresh cookie options', () => {
  const stubConfig = (values: Record<string, unknown> = {}) => {
    (globalThis as { strapi?: unknown }).strapi = {
      config: { get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback) },
      log: { warn: () => undefined },
    };
  };
  afterEach(() => {
    delete (globalThis as { strapi?: unknown }).strapi;
  });

  it('the cookie name is strapi_admin_refresh; Strapi\'s own constants are 2 h / 1 day / 14 d / 30 d', () => {
    // Boot spike: the live bootstrap falls back to admin.auth.options.expiresIn ('30d') for the session maximum, so a
    // `session` row got max 30 days unless admin.auth.sessions.maxSessionLifespan is set (idle 2 h and refresh 14 d / 30 d held).
    expect(sessionAuth.DEFAULT_IDLE_SESSION_LIFESPAN).toBe(2 * 60 * 60);
    expect(sessionAuth.DEFAULT_MAX_SESSION_LIFESPAN).toBe(DAY);
    expect(sessionAuth.DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN).toBe(14 * DAY);
    expect(sessionAuth.DEFAULT_MAX_REFRESH_TOKEN_LIFESPAN).toBe(30 * DAY);
    expect(sessionAuth.REFRESH_COOKIE_NAME).toBe('strapi_admin_refresh');
  });

  it('session cookie (not remembered): httpOnly, sameSite lax, path /admin, no domain, not secure here, no expiry', () => {
    stubConfig();
    const exp = new Date(Date.now() + DAY * 1000).toISOString();
    const options = sessionAuth.buildCookieOptionsWithExpiry('session', exp, false);
    expect(options).toEqual({
      httpOnly: true,
      secure: false,
      overwrite: true,
      domain: undefined,
      path: '/admin',
      sameSite: 'lax',
      maxAge: undefined,
    });
    expect(options.expires).toBeUndefined();
  });

  it('refresh cookie (remembered): same options plus expires = min(now + 14 d idle, absolute) and maxAge', () => {
    stubConfig();
    const exp = new Date(Date.now() + 30 * DAY * 1000).toISOString();
    const options = sessionAuth.buildCookieOptionsWithExpiry('refresh', exp, true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/admin');
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(false);
    expect(options.expires?.toISOString()).toBe(new Date(Date.now() + 14 * DAY * 1000).toISOString());
    expect(options.maxAge).toBe(14 * DAY * 1000);
  });

  it('refresh cookie never outlives the absolute expiry', () => {
    stubConfig();
    const exp = new Date(Date.now() + 3 * DAY * 1000).toISOString();
    expect(sessionAuth.buildCookieOptionsWithExpiry('refresh', exp, true).expires?.toISOString()).toBe(exp);
  });

  it('secure is true only in production on a secure request', () => {
    stubConfig();
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const exp = new Date(Date.now() + DAY * 1000).toISOString();
      expect(sessionAuth.buildCookieOptionsWithExpiry('session', exp, true).secure).toBe(true);
      expect(sessionAuth.buildCookieOptionsWithExpiry('session', exp, false).secure).toBe(false);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
