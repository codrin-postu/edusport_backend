import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const INVITE_TTL_MS = 7 * 24 * 3600_000;
export const RESET_TTL_MS = 10 * 60_000;
export const RESET_MAX_TRIES = 5;

export const newInviteSecret = (): string => randomBytes(32).toString('base64url');
export const newResetCode = (): string => String(randomInt(1_000_000)).padStart(6, '0');
export const newDeviceKey = (): string => randomBytes(32).toString('base64url');
export const hashSecret = (s: string): string => createHash('sha256').update(s).digest('hex');

export type TokenState = 'valid' | 'expired' | 'used';

export function tokenState(
  t: { expiresAt: string; usedAt: string | null; tries: number; kind: 'invite' | 'reset' },
  now: Date,
): TokenState {
  if (t.usedAt !== null) return 'used';
  if (t.kind === 'reset' && t.tries >= RESET_MAX_TRIES) return 'used';
  return now.getTime() >= Date.parse(t.expiresAt) ? 'expired' : 'valid';
}

export const sameHash = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
