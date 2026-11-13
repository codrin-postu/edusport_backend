import { describe, expect, it } from 'vitest';
import controller from '../../../../api/club/controllers/portal-accounts';
import routes from '../../../../api/club/routes/12-portal-accounts';
import { SECURITY_ACTIONS, SECURITY_TOASTS, securityHistoryText } from '../../../security/copy';
import { hashSecret } from '../../tokens';
import { setup2fa } from '../../__tests__/portal-2fa';
import { PORTAL_ERRORS } from '../../copy';
import { resetPortalTwoFactor } from '../reset-2fa';
import { twoFactorOn } from '../read';

async function seeded() {
  const s = setup2fa();
  const id = await s.addAccount();
  await s.enrol(id, { backup: true });
  const tokens = await s.c.sessions.issue(1, 'dev-a', 'antrenor');
  const device = await s.store.createDevice({ accountId: id, deviceKeyHash: hashSecret('k'), sessionId: null, label: 'Telefon', firstSeenAt: s.clock.t.toISOString(), lastSeenAt: s.clock.t.toISOString() });
  await s.secStore.setPortalDeviceTwoFactor(device, new Date(s.clock.t.getTime() + 86_400_000).toISOString());
  await s.secStore.createPasskey({ subject: { type: 'portal', id }, credentialId: 'cred-1', publicKey: 'pk', counter: 0, transports: [], deviceType: 'multiDevice', backedUp: true, rpId: 'edusport.test', name: 'Telefon', createdAt: s.clock.t.toISOString() });
  const run = () => resetPortalTwoFactor({ store: s.store, security: s.c.security }, id, 'Eva Ionescu');
  return { ...s, id, device, tokens, run };
}

describe('Resetează 2FA on a portal account', () => {
  it('methods and codes gone, sessions revoked, devices forgotten, history line, mail to the coach, passkeys kept, twoFactor false after', async () => {
    const s = await seeded();
    expect(await twoFactorOn(s.secStore, s.id)).toBe(true);
    const out = await s.run();
    expect(out).toMatchObject({ ok: true, data: { toast: SECURITY_TOASTS.twoFactorReset, account: { accountId: s.id, twoFactor: false, email: 'ana@x.ro' } } });
    expect(await s.secStore.factors({ type: 'portal', id: s.id })).toEqual([]);
    expect(await s.secStore.unusedBackup({ type: 'portal', id: s.id })).toEqual([]);
    expect(await s.c.sessions.verifyAccess(s.tokens.accessToken)).toBeNull();
    expect((await s.store.devices(s.id))[0].twoFactorUntil).toBeNull();
    const line = s.mem.history.find((h) => h.action === SECURITY_ACTIONS.reset);
    expect(line).toMatchObject({ subjectType: 'portal', subjectId: s.id, actor: 'Eva Ionescu' });
    expect(securityHistoryText(line!.action, line!.changes)).toBe('2FA resetat de Eva Ionescu.');
    expect(s.secMails).toEqual([{ to: 'ana@x.ro', kind: 'reset2fa', data: {} }]);
    expect(await s.secStore.passkeys({ type: 'portal', id: s.id })).toHaveLength(1);
    expect(await twoFactorOn(s.secStore, s.id)).toBe(false);
  });

  it('works without keys (nothing here opens a secret) and for an account without 2FA', async () => {
    const s = setup2fa({ keys: null });
    const id = await s.addAccount();
    expect(await resetPortalTwoFactor({ store: s.store, security: s.c.security }, id, 'Eva')).toMatchObject({ ok: true });
  });

  it('an unexpected throw is logged with fixed text, answers 500 and changes nothing (one transaction)', async () => {
    const s = await seeded();
    s.c.security.endSessions = async () => { throw new Error('secret@x.ro boom'); };
    const out = await s.run();
    expect(out).toMatchObject({ ok: false, status: 500 });
    expect(s.logs.some((l) => l.startsWith('portal 2fa reset failed'))).toBe(true);
    expect(await s.secStore.factors({ type: 'portal', id: s.id })).toHaveLength(1);
    expect((await s.store.devices(s.id))[0].twoFactorUntil).not.toBeNull();
    expect(s.mem.history.find((h) => h.action === SECURITY_ACTIONS.reset)).toBeUndefined();
    expect(s.secMails).toEqual([]);
  });

  it('an unknown account is 404', async () => {
    const s = await seeded();
    expect(await resetPortalTwoFactor({ store: s.store, security: s.c.security }, 'nope', 'Eva')).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
  });

  it('the route is admin only and its handler exists', () => {
    const r = routes.routes.find((x) => x.path === '/club/portal-accounts/:documentId/reset-2fa');
    expect(r).toMatchObject({ method: 'POST', handler: 'portal-accounts.reset2fa', config: { auth: false, policies: [{ name: 'global::has-role', config: { area: 'coachAccounts' } }], middlewares: [] } });
    expect(typeof (controller as Record<string, unknown>).reset2fa).toBe('function');
  });
});
