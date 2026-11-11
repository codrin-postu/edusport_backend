import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import authController from '../../../api/portal/controllers/portal-auth';
import securityController from '../../../api/portal/controllers/portal-security';
import { loginWithPassword } from '../auth/login';
import { setup2fa } from './portal-2fa';

type Handlers = Record<string, (ctx: unknown) => Promise<void>>;
const BFF = 'a-test-secret-that-is-long-enough-123';
const saved = { on: process.env.PORTAL_2FA, bff: process.env.PORTAL_BFF_SECRET };

beforeEach(() => {
  process.env.PORTAL_2FA = 'off';
});
afterEach(() => {
  process.env.PORTAL_2FA = saved.on;
  if (saved.bff === undefined) delete process.env.PORTAL_BFF_SECRET;
  else process.env.PORTAL_BFF_SECRET = saved.bff;
});

describe('portal 2FA switched off (PORTAL_2FA unset or off)', () => {
  it('password sign-in of an account with TOTP stored gives a session, no pending step', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id, { backup: true });
    const r = await loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' });
    expect(r).toMatchObject({ ok: true, data: { accessToken: expect.any(String), refreshToken: expect.any(String), offerPasskey: false } });
    expect(r.ok && 'pending' in r.data).toBe(false);
    expect(s.fake.state.sessions).toHaveLength(1);
  });

  it('the host check still applies: a coach-only account is refused on sportiv', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const r = await loginWithPassword(s.c, { host: 'sportiv', email: 'ana@x.ro', password: 'right' });
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(s.fake.state.sessions).toHaveLength(0);
  });

  it('an unset setting is off as well', async () => {
    delete process.env.PORTAL_2FA;
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    expect(await loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right' })).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
  });

  it('the 2FA step and the passkey auth routes answer 404 (403 without the BFF secret still first)', async () => {
    process.env.PORTAL_BFF_SECRET = BFF;
    const h = authController as unknown as Handlers;
    for (const name of ['secondStep', 'sendCode', 'passkeyOptions', 'passkeyVerify']) {
      const open = { request: { headers: { 'x-portal-secret': BFF }, body: {} }, params: {}, status: 0, body: null as unknown };
      const closed = { request: { headers: {}, body: {} }, params: {}, status: 0, body: null as unknown };
      await h[name](closed);
      expect(closed.status, name).toBe(403);
      await h[name](open);
      expect(open.status, name).toBe(404);
    }
  });

  it('the enrol routes (2FA, backup codes, passkeys) answer 404; the overview and reauth still run their own checks', async () => {
    const h = securityController as unknown as Handlers;
    const names = ['totpStart', 'totpConfirm', 'totpOff', 'emailStart', 'emailConfirm', 'emailOff', 'backupCodes', 'passkeyStart', 'passkeyAdd', 'passkeyDismiss', 'passkeyRename', 'passkeyDelete'];
    for (const name of names) {
      const ctx = { request: { headers: {}, body: {} }, state: {}, params: { id: 'x' }, status: 0, body: null as unknown };
      await h[name](ctx);
      expect(ctx.status, name).toBe(404);
    }
    for (const name of ['security', 'reauth']) {
      const ctx = { request: { headers: {}, body: {} }, state: {}, params: {}, status: 0, body: null as unknown };
      await h[name](ctx);
      expect(ctx.status, name).toBe(401);
    }
  });

  it('with the setting on the same handlers run (401 without a caller, not 404)', async () => {
    process.env.PORTAL_2FA = 'on';
    const h = securityController as unknown as Handlers;
    const ctx = { request: { headers: {}, body: {} }, state: {}, params: {}, status: 0, body: null as unknown };
    await h.totpStart(ctx);
    expect(ctx.status).toBe(401);
  });
});
