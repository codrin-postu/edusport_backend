import type { Core } from '@strapi/strapi';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { adminSessions } from '../../club/__tests__/admin-sessions';
import { verifiedAdminId, type TokenStrapi } from '../../club/admin-actor';
import isAdmin from '../is-admin';

const SECRET = 'test-secret';
const config = { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) };
const sessions = adminSessions(SECRET);
const strapi: TokenStrapi = { config, sessionManager: sessions.sessionManager };
const allowed = (authorization: string | undefined) =>
  isAdmin({ request: { header: { authorization } } }, {}, { strapi: strapi as unknown as Core.Strapi });

describe('global::is-admin: an access token of an active admin session, as Strapi checks it', () => {
  it('accepts a valid access token and reads the admin id as a number', async () => {
    const { access } = await sessions.login(7);
    expect(await allowed(access)).toBe(true);
    expect(await verifiedAdminId(access, strapi)).toBe(7);
  });

  it('refuses a refresh token', async () => {
    expect(await allowed((await sessions.login(7)).refresh)).toBe(false);
  });

  it('refuses the access token of a logged-out or expired session', async () => {
    const out = await sessions.login(8);
    await sessions.logout(8);
    expect(await allowed(out.access)).toBe(false);
    const old = await sessions.login(9);
    sessions.expire(old.sessionId);
    expect(await allowed(old.access)).toBe(false);
  });

  it('refuses no header, another scheme, a wrong signature and an unknown session', async () => {
    const { sessionId } = await sessions.login(7);
    expect(await allowed(undefined)).toBe(false);
    expect(await allowed(`Basic ${jwt.sign({ userId: '7', sessionId, type: 'access' }, SECRET)}`)).toBe(false);
    expect(await allowed(`Bearer ${jwt.sign({ userId: '7', sessionId, type: 'access' }, 'other')}`)).toBe(false);
    expect(await allowed(`Bearer ${jwt.sign({ userId: '7', sessionId: 'gone', type: 'access' }, SECRET)}`)).toBe(false);
  });
});

describe('verifiedAdminId without a session manager (fallback)', () => {
  const bare: TokenStrapi = { config };
  const bearer = (payload: object, options: jwt.SignOptions = {}) => `Bearer ${jwt.sign(payload, SECRET, options)}`;

  it('accepts only an HS256 access token with a scalar userId', async () => {
    expect(await verifiedAdminId(bearer({ userId: '3', sessionId: 's', type: 'access' }), bare)).toBe(3);
    expect(await verifiedAdminId(bearer({ userId: '3', sessionId: 's', type: 'refresh' }), bare)).toBeNull();
    expect(await verifiedAdminId(bearer({ userId: '3' }), bare)).toBeNull();
    expect(await verifiedAdminId(bearer({ id: 3, type: 'access' }), bare)).toBeNull();
    expect(await verifiedAdminId(bearer({ userId: { $ne: null }, type: 'access' }), bare)).toBeNull();
    expect(await verifiedAdminId(bearer({ userId: '3', type: 'access' }, { algorithm: 'HS512' }), bare)).toBeNull();
  });
});
