import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountContext } from '../../accounts/read';
import { harness, seedAccount, type Harness } from '../../accounts/__tests__/harness';
import accessController from '../../../../api/club/controllers/athlete-access';
import accountsController from '../../../../api/club/controllers/portal-accounts';
import accessRoutes from '../../../../api/club/routes/14-athlete-access';
import accountRoutes from '../../../../api/club/routes/12-portal-accounts';
import { dispatch } from './route-harness';
import type { AthleteForAccess } from '../types';

let current: Harness;
vi.mock('../../accounts/read', async (original) => ({
  ...(await original<typeof import('../../accounts/read')>()),
  accountContext: async (): Promise<AccountContext> => current.c,
}));

const ANA: AthleteForAccess = { id: 'ath1', name: 'Ana Ionescu', email: 'parinte1@example.invalid', status: 'activ', birthDate: '2015-04-03', contactName: 'Ioana Ionescu' };
const MATEI: AthleteForAccess = { ...ANA, id: 'ath2', name: 'Matei Ionescu', birthDate: '2013-01-09' };
const controllers = { 'athlete-access': accessController, 'portal-accounts': accountsController } as never;
const all = [...accessRoutes.routes, ...accountRoutes.routes];
const call = (method: string, url: string, body?: unknown) => dispatch(all, controllers, method, url, body);

beforeEach(() => {
  Object.assign(globalThis, { strapi: {} });
  current = harness();
  current.access.state.athletes.push(ANA, MATEI);
});

describe('athlete access routes through the controller', () => {
  it('GET access answers the AccessBlock of the contract', async () => {
    const r = await call('GET', '/club/athletes/ath1/access');
    expect(r).toMatchObject({ status: 200, handler: 'athlete-access.read', body: { data: { athleteId: 'ath1', state: 'none', email: 'parinte1@example.invalid', since: null, adult: false, canInvite: true, hint: null } } });
    expect((await call('GET', '/club/athletes/nope/access')).status).toBe(404);
  });
  it('invite, resend and remove answer { access, toast }; refusals use the error shape', async () => {
    const invited = await call('POST', '/club/athletes/ath1/access/invite', {});
    expect(invited.body).toMatchObject({ data: { toast: 'Invitație trimisă.', access: { state: 'invited' } } });
    expect((await call('POST', '/club/athletes/ath1/access/resend', {})).body).toMatchObject({ data: { toast: 'Invitație trimisă.' } });
    expect((await call('POST', '/club/athletes/ath1/access/remove', {})).body).toMatchObject({ data: { toast: 'Acces scos.', access: { state: 'none' } } });
    current.access.state.athletes.push({ ...ANA, id: 'ath3', email: null });
    expect(await call('POST', '/club/athletes/ath3/access/invite', {})).toMatchObject({ status: 400, body: { error: { message: 'Adaugă un e-mail în Date.' } } });
  });
  it('bulk-preview and bulk-invite are served by their own handlers, not captured by the :documentId routes', async () => {
    const r = await call('POST', '/club/athletes/access/bulk-preview', { ids: ['ath1', 'ath2'] });
    expect(r).toMatchObject({ status: 200, handler: 'athlete-access.bulkPreview', body: { data: { invites: 2, addresses: 1, skipped: [] } } });
    const sent = await call('POST', '/club/athletes/access/bulk-invite', { ids: ['ath1', 'ath2'] });
    expect(sent).toMatchObject({ status: 200, handler: 'athlete-access.bulkInvite', body: { data: { sent: 1, toast: '1 invitație trimisă.' } } });
  });
  it('a bad bulk body is 400 "Cerere invalidă."', async () => {
    for (const body of [{}, { ids: [] }, { ids: [1] }, { ids: Array.from({ length: 201 }, (_, i) => `x${i}`) }]) {
      expect(await call('POST', '/club/athletes/access/bulk-preview', body), JSON.stringify(body).slice(0, 30)).toMatchObject({ status: 400, body: { error: { message: 'Cerere invalidă.' } } });
      expect((await call('POST', '/club/athletes/access/bulk-invite', body)).status).toBe(400);
    }
    expect(current.jobs).toHaveLength(0);
  });
  it('disable-all answers the account block with the toast and ends both sides', async () => {
    const { id, userId } = await seedAccount(current, 'active');
    const r = await call('POST', `/club/portal-accounts/${id}/disable-all`, {});
    expect(r).toMatchObject({ status: 200, handler: 'portal-accounts.disableAll', body: { data: { toast: 'Cont dezactivat.', account: { state: 'disabled', accountId: id } } } });
    expect((await current.fake.store.user(userId))?.blocked).toBe(true);
    expect((await call('POST', '/club/portal-accounts/nope/disable-all', {})).status).toBe(404);
  });
  it('plain disable on a team member account that also holds an athlete keeps the sportiv side, as the account block says', async () => {
    const { id } = await seedAccount(current, 'active');
    await current.access.store.createAccess({ athleteId: 'ath1', accountId: id, email: 'andreea@example.com', invitedAt: '2026-11-06T10:00:00.000Z', invitedBy: 'x' });
    const r = await call('POST', `/club/portal-accounts/${id}/disable`, {});
    expect(r.body).toMatchObject({ data: { account: { state: 'active', coachDisabled: true, hasSportiv: true } } });
  });
});
