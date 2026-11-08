import { IP_RULE, LOGIN_RULE, MAIL_RULE, afterHit, afterSuccess, ipKey, isLocked, loginKey, mailKey, type LimitRule } from '../limits';
import type { PortalStore } from '../store';

export type Limiter = {
  /** Counts the attempt. */
  ipBlocked(ip: string): Promise<boolean>;
  /**
   * Counts the attempt before the password is compared, in the same locked step as the lock check, so at
   * most 5 compares run per window however many requests arrive at once. Works for e-mails without an account.
   * refused: locked on entry, do not compare. locking: this attempt took the count to the limit and set the lock.
   */
  emailAttempt(email: string): Promise<{ refused: boolean; locking: boolean; firstLock: boolean }>;
  emailCleared(email: string): Promise<void>;
  /** Counts a send. */
  mailAllowed(email: string): Promise<boolean>;
  /** The 2FA counters (`2fa:<type>:<id>`): whether the key is locked now, without counting. */
  keyLocked(key: string): Promise<boolean>;
  /**
   * Counts one attempt on a 2FA counter before the code is compared, in the same locked step as the lock check (as `emailAttempt`),
   * so at most 5 compares run per window however many requests arrive at once. refused: locked on entry, do not compare.
   */
  keyAttempt(key: string): Promise<{ refused: boolean; locking: boolean; firstLock: boolean }>;
  /** Counts a 2FA code mail under a subject key (`2fa:mail:<type>:<id>`), apart from the reset request's `mail:<email>`. */
  keyMailAllowed(key: string): Promise<boolean>;
  /** A right answer clears the count. */
  keyCleared(key: string): Promise<void>;
};

export function limiter(store: PortalStore, now: () => Date): Limiter {
  const hit = (key: string, rule: LimitRule) =>
    store.transaction(async () => {
      const row = await store.lockLimit(key);
      const out = afterHit(row, rule, now());
      await store.saveLimit(row.id, out.state);
      return out;
    });

  return {
    ipBlocked: async (ip) => (await hit(ipKey(ip), IP_RULE)).blocked,
    emailAttempt: (email) =>
      store.transaction(async () => {
        const row = await store.lockLimit(loginKey(email));
        if (isLocked(row, LOGIN_RULE, now())) return { refused: true, locking: false, firstLock: false };
        const out = afterHit(row, LOGIN_RULE, now());
        await store.saveLimit(row.id, out.state);
        return { refused: false, locking: out.blocked, firstLock: out.firstLock };
      }),
    emailCleared: (email) =>
      store.transaction(async () => {
        const row = await store.lockLimit(loginKey(email));
        await store.saveLimit(row.id, afterSuccess(now()));
      }),
    mailAllowed: async (email) => !(await hit(mailKey(email), MAIL_RULE)).blocked,
    keyLocked: (key) => store.transaction(async () => isLocked(await store.lockLimit(key), LOGIN_RULE, now())),
    keyAttempt: (key) =>
      store.transaction(async () => {
        const row = await store.lockLimit(key);
        if (isLocked(row, LOGIN_RULE, now())) return { refused: true, locking: false, firstLock: false };
        const out = afterHit(row, LOGIN_RULE, now());
        await store.saveLimit(row.id, out.state);
        return { refused: false, locking: out.blocked, firstLock: out.firstLock };
      }),
    keyMailAllowed: async (key) => !(await hit(key, MAIL_RULE)).blocked,
    keyCleared: (key) =>
      store.transaction(async () => {
        const row = await store.lockLimit(key);
        await store.saveLimit(row.id, afterSuccess(now()));
      }),
  };
}
