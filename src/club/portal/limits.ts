export type LimitRule = { max: number; windowMs: number; lockMs: number | null };

export const LOGIN_RULE: LimitRule = { max: 5, windowMs: 900_000, lockMs: 900_000 };
export const IP_RULE: LimitRule = { max: 30, windowMs: 900_000, lockMs: null };
export const MAIL_RULE: LimitRule = { max: 5, windowMs: 3_600_000, lockMs: null };
/** One new-device mail per account per hour (a leaked password must not flood the owner, nor let a stranger make noise without limit). */
export const NEW_DEVICE_MAIL_RULE: LimitRule = { max: 1, windowMs: 3_600_000, lockMs: null };

export type LimitState = { count: number; windowStart: string; lockedUntil: string | null; notifiedAt: string | null };
export type HitOutcome = { state: LimitState; blocked: boolean; firstLock: boolean };

const EMAIL_MAX = 254;
const EMAIL_MIN = 3;

export const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < EMAIL_MIN || email.length > EMAIL_MAX) return null;
  const parts = email.split('@');
  return parts.length === 2 && parts[0] !== '' && parts[1] !== '' ? email : null;
};

export const loginKey = (email: string): string => `login:${email}`;
export const ipKey = (ip: string): string => `ip:${ip}`;
export const mailKey = (email: string): string => `mail:${email}`;

export function isLocked(s: LimitState | null, rule: LimitRule, now: Date): boolean {
  if (!s || rule.lockMs === null || s.lockedUntil === null) return false;
  return Date.parse(s.lockedUntil) > now.getTime();
}

const freshWindow = (s: LimitState | null, rule: LimitRule, now: Date): LimitState => {
  if (s && now.getTime() - Date.parse(s.windowStart) < rule.windowMs) return s;
  return { count: 0, windowStart: now.toISOString(), lockedUntil: null, notifiedAt: s?.notifiedAt ?? null };
};

export function afterHit(s: LimitState | null, rule: LimitRule, now: Date): HitOutcome {
  if (s && isLocked(s, rule, now)) return { state: s, blocked: true, firstLock: false };
  const base = freshWindow(s, rule, now);
  const count = base.count + 1;
  if (rule.lockMs === null) return { state: { ...base, count }, blocked: count > rule.max, firstLock: false };
  if (count < rule.max) return { state: { ...base, count }, blocked: false, firstLock: false };
  const firstLock = base.notifiedAt === null || now.getTime() - Date.parse(base.notifiedAt) >= rule.windowMs;
  const state: LimitState = {
    count,
    windowStart: base.windowStart,
    lockedUntil: new Date(now.getTime() + rule.lockMs).toISOString(),
    notifiedAt: firstLock ? now.toISOString() : base.notifiedAt,
  };
  return { state, blocked: true, firstLock };
}

export const afterSuccess = (now: Date): LimitState => ({
  count: 0,
  windowStart: now.toISOString(),
  lockedUntil: null,
  notifiedAt: null,
});
