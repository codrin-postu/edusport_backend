import { createHmac, timingSafeEqual } from 'node:crypto';
import { isSafeDocumentId } from './storage';

/** The success-screen download link works for 24 hours (spec 3.4); after that the PDF is in the e-mail. */
export const DOWNLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DEV_SECRET = 'edusport-local-document-token-secret-not-for-production';

export class DocumentTokenSecretMissingError extends Error {
  constructor() {
    super('DOCUMENT_TOKEN_SECRET is not set (at least 32 characters required in production)');
    this.name = 'DocumentTokenSecretMissingError';
  }
}

/** The HMAC key: env DOCUMENT_TOKEN_SECRET (32+ chars). Outside production a fixed local key is used when unset. */
export function documentTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = (env.DOCUMENT_TOKEN_SECRET ?? '').trim();
  if (secret.length >= 32) return secret;
  return env.NODE_ENV === 'production' ? null : DEV_SECRET;
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** `<base64url(id.expiresAtMs)>.<hmac>`: names one registration, expires 24 h after `now`. */
export function createDownloadToken(registrationDocumentId: string, now: Date = new Date()): string {
  const secret = documentTokenSecret();
  if (!secret) throw new DocumentTokenSecretMissingError();
  if (!isSafeDocumentId(registrationDocumentId)) throw new Error('Invalid registration id');
  const payload = Buffer.from(`${registrationDocumentId}.${now.getTime() + DOWNLOAD_TOKEN_TTL_MS}`).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function signatureMatches(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The registration a token names, or null when it is malformed, forged, or older than 24 hours. */
export function verifyDownloadToken(token: unknown, now: Date = new Date()): { registrationDocumentId: string } | null {
  const secret = documentTokenSecret();
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (!secret || parts.length !== 2 || !signatureMatches(parts[0], parts[1], secret)) return null;
  const [id, expires] = Buffer.from(parts[0], 'base64url').toString('utf8').split('.');
  if (!isSafeDocumentId(id) || !(Number(expires) > now.getTime())) return null;
  return { registrationDocumentId: id };
}
