import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import isSportiv from '../is-sportiv';
import { portalWorld, SECRET, stores, withToken } from './helpers';

vi.mock('../../club/portal/strapi-store', () => ({ strapiPortalStore: () => stores.portal }));
vi.mock('../../club/portal/access/strapi-store', () => ({ strapiAccessStore: () => stores.access }));

const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const strapi = { log } as unknown as Core.Strapi;
const call = (headers: Record<string, string>, state: Record<string, unknown> = {}) => isSportiv({ request: { header: headers }, state }, {}, { strapi });

beforeEach(() => {
  process.env.PORTAL_BFF_SECRET = SECRET;
  Object.values(log).forEach((f) => f.mockClear());
});

describe('global::is-sportiv', () => {
  it('no secret or a wrong one is 403 before any store call; no bearer is 401', async () => {
    const w = await portalWorld();
    const token = await w.login(3, 'sportiv');
    const touched = vi.spyOn(w.store, 'accountByUser');
    await expect(call({ authorization: `Bearer ${token}` })).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call({ 'x-portal-secret': 'nope', authorization: `Bearer ${token}` })).rejects.toBeInstanceOf(errors.ForbiddenError);
    expect(touched).not.toHaveBeenCalled();
    await expect(call({ 'x-portal-secret': SECRET })).rejects.toBeInstanceOf(errors.UnauthorizedError);
    await expect(call(withToken('garbage'))).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('host of the session decides: a token of an antrenor session is 403, even for an account that holds athletes', async () => {
    const w = await portalWorld();
    await expect(call(withToken(await w.login(2, 'antrenor')))).rejects.toBeInstanceOf(errors.ForbiddenError);
    expect(await call(withToken(await w.login(2, 'sportiv')))).toBe(true);
  });

  it('sets the holder with the live athlete ids, sorted, and logs nothing with the session id', async () => {
    const w = await portalWorld();
    const state: Record<string, unknown> = {};
    expect(await call(withToken(await w.login(3, 'sportiv')), state)).toBe(true);
    expect(state.holder).toMatchObject({ userId: 3, accountId: w.acc.holder, athleteIds: ['at3', 'at4'] });
    const sessionId = (state.holder as { sessionId: string }).sessionId;
    expect(typeof sessionId).toBe('string');
    for (const f of Object.values(log)) expect(JSON.stringify(f.mock.calls)).not.toContain(sessionId);
  });

  it('an access revoked a moment ago closes the door on the next request', async () => {
    const w = await portalWorld();
    const token = await w.login(2, 'sportiv');
    expect(await call(withToken(token))).toBe(true);
    const row = (await w.access.store.liveByAccount(w.acc.both))[0];
    await w.access.store.revokeAccess(row.id, { revokedAt: '2026-11-11T11:00:00.000Z', revokedBy: 'admin', revokeReason: 'scos' });
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('an anonymized athlete is not counted: access to it alone is 403', async () => {
    const w = await portalWorld();
    await w.hold(w.acc.none, 'at2');
    await expect(call(withToken(await w.login(4, 'sportiv')))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('403 for a coach with no access, a disabled account and a blocked user', async () => {
    const w = await portalWorld();
    const coach = await w.login(1, 'sportiv');
    await expect(call(withToken(coach))).rejects.toBeInstanceOf(errors.ForbiddenError);
    const token = await w.login(3, 'sportiv');
    await w.store.updateUser(3, { blocked: true });
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
    await w.store.updateUser(3, { blocked: false });
    await w.store.updateAccount(w.acc.holder, { status: 'disabled' });
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });
});
