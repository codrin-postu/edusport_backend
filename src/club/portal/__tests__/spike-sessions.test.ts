import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Strapi 5.52.1 session manager with origin `users-permissions`, over an in-memory `admin::session` table. */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Rotated = { token?: string; sessionId?: string; absoluteExpiresAt?: string; type?: string; error?: string };
type OriginSessions = {
  generateRefreshToken: (userId: string, deviceId: string, options?: { type?: string; metadata?: Record<string, unknown> }) => Promise<{ token: string; sessionId: string; absoluteExpiresAt: string }>;
  generateAccessToken: (refreshToken: string) => Promise<{ token?: string; error?: string }>;
  rotateRefreshToken: (refreshToken: string) => Promise<Rotated>;
  validateAccessToken: (token: string) => { isValid: boolean; payload: { userId: string; sessionId: string; type: string } | null };
  validateRefreshToken: (token: string) => Promise<{ isValid: boolean; userId?: string; sessionId?: string }>;
  invalidateRefreshToken: (userId: string, deviceId?: string) => Promise<void>;
  listSessions: (userId: string) => Promise<Row[]>;
  revokeSessionById: (userId: string, sessionId: string) => Promise<boolean>;
  isSessionActive: (sessionId: string) => Promise<boolean>;
};
type Manager = ((origin: string) => OriginSessions) & { defineOrigin: (origin: string, config: Record<string, unknown>) => void };

const requireCjs = createRequire(__filename);
const sessionModule = join(dirname(requireCjs.resolve('@strapi/core')), 'services', 'session-manager.js');
const { createSessionManager } = requireCjs(sessionModule) as { createSessionManager: (deps: { db: unknown }) => Manager };

/** Unit of every session lifespan in the config and in the manager: seconds (manager multiplies by 1000; U&P DEFAULT_* constants are `n * 60` style). */
const LIFESPAN_UNIT_SECONDS = 1;
const DAY = 24 * 3600 * LIFESPAN_UNIT_SECONDS;
const sessions = { accessTokenLifespan: 600, idleRefreshTokenLifespan: 7 * DAY, maxRefreshTokenLifespan: 30 * DAY };
const START = new Date('2026-01-01T00:00:00.000Z');

const eq = (row: Row, where: Where) => Object.entries(where).every(([k, v]) => v === undefined || (typeof v !== 'object' && row[k] === v));

function memoryDb(rows: Row[]) {
  const remove = async ({ where }: { where: Where }) => { for (let i = rows.length - 1; i >= 0; i -= 1) if (eq(rows[i], where)) rows.splice(i, 1); };
  const table = {
    create: async ({ data }: { data: Row }) => { const row = { ...data, createdAt: new Date() }; rows.push(row); return row; },
    findOne: async ({ where }: { where: Where }) => rows.find((r) => eq(r, where)) ?? null,
    findMany: async ({ where }: { where: Where }) => rows.filter((r) => eq(r, where)).reverse(),
    update: async ({ where, data }: { where: Where; data: Row }) => { rows.filter((r) => eq(r, where)).forEach((r) => Object.assign(r, data)); },
    delete: remove,
    deleteMany: remove,
  };
  return { query: () => table };
}

let rows: Row[];
let up: OriginSessions;
const days = (n: number) => new Date(START.getTime() + n * DAY * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  rows = [];
  const manager = createSessionManager({ db: memoryDb(rows) });
  manager.defineOrigin('users-permissions', { jwtSecret: 'spike-secret-0000000000000000', ...sessions, maxSessionLifespan: DAY, idleSessionLifespan: 7200 });
  up = manager('users-permissions');
});
afterEach(() => vi.useRealTimers());

describe('U&P refresh sessions (spike)', () => {
  it('1: refresh then access token; validateAccessToken answers userId and sessionId; session active', async () => {
    const refresh = await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const access = await up.generateAccessToken(refresh.token);
    expect(access.token).toBeTruthy();
    const checked = up.validateAccessToken(access.token as string);
    expect(checked.isValid).toBe(true);
    expect(checked.payload).toMatchObject({ userId: '7', sessionId: refresh.sessionId });
    expect(await up.isSessionActive(refresh.sessionId)).toBe(true);
    expect(rows[0]).toMatchObject({ origin: 'users-permissions', userId: '7', deviceId: 'dev-1', status: 'active' });
  });

  it('3: idle window: 7 days and 1 second after last use answers an error; 6 days 23 hours rotates', async () => {
    const t1 = (await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' })).token;
    vi.setSystemTime(new Date(START.getTime() + (6 * DAY + 23 * 3600) * 1000));
    const ok = await up.rotateRefreshToken(t1);
    expect(ok.token).toBeTruthy();
    vi.setSystemTime(new Date(START.getTime() + (6 * DAY + 23 * 3600) * 1000 + (7 * DAY + 1) * 1000));
    expect((await up.rotateRefreshToken(ok.token as string)).error).toBeTruthy();
  });

  it('3b: idle error from a fresh token at 7 days and 1 second', async () => {
    const t1 = (await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' })).token;
    vi.setSystemTime(new Date(START.getTime() + (7 * DAY + 1) * 1000));
    expect((await up.rotateRefreshToken(t1)).error).toBeTruthy();
  });

  it('4: max window: rotating daily is refused once the 30 day family window is over (by day 31 at the latest)', async () => {
    let token = (await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' })).token;
    let firstError = 0;
    for (let day = 1; day <= 31 && !firstError; day += 1) {
      vi.setSystemTime(days(day));
      const next = await up.rotateRefreshToken(token);
      if (next.error) firstError = day; else token = next.token as string;
    }
    expect(firstError).toBeGreaterThan(0);
    expect(firstError).toBeLessThanOrEqual(31);
    expect(firstError).toBe(30);
  });

  it('5: revokeSessionById(userId, sessionId) ends one session and answers true; another session of the user still rotates', async () => {
    const a = await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const b = await up.generateRefreshToken('7', 'dev-2', { type: 'refresh' });
    expect(await up.revokeSessionById('7', a.sessionId)).toBe(true);
    expect((await up.rotateRefreshToken(a.token)).error).toBeTruthy();
    expect((await up.rotateRefreshToken(b.token)).token).toBeTruthy();
    expect(await up.revokeSessionById('8', b.sessionId)).toBe(false);
  });

  it('6: invalidateRefreshToken(userId) ends all sessions; with a deviceId only that device', async () => {
    const a = await up.generateRefreshToken('7', 'dev-1', { type: 'refresh' });
    const b = await up.generateRefreshToken('7', 'dev-2', { type: 'refresh' });
    await up.invalidateRefreshToken('7', 'dev-1');
    expect((await up.rotateRefreshToken(a.token)).error).toBeTruthy();
    expect((await up.rotateRefreshToken(b.token)).token).toBeTruthy();
    await up.invalidateRefreshToken('7');
    expect(rows.filter((r) => r.userId === '7')).toHaveLength(0);
  });

  it('7: listSessions(userId) lists active rows with sessionId, deviceId, createdAt, expiresAt, absoluteExpiresAt, metadata', async () => {
    await up.generateRefreshToken('7', 'dev-1', { type: 'refresh', metadata: { deviceName: 'Chrome' } });
    await up.generateRefreshToken('8', 'dev-9', { type: 'refresh' });
    const list = await up.listSessions('7');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ deviceId: 'dev-1', userId: '7', status: 'active', metadata: { deviceName: 'Chrome' } });
    expect(typeof list[0].sessionId).toBe('string');
    expect(list[0].createdAt).toBeInstanceOf(Date);
    expect(list[0].expiresAt).toBeInstanceOf(Date);
    expect(list[0].absoluteExpiresAt).toBeInstanceOf(Date);
  });

  it('8: sessionId CHANGES on rotation; parent row is "rotated"; listSessions shows only the latest; deviceId and metadata carry over; absoluteExpiresAt is kept', async () => {
    const first = await up.generateRefreshToken('7', 'dev-1', { type: 'refresh', metadata: { deviceName: 'Chrome' } });
    vi.setSystemTime(days(1));
    const next = await up.rotateRefreshToken(first.token);
    expect(next.sessionId).toBeTruthy();
    expect(next.sessionId).not.toBe(first.sessionId);
    expect(next.absoluteExpiresAt).toBe(first.absoluteExpiresAt);
    expect(rows.find((r) => r.sessionId === first.sessionId)).toMatchObject({ status: 'rotated', childId: next.sessionId });
    const list = await up.listSessions('7');
    expect(list.map((r) => r.sessionId)).toEqual([next.sessionId]);
    expect(list[0]).toMatchObject({ deviceId: 'dev-1', metadata: { deviceName: 'Chrome' } });
    // an access token minted from the old refresh token carries the old sessionId, still "active" until its row is deleted
    const access = await up.generateAccessToken(next.token as string);
    expect(up.validateAccessToken(access.token as string).payload?.sessionId).toBe(next.sessionId);
  });
});
