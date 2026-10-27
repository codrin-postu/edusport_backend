import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { adminSessions, routeAnswer } from '../../club/__tests__/admin-sessions';
import { verifiedAdminId, type TokenStrapi } from '../../club/admin-actor';
import isAdmin from '../is-admin';

const SECRET = 'test-secret';
const config = { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) };
const sessions = adminSessions(SECRET);
const strapi: TokenStrapi = { config, sessionManager: sessions.sessionManager };
const statusOf = async (authorization: string | undefined) => (await routeAnswer(isAdmin, authorization, strapi)).status;
const UNAUTHORIZED = { data: null, error: { status: 401, name: 'UnauthorizedError', message: 'Missing or invalid credentials' } };

describe('global::is-admin: an access token of an active admin session, as Strapi checks it', () => {
  it('accepts a valid access token and reads the admin id as a number', async () => {
    const { access } = await sessions.login(7);
    expect(await statusOf(access)).toBe(200);
    expect(await isAdmin({ request: { header: { authorization: access } } }, {}, { strapi: strapi as unknown as Core.Strapi })).toBe(true);
    expect(await verifiedAdminId(access, strapi)).toBe(7);
  });

  it("answers 401 in Strapi's error shape, so the admin client refreshes the token and retries", async () => {
    const answer = await routeAnswer(isAdmin, undefined, strapi);
    expect(answer).toEqual({ status: 401, body: { ...UNAUTHORIZED, error: { ...UNAUTHORIZED.error, details: {} } } });
    const call = isAdmin({ request: { header: {} } }, {}, { strapi: strapi as unknown as Core.Strapi });
    await expect(call).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('answers 401 for an expired access token and for a refresh token', async () => {
    const { sessionId, refresh } = await sessions.login(7);
    const expired = jwt.sign({ userId: '7', sessionId, type: 'access', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    expect(await statusOf(`Bearer ${expired}`)).toBe(401);
    expect(await statusOf(refresh)).toBe(401);
  });

  it('answers 401 for the access token of a logged-out or expired session', async () => {
    const out = await sessions.login(8);
    await sessions.logout(8);
    expect(await statusOf(out.access)).toBe(401);
    const old = await sessions.login(9);
    sessions.expire(old.sessionId);
    expect(await statusOf(old.access)).toBe(401);
  });

  it('answers 401 for another scheme, a wrong signature and an unknown session', async () => {
    const { sessionId } = await sessions.login(7);
    expect(await statusOf(`Basic ${jwt.sign({ userId: '7', sessionId, type: 'access' }, SECRET)}`)).toBe(401);
    expect(await statusOf(`Bearer ${jwt.sign({ userId: '7', sessionId, type: 'access' }, 'other')}`)).toBe(401);
    expect(await statusOf(`Bearer ${jwt.sign({ userId: '7', sessionId: 'gone', type: 'access' }, SECRET)}`)).toBe(401);
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
