import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import isPortalUser from '../is-portal-user';
import { portalWorld, SECRET, stores, withToken } from './helpers';

vi.mock('../../club/portal/strapi-store', () => ({ strapiPortalStore: () => stores.portal }));
vi.mock('../../club/portal/access/strapi-store', () => ({ strapiAccessStore: () => stores.access }));

const strapi = {} as unknown as Core.Strapi;
const call = (headers: Record<string, string>, state: Record<string, unknown> = {}) => isPortalUser({ request: { header: headers }, state }, {}, { strapi });

beforeEach(() => { process.env.PORTAL_BFF_SECRET = SECRET; });

describe('global::is-portal-user', () => {
  it('passes a live session of either host and names the host and the history actor', async () => {
    const w = await portalWorld();
    const coach: Record<string, unknown> = {};
    expect(await call(withToken(await w.login(2, 'antrenor')), coach)).toBe(true);
    expect(coach.portalUser).toMatchObject({ accountId: w.acc.both, userId: 2, host: 'antrenor', actor: 'Antrenor Andreea Pascu' });
    const holder: Record<string, unknown> = {};
    expect(await call(withToken(await w.login(2, 'sportiv')), holder)).toBe(true);
    expect(holder.portalUser).toMatchObject({ host: 'sportiv', actor: 'Dana Pop' });
    const unnamed: Record<string, unknown> = {};
    await w.hold(w.acc.none, 'at5');
    expect(await call(withToken(await w.login(4, 'sportiv')), unnamed)).toBe(true);
    expect(unnamed.portalUser).toMatchObject({ actor: 'u4@example.invalid' });
  });

  it('403 without the secret, 401 without a session', async () => {
    const w = await portalWorld();
    const token = await w.login(1, 'antrenor');
    await expect(call({ authorization: `Bearer ${token}` })).rejects.toBeInstanceOf(errors.ForbiddenError);
    await expect(call({ 'x-portal-secret': SECRET })).rejects.toBeInstanceOf(errors.UnauthorizedError);
  });

  it('a sportiv session of an account with no live access left is 403', async () => {
    const w = await portalWorld();
    const token = await w.login(2, 'sportiv');
    const row = (await w.access.store.liveByAccount(w.acc.both))[0];
    await w.access.store.revokeAccess(row.id, { revokedAt: '2026-11-11T11:00:00.000Z', revokedBy: 'admin', revokeReason: 'scos' });
    await expect(call(withToken(token))).rejects.toBeInstanceOf(errors.ForbiddenError);
  });

  it('an antrenor session of an account whose coach side was switched off is 403, its sportiv session still passes', async () => {
    const w = await portalWorld();
    const coachToken = await w.login(2, 'antrenor');
    const holderToken = await w.login(2, 'sportiv');
    await w.store.updateAccount(w.acc.both, { coachDisabledAt: '2026-11-11T11:00:00.000Z' });
    await expect(call(withToken(coachToken))).rejects.toBeInstanceOf(errors.ForbiddenError);
    expect(await call(withToken(holderToken))).toBe(true);
  });
});
