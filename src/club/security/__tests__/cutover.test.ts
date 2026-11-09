import { describe, expect, it } from 'vitest';
import { purgePortal } from '../../portal/purge';
import { fakePortalStore } from '../../portal/__tests__/fake-portal-store';
import { applyCutover, cutoverReport, oldKeyPurge, planCutover } from '../cutover';
import type { Subject } from '../store';
import { memorySecurityStore } from './memory-security-store';

const OLD = 'codrin.space';
const NEW = 'scoaladepatinaj.com';
const A: Subject = { type: 'admin', id: '7' };
const B: Subject = { type: 'portal', id: 'acct-b' };
const C: Subject = { type: 'portal', id: 'acct-c' };
const OFFERED = '2026-11-01T10:00:00.000Z';
const MOVED = '2027-01-10T00:00:00.000Z';

let n = 0;
const key = (subject: Subject, rpId: string, createdAt = '2026-12-01T10:00:00.000Z') => ({
  subject, credentialId: `cred-${(n += 1)}`, publicKey: 'pk', counter: 0, transports: [], deviceType: 'multiDevice', backedUp: true, rpId, name: 'Telefon', createdAt,
});

async function world() {
  const mem = memorySecurityStore();
  const { store } = mem;
  await store.updateAdminAccount((await store.ensureAdminAccount(7)).id, { passkeyOfferedAt: OFFERED });
  for (const s of [B, C]) await store.updatePortalAccountExtra(s.id, { passkeyOfferedAt: OFFERED });
  await store.createPasskey(key(A, OLD));
  await store.createPasskey(key(B, OLD));
  await store.createPasskey(key(B, NEW));
  return mem;
}

const offered = async (mem: Awaited<ReturnType<typeof world>>) => ({
  a: (await mem.store.adminAccount(7))?.passkeyOfferedAt,
  b: (await mem.store.portalAccountExtra(B.id)).passkeyOfferedAt,
  c: (await mem.store.portalAccountExtra(C.id)).passkeyOfferedAt,
});

describe('the domain move script', () => {
  it('cutover clears the offer flag only for old-only subjects', async () => {
    const mem = await world();
    const plan = await planCutover(mem.store, NEW);
    expect(plan.subjectsToOffer).toEqual([A]);
    expect(plan.perRpId).toEqual({ [OLD]: 2, [NEW]: 1 });
    expect(await applyCutover(mem.store, plan)).toBe(1);
    // A (only old keys) is cleared, B (an old and a new key) kept, C (no keys) untouched
    expect(await offered(mem)).toEqual({ a: null, b: OFFERED, c: OFFERED });
  });

  it('a dry run (plan and report) changes nothing and deletes nothing', async () => {
    const mem = await world();
    const before = JSON.stringify(mem.dump());
    const plan = await planCutover(mem.store, NEW);
    expect(cutoverReport(plan)).toEqual([`${OLD}: 2`, `${NEW}: 1`, 'subjects to offer again: 1']);
    expect(JSON.stringify(mem.dump())).toBe(before);
    await applyCutover(mem.store, plan);
    expect(await mem.store.allPasskeys()).toHaveLength(3);
  });

  it('running it twice is harmless: the second plan still names the subject, the flag stays cleared', async () => {
    const mem = await world();
    await applyCutover(mem.store, await planCutover(mem.store, NEW));
    await applyCutover(mem.store, await planCutover(mem.store, NEW));
    expect((await offered(mem)).a).toBeNull();
  });

  it('with no keys at all the report says so', async () => {
    expect(cutoverReport(await planCutover(memorySecurityStore().store, NEW))).toEqual(['no keys', 'subjects to offer again: 0']);
  });
});

describe('the old-key purge', () => {
  const env = { WEBAUTHN_RP_ID: NEW, WEBAUTHN_MOVED_AT: MOVED } as NodeJS.ProcessEnv;
  const day = (iso: string, days: number): Date => new Date(Date.parse(iso) + days * 24 * 3600_000);

  it('only runs when WEBAUTHN_MOVED_AT is set and readable, and 30 days have passed', () => {
    expect(oldKeyPurge({ WEBAUTHN_RP_ID: NEW } as NodeJS.ProcessEnv, day(MOVED, 90))).toBeNull();
    expect(oldKeyPurge({ ...env, WEBAUTHN_MOVED_AT: 'soon' }, day(MOVED, 90))).toBeNull();
    expect(oldKeyPurge(env, day(MOVED, 29))).toBeNull();
    expect(oldKeyPurge(env, day(MOVED, 30))).toEqual({ rpId: NEW, before: new Date(MOVED) });
  });

  it('removes old-rpId keys only after 30 days and never a current-rpId key', async () => {
    const mem = await world();
    const portal = fakePortalStore();
    const early = await purgePortal(portal.store, day(MOVED, 29), mem.store, env);
    expect(early.passkeys).toBeUndefined();
    expect(await mem.store.allPasskeys()).toHaveLength(3);
    const late = await purgePortal(portal.store, day(MOVED, 31), mem.store, env);
    expect(late.passkeys).toBe(2);
    const left = await mem.store.allPasskeys();
    expect(left).toHaveLength(1);
    expect(left[0].rpId).toBe(NEW);
  });

  it('without WEBAUTHN_MOVED_AT nothing is purged', async () => {
    const mem = await world();
    const done = await purgePortal(fakePortalStore().store, day(MOVED, 400), mem.store, { WEBAUTHN_RP_ID: NEW } as NodeJS.ProcessEnv);
    expect(done.passkeys).toBeUndefined();
    expect(await mem.store.allPasskeys()).toHaveLength(3);
  });
});
