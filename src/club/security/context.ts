import type { SecurityMailKind } from '../../email/security-mail';
import type { AuthRefusal } from '../admin-result';
import type { PortalResult } from '../portal/auth/context';
import type { Limiter } from '../portal/auth/limit';
import { SECURITY_ERRORS } from './copy';
import type { Keys } from './keys';
import type { SecurityStore, Subject } from './store';

export type SecurityContext = {
  store: SecurityStore;
  keys: Keys | null;
  now: () => Date;
  log: (m: string) => void;
  mail: (to: string, kind: SecurityMailKind, data: Record<string, unknown>) => Promise<boolean>;
  limits: Limiter;
  ip: string;
  userAgent: string | null;
  /** The name written on history lines. */
  actor: string;
  /** Admin: T10 endAdminSessions; portal: sessions.revokeAll. */
  endSessions: (s: Subject, o: { exceptDevice?: string }) => Promise<void>;
  /** T8 forgetDevices. */
  forgetDevices: (s: Subject, o: { exceptDevice?: string }) => Promise<void>;
};

/** Spec 5.2: without keys every 2FA action answers 503 and logs the cause (never a key). */
export function keysOrRefusal(c: SecurityContext): { keys: Keys } | { refusal: PortalResult<never> } {
  if (c.keys) return { keys: c.keys };
  c.log('[security] 2FA refused: AUTH_SECRET_KEY / AUTH_CODE_KEY not usable');
  const refusal: AuthRefusal = { ok: false, status: 503, error: SECURITY_ERRORS.unavailable };
  return { refusal };
}

/** The history subject of a security line: the portal account document id, or the admin user id. */
export const subjectKey = (s: Subject): string => s.id;

export const counterKey = (s: Subject): string => `2fa:${s.type}:${s.id}`;
