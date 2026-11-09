import { createHash } from 'node:crypto';

export type Key = { id: string; bytes: Buffer };
export type Keys = { secret: Key; secretOld: Key | null; code: Key; codeOld: Key | null };

export class KeysMissing extends Error {
  constructor() {
    super('AUTH_SECRET_KEY and AUTH_CODE_KEY must be set to 32 random bytes, base64');
    this.name = 'KeysMissing';
  }
}

const KEY_BYTES = 32;

export const keyId = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex').slice(0, 8);

const STRICT_BASE64 = /^[A-Za-z0-9+/]{43}=$/;
const MIN_DISTINCT_BYTES = 16;
const STRAPI_SECRETS = ['ENCRYPTION_KEY', 'ADMIN_JWT_SECRET', 'JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT'] as const;

/** A key from base64 text: exactly 32 bytes, else null. In production the text must be strict base64 and the bytes not a fixture-like repeat. */
function readKey(value: string | undefined, production: boolean): Key | null {
  const text = value?.trim();
  if (!text) return null;
  if (production && !STRICT_BASE64.test(text)) return null;
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length !== KEY_BYTES) return null;
  if (production && new Set(bytes).size < MIN_DISTINCT_BYTES) return null;
  return { id: keyId(bytes), bytes };
}

/** An optional old key: unset is fine, set but malformed refuses the whole set (rows sealed under it would silently stop opening). */
function readOldKey(value: string | undefined, production: boolean): { ok: boolean; key: Key | null } {
  if (!value || value.trim() === '') return { ok: true, key: null };
  const key = readKey(value, production);
  return { ok: key !== null, key };
}

/** Strapi's own secrets are never reused: a rotation of one must not break the other. */
function reusesStrapiSecret(env: NodeJS.ProcessEnv, values: (string | undefined)[]): boolean {
  const strapi = [...STRAPI_SECRETS.map((name) => env[name]), ...(env.APP_KEYS ?? '').split(',')]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  return values.some((v) => v !== undefined && strapi.includes(v.trim()));
}

/**
 * Null when either current key is missing or not 32 bytes, when any two of the four slots hold the same key
 * (so no key serves both AES and HMAC), when a key is a Strapi secret, or, in production, when a key is loose
 * base64 or has under 16 distinct bytes. Logs nothing.
 */
export function loadKeys(env: NodeJS.ProcessEnv = process.env): Keys | null {
  const production = env.NODE_ENV === 'production';
  const secret = readKey(env.AUTH_SECRET_KEY, production);
  const code = readKey(env.AUTH_CODE_KEY, production);
  if (!secret || !code) return null;
  if (reusesStrapiSecret(env, [env.AUTH_SECRET_KEY, env.AUTH_CODE_KEY, env.AUTH_SECRET_KEY_OLD, env.AUTH_CODE_KEY_OLD])) return null;
  const secretOld = readOldKey(env.AUTH_SECRET_KEY_OLD, production);
  const codeOld = readOldKey(env.AUTH_CODE_KEY_OLD, production);
  if (!secretOld.ok || !codeOld.ok) return null;
  const ids = [secret, secretOld.key, code, codeOld.key].filter((k): k is Key => k !== null).map((k) => k.id);
  if (new Set(ids).size !== ids.length) return null;
  return { secret, secretOld: secretOld.key, code, codeOld: codeOld.key };
}

export function requireKeys(k: Keys | null): Keys {
  if (!k) throw new KeysMissing();
  return k;
}

/** Boot guard: production refuses to start without usable keys; elsewhere a missing set only turns 2FA off (503 on its routes). */
export function assertKeysForBoot(env: NodeJS.ProcessEnv = process.env): Keys | null {
  const keys = loadKeys(env);
  if (!keys && env.NODE_ENV === 'production') throw new KeysMissing();
  return keys;
}
