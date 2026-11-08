import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { formatBackupCode, newBackupCodes } from '../backup-codes';
import { codeMac, normalizeCode } from '../code-mac';
import { seal, totpAad } from '../secret-box';
import type { SecurityStore, Subject } from '../store';
import { base32, newTotpSecret } from '../totp';
import { TEST_KEYS } from './keys';

export type StoreHarness = { store: SecurityStore; dump(): Promise<unknown>; fresh(): Subject; adminUser(): number };

const uniqueMac = (): string => `m1:aaaaaaaa:${randomBytes(32).toString('hex')}`;
const iso = (d: Date): string => d.toISOString();
const batchRows = (s: Subject, codes: string[]) =>
  codes.map((c) => {
    const m = codeMac(TEST_KEYS, 'backup', s.type, s.id, c);
    return { codeMac: `m1:${m.keyId}:${m.mac}`, keyId: m.keyId };
  });

/** Behaviour both stores must share. `make` returns a harness over an empty or throwaway database. */
export function storeContract(make: () => Promise<StoreHarness>): void {
  it('consumeOnce races open once, for a backup row and a challenge', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    await store.insertBackupBatch(s, 'b1', batchRows(s, ['AAAAAAAAAA']), iso(new Date()));
    const [row] = await store.unusedBackup(s);
    const backup = await Promise.all([store.consumeOnce('backup', row.id, iso(new Date())), store.consumeOnce('backup', row.id, iso(new Date()))]);
    expect(backup.filter(Boolean)).toHaveLength(1);
    const id = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: iso(new Date(Date.now() + 60_000)) });
    const challenge = await Promise.all([store.consumeOnce('challenge', id, iso(new Date())), store.consumeOnce('challenge', id, iso(new Date()))]);
    expect(challenge.filter(Boolean)).toHaveLength(1);
  });

  it('acceptStep is a compare-and-set', async () => {
    const { store, fresh } = await make();
    const id = await store.upsertFactor(fresh(), 'totp', { secretBox: 'box' });
    expect([await store.acceptStep(id, 10), await store.acceptStep(id, 10)]).toEqual([true, false]);
    expect([await store.acceptStep(id, 12), await store.acceptStep(id, 11)]).toEqual([true, false]);
    const parallel = await Promise.all([store.acceptStep(id, 13), store.acceptStep(id, 13)]);
    expect(parallel.filter(Boolean)).toHaveLength(1);
  });

  it('insertBackupBatch marks the older unused rows used and leaves 10 unused', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    await store.insertBackupBatch(s, 'b1', batchRows(s, newBackupCodes(10)), iso(new Date()));
    await store.insertBackupBatch(s, 'b2', batchRows(s, newBackupCodes(10)), iso(new Date()));
    const unused = await store.unusedBackup(s);
    expect(unused).toHaveLength(10);
    expect(new Set(unused.map((r) => r.batch))).toEqual(new Set(['b2']));
  });

  it('insertBackupBatch with onlyIfNone inserts only when no unused code exists', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    expect(await store.insertBackupBatch(s, 'b1', batchRows(s, newBackupCodes(10)), iso(new Date()), true)).toBe(true);
    expect(await store.insertBackupBatch(s, 'b2', batchRows(s, newBackupCodes(10)), iso(new Date()), true)).toBe(false);
    expect(new Set((await store.unusedBackup(s)).map((r) => r.batch))).toEqual(new Set(['b1']));
    for (const r of await store.unusedBackup(s)) await store.consumeOnce('backup', r.id, iso(new Date()));
    expect(await store.insertBackupBatch(s, 'b3', batchRows(s, newBackupCodes(10)), iso(new Date()), true)).toBe(true);
  });

  it('insertBackupBatch is one transaction: a failing insert keeps the old codes unused', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    await store.insertBackupBatch(s, 'b1', batchRows(s, newBackupCodes(3)), iso(new Date()));
    await expect(store.insertBackupBatch(s, 'b2', [{ codeMac: 'm1:aaaaaaaa:x', keyId: 'aaaaaaaa' }, null as never], iso(new Date()))).rejects.toThrow();
    expect(await store.unusedBackup(s)).toHaveLength(3);
  });

  it('upsertFactor replaces an unconfirmed row and throws on a confirmed row of the kind', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    const first = await store.upsertFactor(s, 'totp', { secretBox: 'one' });
    const second = await store.upsertFactor(s, 'totp', { secretBox: 'two' });
    const rows = await store.factors(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: second, secretBox: 'two', confirmedAt: null });
    expect(first).not.toBe(second);
    expect(await store.confirmFactor(second, iso(new Date()))).toBe(true);
    expect(await store.confirmFactor(second, iso(new Date()))).toBe(false);
    await expect(store.upsertFactor(s, 'totp', { secretBox: 'three' })).rejects.toThrow();
    expect((await store.factors(s))[0].secretBox).toBe('two');
  });

  it('deleteFactors reports the count and honours the kind', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    await store.upsertFactor(s, 'totp', { secretBox: 'x' });
    await store.upsertFactor(s, 'email', { secretBox: null });
    expect(await store.deleteFactors(s, 'totp')).toBe(1);
    expect((await store.factors(s)).map((f) => f.kind)).toEqual(['email']);
    expect(await store.deleteFactors(s)).toBe(1);
  });

  it('addTry in parallel x5 ends at 5; bumpTries stops at the limit', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    const exp = iso(new Date(Date.now() + 600_000));
    const id = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: exp });
    const counts = await Promise.all([1, 2, 3, 4, 5].map(() => store.addTry(id)));
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    const otherMac = uniqueMac();
    const other = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: otherMac, data: {}, expiresAt: exp });
    const bumps = await Promise.all([1, 2, 3, 4, 5, 6, 7].map(() => store.bumpTries(other, new Date(), 5)));
    expect(bumps.filter(Boolean)).toHaveLength(5);
    expect((await store.challengeByMac(otherMac))?.tries).toBe(5);
  });

  it('bumpTries refuses an expired or used challenge', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    const past = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: iso(new Date(Date.now() - 1000)) });
    expect(await store.bumpTries(past, new Date(), 5)).toBe(false);
    const live = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: iso(new Date(Date.now() + 60_000)) });
    await store.consumeOnce('challenge', live, iso(new Date()));
    expect(await store.bumpTries(live, new Date(), 5)).toBe(false);
  });

  it('challenges: unique secretMac, lookup by mac, open ones of a subject and purpose, json data kept', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    const mac = uniqueMac();
    const exp = iso(new Date(Date.now() + 60_000));
    const id = await store.createChallenge({ purpose: 'pending-login', subject: s, secretMac: mac, data: { method: 'totp', rememberMe: true }, expiresAt: exp });
    await expect(store.createChallenge({ purpose: 'pending-login', subject: s, secretMac: mac, data: {}, expiresAt: exp })).rejects.toThrow();
    const row = await store.challengeByMac(mac);
    expect(row).toMatchObject({ id, purpose: 'pending-login', subject: s, data: { method: 'totp', rememberMe: true }, usedAt: null, tries: 0 });
    expect((await store.openChallenges(s, 'pending-login')).map((c) => c.id)).toEqual([id]);
    expect(await store.openChallenges(s, 'email-code')).toEqual([]);
    expect(await store.challengeByMac('m1:bbbbbbbb:none')).toBeNull();
  });

  it('ensureAdminAccount twice returns the same row, webauthnUserId decodes to 32 bytes; lookups work', async () => {
    const { store, adminUser } = await make();
    const uid = adminUser();
    const a = await store.ensureAdminAccount(uid);
    const b = await store.ensureAdminAccount(uid);
    expect(b.id).toBe(a.id);
    expect(Buffer.from(a.webauthnUserId, 'base64url')).toHaveLength(32);
    expect((await store.adminAccountByHandle(a.webauthnUserId))?.id).toBe(a.id);
    await store.updateAdminAccount(a.id, { googleSub: `sub-${uid}`, lastMethod: 'totp' });
    expect(await store.adminAccountByGoogleSub(`sub-${uid}`)).toMatchObject({ id: a.id, lastMethod: 'totp' });
    expect(await store.adminAccount(uid)).toMatchObject({ id: a.id, adminUserId: uid });
  });

  it('admin devices and security notes round trip', async () => {
    const { store, adminUser } = await make();
    const uid = adminUser();
    const at = iso(new Date());
    const id = await store.createAdminDevice({ adminUserId: uid, deviceKeyHash: 'h1', strapiDeviceId: `sd-${uid}`, label: 'Mac', firstSeenAt: at, lastSeenAt: at });
    await store.updateAdminDevice(id, { twoFactorUntil: at });
    expect(await store.adminDeviceByKey(uid, 'h1')).toMatchObject({ id, twoFactorUntil: at, revokedAt: null });
    expect((await store.adminDevices(uid)).map((d) => d.id)).toEqual([id]);
    const s: Subject = { type: 'admin', id: String(uid) };
    expect(await store.securityNotes(s)).toEqual({});
    await store.setSecurityNotes(s, { backupNotice: 3 });
    expect(await store.securityNotes(s)).toEqual({ backupNotice: 3 });
  });

  it('passkeys round trip', async () => {
    const { store, fresh } = await make();
    const s = fresh();
    const credentialId = `cred-${s.id}`;
    const id = await store.createPasskey({
      subject: s, credentialId, publicKey: 'pk', counter: 0, transports: ['internal'], deviceType: 'multiDevice', backedUp: true, rpId: 'x.ro', name: 'Telefon', createdAt: iso(new Date()),
    });
    await expect(store.createPasskey({ subject: s, credentialId, publicKey: 'pk', counter: 0, transports: [], deviceType: 'singleDevice', backedUp: false, rpId: 'x.ro', name: 'B', createdAt: iso(new Date()) })).rejects.toThrow();
    await store.updatePasskey(id, { counter: 5, name: 'Nou', lastUsedAt: iso(new Date()) });
    expect(await store.passkeyByCredential(credentialId)).toMatchObject({ id, counter: 5, name: 'Nou', transports: ['internal'], backedUp: true });
    expect(await store.passkeys(s)).toHaveLength(1);
    await store.deletePasskey(id);
    expect(await store.passkeys(s)).toEqual([]);
  });

  it('purge removes the old rows by the spec 3.9 rules and keeps the newer ones', async () => {
    const { store, fresh, adminUser } = await make();
    const s = fresh();
    const uid = adminUser();
    const t0 = new Date();
    const exp = (ms: number) => iso(new Date(t0.getTime() + ms));
    await store.upsertFactor(s, 'totp', { secretBox: 'x' });
    const confirmed = await store.upsertFactor(s, 'email', { secretBox: null });
    await store.confirmFactor(confirmed, iso(t0));
    const used = await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: exp(600_000) });
    await store.consumeOnce('challenge', used, iso(t0));
    await store.createChallenge({ purpose: 'email-code', subject: s, secretMac: uniqueMac(), data: {}, expiresAt: exp(600_000) });
    await store.insertBackupBatch(s, 'b1', batchRows(s, newBackupCodes(2)), iso(t0));
    await store.insertBackupBatch(s, 'b2', batchRows(s, newBackupCodes(2)), iso(t0));
    const at = iso(t0);
    const revoked = await store.createAdminDevice({ adminUserId: uid, deviceKeyHash: 'r', strapiDeviceId: `rv-${uid}`, label: 'a', firstSeenAt: at, lastSeenAt: at });
    await store.updateAdminDevice(revoked, { revokedAt: at, confirmedAt: at });
    const live = await store.createAdminDevice({ adminUserId: uid, deviceKeyHash: 'l', strapiDeviceId: `lv-${uid}`, label: 'b', firstSeenAt: at, lastSeenAt: at });
    await store.updateAdminDevice(live, { confirmedAt: at });
    // A device row made at the password step that no sign-in confirmed goes after a day (M1), not before.
    const unconfirmed = await store.createAdminDevice({ adminUserId: uid, deviceKeyHash: 'u', strapiDeviceId: `uc-${uid}`, label: 'c', firstSeenAt: at, lastSeenAt: at });

    const minutes = (n: number) => new Date(t0.getTime() + n * 60_000);
    // The tables are shared with other tests on a real database, so counts are lower bounds and the checks read this subject's rows.
    const atLeast = (got: Record<string, number>, want: Record<string, number>) => {
      for (const [k, v] of Object.entries(want)) expect(got[k], k).toBeGreaterThanOrEqual(v);
    };
    await store.purge(minutes(10));
    expect((await store.factors(s)).length).toBe(2);
    expect((await store.openChallenges(s, 'email-code')).length).toBe(1);
    expect((await store.adminDevices(uid)).length).toBe(3);
    atLeast(await store.purge(minutes(20)), { factors: 1 });
    expect((await store.factors(s)).map((f) => f.kind)).toEqual(['email']);
    const days = (n: number) => new Date(t0.getTime() + n * 24 * 3600_000);
    expect((await store.openChallenges(s, 'email-code')).length).toBe(1);
    atLeast(await store.purge(days(2)), { challenges: 2 });
    expect(await store.openChallenges(s, 'email-code')).toEqual([]);
    expect(await store.unusedBackup(s)).toHaveLength(2);
    expect((await store.adminDevices(uid)).map((d) => d.id)).not.toContain(unconfirmed);
    expect((await store.adminDevices(uid)).length).toBe(2);
    atLeast(await store.purge(days(31)), { backupCodes: 2, adminDevices: 1 });
    expect((await store.adminDevices(uid)).map((d) => d.id)).toEqual([live]);
    expect(await store.unusedBackup(s)).toHaveLength(2);
  });

  it('a dump of the tables gives no usable code: no backup code in any normalization, no base32 of the secret', async () => {
    const { store, dump, fresh } = await make();
    const s = fresh();
    const secret = newTotpSecret();
    const factor = await store.upsertFactor(s, 'totp', { secretBox: seal(TEST_KEYS, secret, totpAad(s.type, s.id)) });
    await store.confirmFactor(factor, iso(new Date()));
    const codes = newBackupCodes(10);
    await store.insertBackupBatch(s, 'b1', batchRows(s, codes), iso(new Date()));
    const json = JSON.stringify(await dump());
    for (const code of codes) {
      for (const form of [code, formatBackupCode(code), normalizeCode(code), code.toLowerCase(), formatBackupCode(code).toLowerCase()]) expect(json).not.toContain(form);
    }
    expect(json).not.toContain(base32(secret));
    expect(json).not.toContain(secret.toString('hex'));
    expect(json).not.toContain(secret.toString('base64'));
  });
}
