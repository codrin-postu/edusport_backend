import bcrypt from 'bcryptjs';
import type { Core } from '@strapi/strapi';
import { portalMailSender, type SendPortalMail } from '../../email/portal-direct';
import { securityMailSender, type SecurityMail } from '../../email/security-mail';
import { clientIp, userAgent } from '../portal/auth/bff';
import { limiter, type Limiter } from '../portal/auth/limit';
import { loadCommonPasswords } from '../portal/passwords';
import { strapiPortalStore } from '../portal/strapi-store';
import type { SecurityContext } from '../security/context';
import { loadKeys } from '../security/keys';
import { forgetDevices } from '../security/remembered';
import { strapiSecurityStore } from '../security/strapi-store';
import { endAdminSessions, type AdminSessionCtx, type KoaContext } from './session';

export type AdminLoginContext = SecurityContext & AdminSessionCtx & {
  compare: (p: string, h: string) => Promise<boolean>;
  secure: boolean;
  /** The common-password list of the portal rules (reset, invite, password change). */
  common: ReadonlySet<string>;
  /** Waits; the reset request holds its answer to a floor with it. */
  sleep: (ms: number) => Promise<void>;
  /** The portal mails (lockout, new device) that the login sends. */
  portalMail: SendPortalMail;
  cookie: (name: string) => string | null;
  setCookie: (name: string, value: string, maxAgeMs: number, path?: string) => void;
  clearCookie: (name: string, path?: string) => void;
};

const ORIGIN_DEFAULT_PORT = '1337';

/** Ruling 7: `ADMIN_ORIGIN` when set, else `https://<ADMIN_HOST>` in production, else `http://localhost:<PORT or 1337>`. Empty when production has neither. */
export function adminOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const set = env.ADMIN_ORIGIN?.trim();
  if (set) return set.replace(/\/+$/, '');
  if (env.NODE_ENV === 'production') return env.ADMIN_HOST?.trim() ? `https://${env.ADMIN_HOST.trim()}` : '';
  return `http://localhost:${env.PORT?.trim() || ORIGIN_DEFAULT_PORT}`;
}

/** Exact match; an unset expected origin allows nothing. */
export const originAllowed = (origin: string | undefined, expected: string): boolean => expected !== '' && origin === expected;

/** The pending-login cookie (ruling 8: path `/`, which `__Host-` requires; locally without the prefix). */
export const ADMIN_PENDING_COOKIE = (secure: boolean): string => (secure ? '__Host-es_adm_2fa' : 'es_adm_2fa');

/** `HttpOnly`, `SameSite=Lax`, `Secure` in production on a secure request. */
export function cookieHelpers(koa: KoaContext, secure: boolean): Pick<AdminLoginContext, 'cookie' | 'setCookie' | 'clearCookie'> {
  const base = { httpOnly: true, sameSite: 'lax', secure, overwrite: true };
  return {
    cookie: (name) => koa.cookies.get(name) ?? null,
    setCookie: (name, value, maxAgeMs, path = '/') => void koa.cookies.set(name, value, { ...base, path, maxAge: maxAgeMs }),
    clearCookie: (name, path = '/') => void koa.cookies.set(name, '', { ...base, path, expires: new Date(0) }),
  };
}

const prefixed = (v: string): string => `admin:${v}`;

/** The portal limiter on `admin:` keys (login, IP, mail), so an admin's counters never share a row with a coach's. The 2FA keys already carry the subject type. */
export const adminLimits = (base: Limiter): Limiter => ({
  ...base,
  ipBlocked: (ip) => base.ipBlocked(prefixed(ip)),
  emailAttempt: (email) => base.emailAttempt(prefixed(email)),
  emailCleared: (email) => base.emailCleared(prefixed(email)),
  mailAllowed: (email) => base.mailAllowed(prefixed(email)),
});

/** A fresh context for each request, never kept: the stores hold a per-instance transaction pointer (B2 L8). */
export function adminLoginContext(strapi: Core.Strapi, koa: KoaContext): AdminLoginContext {
  const store = strapiSecurityStore(strapi);
  const now = (): Date => new Date();
  const secure = process.env.NODE_ENV === 'production' && koa.request.secure;
  const sendSecurity = securityMailSender(strapi);
  const c: AdminLoginContext = {
    strapi, koa, store, now, secure,
    keys: loadKeys(),
    log: (m) => strapi.log.error(m),
    mail: (to, kind, data) => sendSecurity(to, { kind, data } as SecurityMail),
    portalMail: portalMailSender(strapi),
    limits: adminLimits(limiter(strapiPortalStore(strapi), now)),
    ip: clientIp({ 'x-portal-client-ip': koa.request.ip }),
    userAgent: userAgent({ 'x-portal-user-agent': koa.request.headers['user-agent'] }),
    actor: 'sistem',
    endSessions: (s, o) => endAdminSessions(c, Number(s.id), o),
    forgetDevices: (s, o) => forgetDevices(store, s, o),
    compare: (p, h) => bcrypt.compare(p, h),
    common: loadCommonPasswords(strapi.dirs.app.root),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...cookieHelpers(koa, secure),
  };
  return c;
}
