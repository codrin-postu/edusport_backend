import { describe, expect, it } from 'vitest';
import { loginWithPassword } from '../auth/login';
import { portalSecondStep } from '../auth/two-factor';
import { listDevices } from '../coach/me';
import { REMEMBER_MS } from '../../security/remembered';
import { purgePortal } from '../purge';
import { setup2fa } from './portal-2fa';

type Env = ReturnType<typeof setup2fa>;
const login = (s: Env, body: Record<string, unknown> = {}) => loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right', ...body });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const pendingOf = (r: Awaited<ReturnType<typeof login>>) => {
  if (!r.ok || !('pending' in r.data)) throw new Error('no pending');
  return r.data;
};

describe('device row made at the password step is unconfirmed (M1)', () => {
  it('is hidden from the Dispozitive list until the second step completes, then listed', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = pendingOf(await login(s));
    expect((await s.store.devices(id))).toHaveLength(1);
    const coachCtx = { coach: { accountId: id, userId: 1, sessionId: 'x', teamMemberId: 'tm1', name: 'Ana' }, portal: s.store } as never;
    expect(await listDevices(coachCtx, pending.deviceKey)).toEqual({ ok: true, data: [] });
    const done = await portalSecondStep(s.c, { pending: pending.pending, method: 'totp', code: s.totp(), remember: false, deviceKey: pending.deviceKey });
    expect(done.ok).toBe(true);
    const listed = await listDevices(coachCtx, pending.deviceKey);
    expect(listed).toMatchObject({ ok: true, data: [{ current: true }] });
  });

  it('is never used to skip the second step, even with twoFactorUntil set on it', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    const pending = pendingOf(await login(s));
    const [row] = await s.store.devices(id);
    await s.secStore.setPortalDeviceTwoFactor(row.id, new Date(s.clock.t.getTime() + REMEMBER_MS).toISOString());
    expect(await login(s, { deviceKey: pending.deviceKey })).toMatchObject({ ok: true, data: { step: '2fa' } });
  });

  it('a login without 2FA confirms the device with the session', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    expect(await login(s)).toMatchObject({ ok: true, data: { accessToken: expect.any(String) } });
    const [row] = await s.store.devices(id);
    expect(row.confirmedAt).toBe(s.clock.t.toISOString());
  });

  it('is purged after a day by the purge job; a live confirmed device and a younger row stay', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    pendingOf(await login(s));
    s.advance(23 * 3600_000);
    await purgePortal(s.store, s.clock.t);
    expect(await s.store.devices(id)).toHaveLength(1);
    s.advance(2 * 3600_000);
    expect((await purgePortal(s.store, s.clock.t)).devices).toBe(1);
    expect(await s.store.devices(id)).toHaveLength(0);
  });

  it('at most one new-device mail per account per hour, the next hour mails again', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await s.enrol(id);
    for (let i = 0; i < 3; i += 1) {
      pendingOf(await login(s));
      await flush();
    }
    expect((await s.store.devices(id))).toHaveLength(3);
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(1);
    s.advance(3600_001);
    pendingOf(await login(s));
    await flush();
    expect(s.mails.filter((m) => m.mail.kind === 'new-device')).toHaveLength(2);
  });
});
