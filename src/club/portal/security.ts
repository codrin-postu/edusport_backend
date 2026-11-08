import type { SecurityMail } from '../../email/security-mail';
import type { SecurityContext } from '../security/context';
import type { Keys } from '../security/keys';
import { forgetDevices } from '../security/remembered';
import type { SecurityStore, Subject } from '../security/store';
import type { Limiter } from './auth/limit';
import type { PortalSessions } from './sessions';
import type { PortalStore } from './store';

export type PortalSecurityParts = {
  store: PortalStore; security: SecurityStore; sessions: PortalSessions; limits: Limiter; now: () => Date; keys: Keys | null;
  log: (m: string) => void; ip: string; userAgent: string | null;
  sendSecurity: (to: string, mail: SecurityMail) => Promise<boolean>;
};

/** Every session of the account behind a portal subject ends (spec 6.6); the subject id is the account document id. */
export async function endPortalSessions(store: PortalStore, sessions: PortalSessions, s: Subject): Promise<void> {
  const account = await store.account(s.id);
  if (account) await sessions.revokeAll(account.userId);
}

/** The shared 2FA machinery on the portal's own store, limiter and sessions. One per request (the stores keep a transaction pointer). */
export function portalSecurityContext(p: PortalSecurityParts): SecurityContext {
  return {
    store: p.security, keys: p.keys, now: p.now, log: p.log, limits: p.limits, ip: p.ip, userAgent: p.userAgent, actor: 'sistem',
    mail: (to, kind, data) => p.sendSecurity(to, { kind, data } as SecurityMail),
    endSessions: (s) => endPortalSessions(p.store, p.sessions, s),
    forgetDevices: (s, o) => forgetDevices(p.security, s, o),
  };
}
