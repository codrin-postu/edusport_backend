import { AsyncLocalStorage } from 'node:async_hooks';
import { vi } from 'vitest';
import type { PortalMail, SendPortalMail } from '../../../email/portal-direct';
import type { SecurityMailKind } from '../../../email/security-mail';
import type { SecurityContext } from '../../security/context';
import { issueBackupBatch } from '../../security/factors';
import type { Keys } from '../../security/keys';
import { seal, totpAad } from '../../security/secret-box';
import { totpAt } from '../../security/totp';
import { TEST_KEYS } from '../../security/__tests__/keys';
import { memorySecurityStore } from '../../security/__tests__/memory-security-store';
import { limiter } from '../auth/limit';
import type { PortalAuthContext } from '../auth/context';
import { portalSecurityContext } from '../security';
import { portalSessions } from '../sessions';
import type { AccountRow, PortalStore } from '../store';
import { fakePortalStore, type FakePortal } from './fake-portal-store';

/** Concurrent outermost transactions run one after another, as row locks do; nested ones pass through. */
export function serialized(store: PortalStore): PortalStore {
  const inside = new AsyncLocalStorage<boolean>();
  let tail: Promise<unknown> = Promise.resolve();
  return {
    ...store,
    transaction: <T>(fn: () => Promise<T>): Promise<T> => {
      if (inside.getStore()) return store.transaction(fn);
      const run = tail.then(() => inside.run(true, () => store.transaction(fn)));
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

export const TOTP_SECRET = Buffer.from('12345678901234567890');
export type SecMail = { to: string; kind: SecurityMailKind; data: Record<string, unknown> };

/** A security context for tests that build their own portal context: a memory security store, keys on, security mails dropped. */
export function securityFor(fake: FakePortal, store: PortalStore, now: () => Date, keys: Keys | null = TEST_KEYS) {
  const mem = memorySecurityStore(now);
  const secStore = {
    ...mem.store,
    portalDeviceIds: async (aid: string) => fake.state.devices.filter((d) => d.accountId === aid).map((d) => d.id),
    setPortalDeviceTwoFactor: async (id: string, until: string | null) => {
      const d = fake.state.devices.find((x) => x.id === id);
      if (d) d.twoFactorUntil = until;
    },
  };
  const secMails: SecMail[] = [];
  const logs: string[] = [];
  const sessions = portalSessions(store, now);
  const limits = limiter(store, now);
  const security: SecurityContext = portalSecurityContext({
    store, security: secStore, sessions, limits, now, keys, log: (m) => logs.push(m), ip: '1.1.1.1', userAgent: null,
    sendSecurity: async (to, m) => {
      secMails.push({ to, kind: m.kind, data: m.data as Record<string, unknown> });
      return true;
    },
  });
  return { security, secStore, mem, secMails, logs, sessions, limits };
}

/** The portal context with the shared security context on the memory security store (portal devices live in the fake portal store). */
export function setup2fa(o: { keys?: Keys | null; mailOk?: boolean } = {}) {
  const clock = { t: new Date('2026-11-07T10:00:00.000Z') };
  const now = () => clock.t;
  const fake = fakePortalStore({ now });
  const store = serialized(fake.store);
  const base = securityFor(fake, store, now, o.keys === undefined ? TEST_KEYS : o.keys);
  const { mem, secStore, secMails, logs, sessions, limits, security } = base;
  if (o.mailOk === false) security.mail = async () => false;
  const mails: { to: string; mail: PortalMail }[] = [];
  const mail: SendPortalMail = async (to, m) => {
    mails.push({ to, mail: m });
    return true;
  };
  const compare = vi.fn(async (p: string, h: string) => h === `hash:${p}`);
  const c: PortalAuthContext = {
    store, sessions, limits, mail, common: new Set(), hosts: ['antrenor'], ip: '1.1.1.1', userAgent: null, now, log: (m) => logs.push(m),
    sleep: async () => undefined, hash: async (p) => `hash:${p}`, compare, security,
  };
  fake.state.users.push({ id: 1, email: 'ana@x.ro', passwordHash: 'hash:right', blocked: false, confirmed: true, username: 'ana@x.ro', provider: 'local', role: 'authenticated' });
  const addAccount = async (extra: Partial<AccountRow> = {}) => store.createAccount({ userId: 1, email: 'ana@x.ro', status: 'active', teamMemberId: 'tm1', ...extra });
  const step = () => Math.floor(clock.t.getTime() / 30_000);
  const totp = (offset = 0): string => totpAt(TOTP_SECRET, step() + offset);
  const enrol = async (accountId: string, opts: { backup?: boolean } = {}): Promise<string[]> => {
    const s = { type: 'portal' as const, id: accountId };
    await secStore.confirmFactor(await secStore.upsertFactor(s, 'totp', { secretBox: seal(TEST_KEYS, TOTP_SECRET, totpAad('portal', accountId)) }), clock.t.toISOString());
    return opts.backup ? issueBackupBatch(security, TEST_KEYS, s) : [];
  };
  return { c, fake, store, mem, secStore, mails, secMails, logs, compare, addAccount, totp, enrol, clock, advance: (ms: number) => { clock.t = new Date(clock.t.getTime() + ms); } };
}
