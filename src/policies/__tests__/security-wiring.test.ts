import type { Core } from '@strapi/strapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import controller from '../../api/portal/controllers/portal-security';
import type { PortalAuthContext } from '../../club/portal/auth/context';
import { portalSessions } from '../../club/portal/sessions';
import { setup2fa } from '../../club/portal/__tests__/portal-2fa';
import { TEST_KEYS } from '../../club/security/__tests__/keys';
import { open, totpAad } from '../../club/security/secret-box';
import { totpAt } from '../../club/security/totp';
import isPortalUser from '../is-portal-user';
import { SECRET, stores } from './helpers';

let current: ReturnType<typeof setup2fa>;
vi.mock('../../club/portal/strapi-store', () => ({ strapiPortalStore: () => stores.portal }));
vi.mock('../../club/portal/access/strapi-store', () => ({ strapiAccessStore: () => stores.access }));
vi.mock('../../club/portal/auth/context', async (original) => ({
  ...(await original<typeof import('../../club/portal/auth/context')>()),
  portalAuthContext: (): PortalAuthContext => current.c,
}));

const strapi = {} as unknown as Core.Strapi;

beforeEach(() => {
  process.env.PORTAL_BFF_SECRET = SECRET;
  Object.assign(globalThis, { strapi: { log: { error: vi.fn() } } });
  current = setup2fa();
  stores.portal = current.store;
  stores.access = current.access.store;
});

type Ctx = { request: { header: Record<string, string>; headers: Record<string, string>; body: unknown }; state: Record<string, unknown>; params: Record<string, string>; status?: number; body?: unknown };
const request = (token: string, body: unknown = {}): Ctx => {
  const headers = { 'x-portal-secret': SECRET, authorization: `Bearer ${token}` };
  return { request: { header: headers, headers, body }, state: {}, params: {} };
};
const handlers = controller as unknown as Record<string, (ctx: Ctx) => Promise<void>>;

describe('Securitate: policy state to controller', () => {
  it('a holder on a sportiv session reads its methods and turns the app on; the history line names the account, not "Antrenor"', async () => {
    const s = current;
    const id = await s.addAccount({ teamMemberId: null, name: 'Maria Ionescu' });
    await s.access.store.createAccess({ athleteId: 'at1', accountId: id, email: 'ana@x.ro', invitedAt: s.clock.t.toISOString(), invitedBy: 'admin' });
    const token = (await portalSessions(s.store).issue(1, 'dev-1', 'sportiv')).accessToken;

    const read = request(token);
    expect(await isPortalUser(read as never, {}, { strapi })).toBe(true);
    await handlers.security(read);
    expect(read).toMatchObject({ body: { data: { email: 'ana@x.ro', totp: false } } });

    const start = request(token);
    await isPortalUser(start as never, {}, { strapi });
    await handlers.totpStart(start);
    const factor = (await s.secStore.factors({ type: 'portal', id }))[0];
    const plain = open(TEST_KEYS, factor.secretBox!, totpAad('portal', id))!.plain;
    const confirm = request(token, { code: totpAt(plain, Math.floor(s.clock.t.getTime() / 30_000)) });
    await isPortalUser(confirm as never, {}, { strapi });
    await handlers.totpConfirm(confirm);
    expect(confirm.body).toMatchObject({ data: { backupCodes: expect.any(Array) } });
    expect(s.mem.history.some((h) => h.actor === 'Maria Ionescu' && h.subjectId === id)).toBe(true);
    expect(s.mem.history.some((h) => h.actor.startsWith('Antrenor'))).toBe(false);
  });

  it('the same request without the policy having run is 401 and reads nothing', async () => {
    const s = current;
    await s.addAccount({ teamMemberId: null });
    const ctx = request('x');
    await handlers.security(ctx);
    expect(ctx.status).toBe(401);
  });
});
