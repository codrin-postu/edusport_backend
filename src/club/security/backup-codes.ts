import crypto from 'node:crypto';

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 10;

const newBackupCode = (): string => Array.from({ length: CODE_LENGTH }, () => CROCKFORD[crypto.randomInt(CROCKFORD.length)]).join('');

/** `n` distinct codes of 10 Crockford base32 characters, each character from the CSPRNG (50 bits per code). */
export function newBackupCodes(n = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < n) codes.add(newBackupCode());
  return [...codes];
}

export const formatBackupCode = (c: string): string => `${c.slice(0, 5)} ${c.slice(5)}`;
