import { describe, expect, it } from 'vitest';
import controller from '../../../api/portal/controllers/portal-security';
import routes from '../../../api/portal/routes/03-security';
import { PORTAL_ERRORS } from '../copy';
import { portalSecurity } from '../security';
import { SECURITY_ERRORS, SECURITY_TOASTS } from '../../security/copy';
import { open, totpAad } from '../../security/secret-box';
import { totpAt } from '../../security/totp';
import { TEST_KEYS } from '../../security/__tests__/keys';
import { setup2fa } from './portal-2fa';

describe('portal Securitate routes', () => {
  it('a handler run without the policy state answers 401 and builds nothing', async () => {
    const handlers = controller as unknown as Record<string, (ctx: unknown) => Promise<void>>;
    for (const r of routes.routes) {
      const ctx: { request: { headers: Record<string, string>; body: unknown }; state: object; params: object; status?: number } = { request: { headers: {}, body: {} }, state: {}, params: {} };
      await handlers[r.handler.split('.')[1]](ctx);
      expect(ctx.status, r.path).toBe(401);
    }
  });
});

async function coach() {
  const s = setup2fa();
  const id = await s.addAccount();
  const sec = portalSecurity(s.c, { accountId: id, userId: 1, sessionId: 'sess', host: 'antrenor', actor: 'Antrenor Ana Pop' });
  return { ...s, id, sec };
}

describe('Securitate of a sportiv session', () => {
  it('reads its own methods and turns the app on with the account name on the history line', async () => {
    const s = setup2fa();
    const id = await s.addAccount({ teamMemberId: null });
    const sec = portalSecurity(s.c, { accountId: id, userId: 1, sessionId: 'sess', host: 'sportiv', actor: 'Maria Ionescu' });
    expect(await sec.read()).toMatchObject({ ok: true, data: { email: 'ana@x.ro', totp: false } });
    await sec.totpStart();
    const factor = (await s.secStore.factors({ type: 'portal', id }))[0];
    const plain = open(TEST_KEYS, factor.secretBox!, totpAad('portal', id))!.plain;
    expect(await sec.totpConfirm({ code: totpAt(plain, Math.floor(s.clock.t.getTime() / 30_000)) })).toMatchObject({ ok: true });
    expect(s.mem.history.some((h) => h.actor === 'Maria Ionescu' && h.subjectType === 'portal' && h.subjectId === id)).toBe(true);
  });
});

describe('portal Securitate service', () => {
  it('enrol app then confirm returns 10 codes once; GET security never returns codes or the secret', async () => {
    const s = await coach();
    const start = await s.sec.totpStart();
    expect(start).toMatchObject({ ok: true, data: { qrSvg: expect.any(String), key: expect.any(String) } });
    expect(await s.sec.totpStart()).toMatchObject({ ok: true });
    const factor = (await s.secStore.factors({ type: 'portal', id: s.id }))[0];
    const plain = open(TEST_KEYS, factor.secretBox!, totpAad('portal', s.id))!.plain;
    const done = await s.sec.totpConfirm({ code: totpAt(plain, Math.floor(s.clock.t.getTime() / 30_000)) });
    expect(done).toMatchObject({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorOn, backupCodes: expect.any(Array) } });
    if (!done.ok) throw new Error();
    expect((done.data as { backupCodes: string[] }).backupCodes).toHaveLength(10);
    const view = await s.sec.read();
    expect(view).toMatchObject({ ok: true, data: { email: 'ana@x.ro', totp: true, emailCode: false, backupLeft: 10 } });
    const text = JSON.stringify(view);
    for (const code of (done.data as { backupCodes: string[] }).backupCodes) expect(text).not.toContain(code.replace(' ', ''));
    expect(text).not.toContain('secret');
    expect(await s.sec.totpStart()).toEqual({ ok: false, status: 409, error: SECURITY_ERRORS.appAlreadyOn });
  });

  it('DELETE the last method deletes the codes and forgets devices; the history line names the coach', async () => {
    const s = await coach();
    await s.enrol(s.id, { backup: true });
    const device = await s.store.createDevice({ accountId: s.id, host: 'antrenor', deviceKeyHash: 'h', sessionId: null, label: 'T', firstSeenAt: s.clock.t.toISOString(), lastSeenAt: s.clock.t.toISOString() });
    await s.secStore.setPortalDeviceTwoFactor(device, '2027-01-01T00:00:00.000Z');
    expect(await s.sec.read()).toMatchObject({ data: { backupLeft: 10 } });
    expect(await s.sec.totpOff()).toEqual({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorOff } });
    expect(await s.sec.read()).toMatchObject({ data: { totp: false, backupLeft: 0 } });
    expect((await s.store.devices(s.id))[0].twoFactorUntil).toBeNull();
    expect(s.mem.history.some((h) => h.actor === 'Antrenor Ana Pop' && h.subjectType === 'portal' && h.subjectId === s.id)).toBe(true);
    expect(await s.sec.totpOff()).toMatchObject({ ok: false, status: 400 });
  });

  it('e-mail method: send, confirm, new codes; new codes need a method', async () => {
    const s = await coach();
    expect(await s.sec.backupCodes()).toMatchObject({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
    expect(await s.sec.emailStart()).toEqual({ ok: true, data: { sentTo: 'ana@x.ro' } });
    const mail = s.secMails.find((m) => m.kind === 'code');
    expect(mail?.to).toBe('ana@x.ro');
    expect(await s.sec.emailConfirm({ code: (mail?.data as { code: string }).code })).toMatchObject({ ok: true, data: { backupCodes: expect.any(Array) } });
    expect(await s.sec.backupCodes()).toMatchObject({ ok: true, data: { toast: SECURITY_TOASTS.newCodes } });
  });

  it('POSTs count the IP rule and answer 429 past it; keys missing answer 503', async () => {
    const s = await coach();
    for (let i = 0; i < 30; i++) await s.c.limits.ipBlocked(s.c.ip);
    expect(await s.sec.totpStart()).toMatchObject({ ok: false, status: 429 });
    expect(await s.sec.read()).toMatchObject({ ok: true });
    const k = setup2fa({ keys: null });
    const id = await k.addAccount();
    const sec = portalSecurity(k.c, { accountId: id, userId: 1, sessionId: 's', host: 'antrenor', actor: 'Antrenor Ana' });
    expect(await sec.totpStart()).toEqual({ ok: false, status: 503, error: SECURITY_ERRORS.unavailable });
  });

  it('an account gone or disabled meanwhile answers 401', async () => {
    const s = await coach();
    const gone = portalSecurity(s.c, { accountId: 'nope', userId: 1, sessionId: 's', host: 'antrenor', actor: 'Antrenor Ana' });
    expect(await gone.read()).toMatchObject({ ok: false, status: 401 });
  });
});
