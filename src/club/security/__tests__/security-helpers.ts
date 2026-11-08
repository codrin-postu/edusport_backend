import { AsyncLocalStorage } from 'node:async_hooks';
import { vi } from 'vitest';
import type { SecurityMailKind } from '../../../email/security-mail';
import { limiter } from '../../portal/auth/limit';
import { fakePortalStore } from '../../portal/__tests__/fake-portal-store';
import type { PortalStore } from '../../portal/store';
import type { SecurityContext } from '../context';
import type { Subject } from '../store';
import { TEST_KEYS } from './keys';
import { memorySecurityStore } from './memory-security-store';

/** Concurrent outermost transactions run one after another, as row locks do; nested ones pass through. */
function serialized(store: PortalStore): PortalStore {
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

export const PORTAL_SUBJECT: Subject = { type: 'portal', id: 'acct-1' };
export const ADMIN_SUBJECT: Subject = { type: 'admin', id: '7' };
export const EMAIL = 'ana@x.ro';

export type Sent = { to: string; kind: SecurityMailKind; data: Record<string, unknown> };

/** A context over the memory store, a fake clock you move with `clock.t`, a fake mailbox and spies for the session and device callbacks. */
export function setup(o: { keys?: SecurityContext['keys']; mailOk?: boolean } = {}) {
  const clock = { t: new Date('2026-11-07T10:00:00.000Z') };
  const now = () => clock.t;
  const mem = memorySecurityStore(now);
  const portal = fakePortalStore({ now });
  const mails: Sent[] = [];
  const logs: string[] = [];
  const endSessions = vi.fn(async () => undefined);
  const forget = vi.fn(async (_s: Subject, _o: { exceptDevice?: string }) => undefined);
  const c: SecurityContext = {
    store: mem.store,
    keys: o.keys === undefined ? TEST_KEYS : o.keys,
    now,
    log: (m) => logs.push(m),
    mail: async (to, kind, data) => {
      mails.push({ to, kind, data });
      return o.mailOk !== false;
    },
    limits: limiter(serialized(portal.store), now),
    ip: '1.1.1.1',
    userAgent: null,
    actor: 'Ana Pop',
    endSessions,
    forgetDevices: forget,
  };
  const advance = (ms: number): void => {
    clock.t = new Date(clock.t.getTime() + ms);
  };
  return { c, mem, clock, advance, mails, logs, endSessions, forget, portal };
}
