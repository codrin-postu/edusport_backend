import { IP_RULE, LOGIN_RULE, MAIL_RULE, afterHit, afterSuccess, ipKey, isLocked, loginKey, mailKey } from '../limits';
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
};

export function limiter(store: PortalStore, now: () => Date): Limiter {
  const hit = (key: string, rule: typeof LOGIN_RULE) =>
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
  };
}
