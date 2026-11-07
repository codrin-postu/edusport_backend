import crypto from 'node:crypto';

export const EMAIL_CODE_TTL_MS = 600_000;
export const EMAIL_CODE_MAX_TRIES = 5;

export const newEmailCode = (): string => String(crypto.randomInt(1_000_000)).padStart(6, '0');
