import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminSessions } from '../../club/__tests__/admin-sessions';
import type { AdminUserStrapi } from '../../club/admin-auth';
import { portalSessions } from '../../club/portal/sessions';
import type { PortalStore } from '../../club/portal/store';
import { fakePortalStore } from '../../club/portal/__tests__/fake-portal-store';
import isAdmin from '../is-admin';
import isCoach from '../is-coach';

const holder = vi.hoisted(() => ({ store: null as unknown }));
vi.mock('../../club/portal/strapi-store', () => ({ strapiPortalStore: () => holder.store }));

const SECRET = 'test-bff-secret-000000000000000000';
const user = (id: number) => ({ id, email: `u${id}@x.ro`, passwordHash: 'h', blocked: false, confirmed: true, username: `u${id}`, provider: 'local', role: 'authenticated' });

async function setup() {
  const fake = fakePortalStore({ teamMembers: { tm1: 'Andreea Pascu' } });
  fake.state.users.push(user(1), user(2), user(3), user(4));
  const store: PortalStore = fake.store;
  await store.createAccount({ userId: 1, email: 'u1@x.ro', status: 'active', teamMemberId: 'tm1' });
  await store.createAccount({ userId: 2, email: 'u2@x.ro', status: 'active', teamMemberId: 'tm1' });
  await store.createAccount({ userId: 3, email: 'u3@x.ro', status: 'active', teamMemberId: null });
  await store.createAccount({ userId: 4, email: 'u4@x.ro', status: 'active', teamMemberId: 'tm1' });
  holder.store = store;
  const sessions = portalSessions(store);
  const login = async (userId: number) => (await sessions.issue(userId, `dev${userId}`, 'antrenor')).accessToken;
  return { fake, store, sessions, login };
}

const strapi = {} as unknown as Core.Strapi;
type Headers = Record<string, string | undefined>;
const call = (headers: Headers, state: Record<string, unknown> = {}) => isCoach({ request: { header: headers }, state }, {}, { strapi });
const withToken = (token: string): Headers => ({ 'x-portal-secret': SECRET, authorization: `Bearer ${token}` });

beforeEach(() => { process.env.PORTAL_BFF_SECRET = SECRET; });

describe('global::is-coach', () => {
  it('answers 403 without the BFF secret, before the token is looked at', async () => {
    const s = await setup();
    const token = await s.login(1);
    await expect(call({ authorization: `Bearer ${token}` })).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call({ 'x-portal-secret': 'nope', authorization: `Bearer ${token}` })).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('answers 401 without a token, with a malformed one and with an admin access token', async () => {
    await setup();
    await expect(call({ 'x-portal-secret': SECRET })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(call({ 'x-portal-secret': SECRET, authorization: 'Basic abc' })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    const admin = adminSessions('admin-secret');
    const { access } = await admin.login(7);
    await expect(call({ 'x-portal-secret': SECRET, authorization: access })).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('passes an active coach and sets the state with the team member name', async () => {
    const s = await setup();
    const token = await s.login(1);
    const state: Record<string, unknown> = {};
    expect(await call(withToken(token), state)).toBe(true);
    expect(state.coach).toMatchObject({ userId: 1, teamMemberId: 'tm1', name: 'Andreea Pascu' });
    expect(typeof (state.coach as { sessionId: string }).sessionId).toBe('string');
  });

  it('answers 403 for a disabled account, an account without a team member and a blocked user', async () => {
    const s = await setup();
    const tokens = await Promise.all([2, 3, 4].map(s.login));
    await s.store.updateAccount('acc2', { status: 'disabled' });
    await s.store.updateUser(4, { blocked: true });
    for (const token of tokens) await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('answers 403 when the account is disabled after the token was issued', async () => {
    const s = await setup();
    const token = await s.login(1);
    await call(withToken(token));
    await s.store.updateAccount('acc1', { status: 'disabled' });
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('answers 403 when the team member is gone', async () => {
    const s = await setup();
    const token = await s.login(1);
    delete s.fake.state.teamMembers.tm1;
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('answers 401 for a revoked session', async () => {
    const s = await setup();
    const token = await s.login(1);
    await s.sessions.revokeAll(1);
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('global::is-admin refuses a portal access token with 401', async () => {
    const s = await setup();
    const token = await s.login(1);
    const admin = adminSessions('admin-secret');
    const adminStrapi: AdminUserStrapi = { sessionManager: admin.sessionManager, db: { query: () => ({ findOne: async () => ({ id: 1, isActive: true, roles: [] }) }) } };
    await expect(isAdmin({ request: { header: { authorization: `Bearer ${token}` } } }, {}, { strapi: adminStrapi as unknown as Core.Strapi })).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });
});
