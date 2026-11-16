import { describe, expect, it, vi } from 'vitest';
import { loginWithPassword } from '../auth/login';
import { listDevicesFor } from '../me-shared';
import { hashSecret } from '../tokens';
import { setup2fa } from './portal-2fa';

const DAY = 24 * 3600_000;
type Env = ReturnType<typeof setup2fa>;
const login = async (s: Env, deviceKey: string | null = null) => {
  const r = await loginWithPassword(s.c, { host: 'antrenor', email: 'ana@x.ro', password: 'right', deviceKey });
  if (!r.ok || !('deviceKey' in r.data)) throw new Error('no session');
  await new Promise((resolve) => setTimeout(resolve, 0));
  return r.data;
};
const mailCount = (s: Env) => s.mails.filter((m) => m.mail.kind === 'new-device').length;
const ended = (s: Env, id: string, o: { host?: string; label?: string; key?: string; seenAgo?: number } = {}) =>
  s.store.createDevice({
    accountId: id, host: o.host ?? 'antrenor', deviceKeyHash: hashSecret(o.key ?? 'old-key'), sessionId: null, label: o.label ?? 'Calculator, Browser',
    firstSeenAt: new Date(s.clock.t.getTime() - 90 * DAY).toISOString(), lastSeenAt: new Date(s.clock.t.getTime() - (o.seenAgo ?? 40) * DAY).toISOString(),
  });

describe('portal device life', () => {
  it('a stale cookie row is ended and replaced by a fresh key on the same row, its sessions revoked first', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const first = await login(s);
    const [before] = await s.store.devices(id);
    s.advance(31 * DAY);
    const revoke = vi.spyOn(s.c.sessions, 'revokeDevice');
    const again = await login(s, first.deviceKey);
    expect(revoke).toHaveBeenCalledWith(1, before.id);
    expect(again.deviceKey).not.toBeNull();
    expect(again.deviceKey).not.toBe(first.deviceKey);
    const rows = await s.store.devices(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before.id, revokedAt: null, firstSeenAt: s.clock.t.toISOString() });
    expect(rows[0].deviceKeyHash).toBe(hashSecret(String(again.deviceKey)));
  });

  it('an ended row with the same label and host is reused: row count unchanged, session rebound, 2FA forgotten', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const first = await login(s);
    const [before] = await s.store.devices(id);
    await s.store.updateDevice(before.id, { revokedAt: s.clock.t.toISOString() });
    await s.secStore.setPortalDeviceTwoFactor(before.id, s.clock.t.toISOString());
    const out = await login(s);
    expect(out.deviceKey).not.toBe(first.deviceKey);
    const rows = await s.store.devices(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: before.id, revokedAt: null, twoFactorUntil: null, confirmedAt: s.clock.t.toISOString() });
    expect(rows[0].sessionId).not.toBe(before.sessionId);
    expect(rows[0].sessionId).not.toBeNull();
  });

  it('the same label on another host is not reused', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await ended(s, id, { host: 'sportiv', label: 'Calculator, Browser' });
    s.c.userAgent = null;
    await s.store.updateDevice((await s.store.devices(id))[0].id, { label: 'Dispozitiv necunoscut' });
    await login(s);
    const rows = await s.store.devices(id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.host === 'sportiv')?.sessionId).toBeNull();
  });

  it('a live fresh row still has its sessions revoked before reuse', async () => {
    const s = setup2fa();
    await s.addAccount();
    const first = await login(s);
    const revoke = vi.spyOn(s.c.sessions, 'revokeDevice');
    const again = await login(s, first.deviceKey);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(again.deviceKey).toBeNull();
  });

  it('a stale never-revoked row met without its cookie ends its sessions before it is rebound', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    await login(s);
    const [before] = await s.store.devices(id);
    s.advance(31 * DAY);
    const revoke = vi.spyOn(s.c.sessions, 'revokeDevice');
    await login(s);
    expect(revoke).toHaveBeenCalledWith(1, before.id);
    expect(await s.store.devices(id)).toHaveLength(1);
  });

  it('two takeovers of one ended row: the guarded rebind lets only one win', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const row = await ended(s, id);
    const next = { deviceKeyHash: 'n1', sessionId: null, firstSeenAt: 'a', lastSeenAt: 'a', revokedAt: null, confirmedAt: null, twoFactorUntil: null };
    expect(await s.store.rebindDevice(row, hashSecret('old-key'), next)).toBe(true);
    expect(await s.store.rebindDevice(row, hashSecret('old-key'), { ...next, deviceKeyHash: 'n2' })).toBe(false);
    expect((await s.store.devices(id))[0].deviceKeyHash).toBe('n1');
  });

  it('the listing omits stale rows', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const first = await login(s);
    const scope = { portal: s.store, accountId: id, userId: 1, sessionId: 'x', host: 'antrenor', now: s.c.now, actor: 'Ana' };
    expect(await listDevicesFor(scope, first.deviceKey)).toHaveLength(1);
    s.advance(31 * DAY);
    expect(await listDevicesFor(scope, first.deviceKey)).toEqual([]);
  });
});

describe('portal new-device mail', () => {
  it('no cookie: mail, even with the same label as an existing row', async () => {
    const s = setup2fa();
    await s.addAccount();
    await login(s);
    expect(mailCount(s)).toBe(1);
    s.advance(3600_001);
    await login(s);
    expect(mailCount(s)).toBe(2);
  });

  it('the cookie of this account: no mail, also when the row ended or went stale', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const first = await login(s);
    expect(mailCount(s)).toBe(1);
    s.advance(3600_001);
    await login(s, first.deviceKey);
    expect(mailCount(s)).toBe(1);
    const [row] = await s.store.devices(id);
    await s.store.updateDevice(row.id, { revokedAt: s.clock.t.toISOString() });
    await login(s, first.deviceKey);
    expect(mailCount(s)).toBe(1);
    const second = await login(s, null);
    expect(second.deviceKey).not.toBeNull();
    expect(mailCount(s)).toBe(2);
    s.advance(31 * DAY);
    await login(s, second.deviceKey);
    expect(mailCount(s)).toBe(2);
  });

  it('a cookie that is a row of another account sends the mail', async () => {
    const s = setup2fa();
    const id = await s.addAccount();
    const other = await s.store.createAccount({ userId: 2, email: 'bob@x.ro', status: 'active', teamMemberId: 'tm2' });
    await ended(s, other, { key: 'bobs-key', seenAgo: 1 });
    await login(s, 'bobs-key');
    expect(mailCount(s)).toBe(1);
    expect((await s.store.devices(id))).toHaveLength(1);
  });
});
