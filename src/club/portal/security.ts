import type { SecurityMail } from '../../email/security-mail';
import type { SecurityView } from '../security/api-types';
import { confirmEmail, confirmTotp, newBatch, securityView, sendEnrolCode, startTotp, turnOff } from '../security/factors';
import type { SecurityContext } from '../security/context';
import { addPasskey, dismissOffer, removeKey, renameKey, startPasskey } from '../security/passkey-actions';
import { rpConfig } from '../security/passkeys';
import type { Keys } from '../security/keys';
import { forgetDevices } from '../security/remembered';
import type { SecurityStore, Subject } from '../security/store';
import type { PortalAuthContext, PortalResult } from './auth/context';
import type { Limiter } from './auth/limit';
import { coachActor } from './coach/context';
import { PORTAL_ERRORS } from './copy';
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

type Coach = { accountId: string; name: string };
const unauthorized: PortalResult<never> = { ok: false, status: 401, error: PORTAL_ERRORS.wrongLogin };
const bodyCode = (body: unknown): string => {
  const code = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).code : null;
  return typeof code === 'string' ? code : '';
};

/**
 * The coach's own Securitate (index "Portal Securitate"): the shared factor services on the portal subject, with the coach's name on the
 * history lines. Every POST and DELETE counts the IP rule first (429); a read does not. The account is read again on each call (401 when gone).
 */
export function portalSecurity(c: PortalAuthContext, coach: Coach) {
  const security = { ...c.security, actor: coachActor(coach.name) };
  const subject: Subject = { type: 'portal', id: coach.accountId };
  const as = async <T>(run: (email: string) => Promise<PortalResult<T>>, o: { change: boolean }): Promise<PortalResult<T>> => {
    const account = await c.store.account(coach.accountId);
    if (!account || account.status !== 'active') return unauthorized;
    if (o.change && (await c.limits.ipBlocked(c.ip))) return { ok: false, status: 429, error: PORTAL_ERRORS.paused };
    return run(account.email);
  };
  return {
    read: () => as(async (email): Promise<PortalResult<SecurityView>> => ({ ok: true, data: await securityView(security, subject, email, rpConfig()?.rpId ?? null) }), { change: false }),
    totpStart: () => as((email) => startTotp(security, subject, email), { change: true }),
    totpConfirm: (body: unknown) => as(() => confirmTotp(security, subject, bodyCode(body)), { change: true }),
    totpOff: () => as((email) => turnOff(security, subject, email, 'totp'), { change: true }),
    emailStart: () => as((email) => sendEnrolCode(security, subject, email), { change: true }),
    emailConfirm: (body: unknown) => as(() => confirmEmail(security, subject, bodyCode(body)), { change: true }),
    emailOff: () => as((email) => turnOff(security, subject, email, 'email'), { change: true }),
    backupCodes: () => as(() => newBatch(security, subject), { change: true }),
    // The IP rule counts inside the passkey actions (every POST but the dismiss), so these run without the generic `change` count.
    passkeyStart: () => as((email) => startPasskey(security, { subject, email }), { change: false }),
    passkeyAdd: (body: unknown) => as((email) => addPasskey(security, { subject, email }, body), { change: false }),
    passkeyRename: (id: string, body: unknown) => as((email) => renameKey(security, { subject, email }, id, body), { change: false }),
    passkeyDelete: (id: string) => as((email) => removeKey(security, { subject, email }, id), { change: false }),
    passkeyDismiss: () => as((email) => dismissOffer(security, { subject, email }), { change: false }),
  };
}
