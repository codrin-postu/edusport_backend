import { createHash, timingSafeEqual } from 'node:crypto';

export const BFF_HEADERS = {
  secret: 'x-portal-secret',
  ip: 'x-portal-client-ip',
  userAgent: 'x-portal-user-agent',
  device: 'x-portal-device',
} as const;

type Headers = Record<string, string | string[] | undefined>;

const SECRET_MIN = 32;
const IP_MAX = 64;
const UA_MAX = 512;

const first = (v: string | string[] | undefined): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s : null;
};

const sha = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time compare on the sha256 of both sides; false when the env secret is unset or too short. */
export function isBffCall(headers: Headers, secret: string | undefined): boolean {
  if (!secret || secret.length < SECRET_MIN) return false;
  const given = first(headers[BFF_HEADERS.secret]);
  if (given === null) return false;
  return timingSafeEqual(sha(given), sha(secret));
}

export function clientIp(headers: Headers): string {
  const v = first(headers[BFF_HEADERS.ip])?.trim();
  return v && v.length <= IP_MAX ? v : 'unknown';
}

export function userAgent(headers: Headers): string | null {
  const v = first(headers[BFF_HEADERS.userAgent])?.trim();
  return v ? v.slice(0, UA_MAX) : null;
}

export const PORTAL_HOSTS = (env: NodeJS.ProcessEnv = process.env): string[] => {
  const hosts = (env.PORTAL_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return hosts.length ? hosts : ['antrenor'];
};

/**
 * Portal second factor and passkeys (user decision 2026-11-11: coach and student portals sign in with e-mail + password or Google only).
 * `PORTAL_2FA=on` turns them back on; anything else is off. The admin panel's own 2FA is not affected.
 */
export const portalTwoFactorOn = (env: NodeJS.ProcessEnv = process.env): boolean => (env.PORTAL_2FA ?? '').trim().toLowerCase() === 'on';
