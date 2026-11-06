import { IP_RULE, LOGIN_RULE, MAIL_RULE, afterHit, afterSuccess, ipKey, isLocked, loginKey, mailKey } from '../limits';
import type { PortalStore } from '../store';

export type Limiter = {
  /** Counts the attempt. */
  ipBlocked(ip: string): Promise<boolean>;
  /** Does not count. Works for e-mails without an account. */
  emailLocked(email: string): Promise<boolean>;
  /** Counts a wrong password. */
  emailFailed(email: string): Promise<{ firstLock: boolean }>;
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
    emailLocked: (email) =>
      store.transaction(async () => isLocked(await store.lockLimit(loginKey(email)), LOGIN_RULE, now())),
    emailFailed: async (email) => ({ firstLock: (await hit(loginKey(email), LOGIN_RULE)).firstLock }),
    emailCleared: (email) =>
      store.transaction(async () => {
        const row = await store.lockLimit(loginKey(email));
        await store.saveLimit(row.id, afterSuccess(now()));
      }),
    mailAllowed: async (email) => !(await hit(mailKey(email), MAIL_RULE)).blocked,
  };
}
