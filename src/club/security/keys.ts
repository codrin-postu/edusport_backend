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

/** A key from base64 text: exactly 32 bytes, else null (an unset or malformed variable). */
function readKey(value: string | undefined): Key | null {
  if (!value) return null;
  const bytes = Buffer.from(value.trim(), 'base64');
  return bytes.length === KEY_BYTES ? { id: keyId(bytes), bytes } : null;
}

/** An optional old key: unset is fine, set but malformed refuses the whole set (rows sealed under it would silently stop opening). */
function readOldKey(value: string | undefined): { ok: boolean; key: Key | null } {
  if (!value || value.trim() === '') return { ok: true, key: null };
  const key = readKey(value);
  return { ok: key !== null, key };
}

/** Strapi's own secrets are never reused: a rotation of one must not break the other. */
function reusesStrapiSecret(env: NodeJS.ProcessEnv, values: (string | undefined)[]): boolean {
  const strapi = [env.ENCRYPTION_KEY, ...(env.APP_KEYS ?? '').split(',')].map((v) => v?.trim()).filter((v): v is string => Boolean(v));
  return values.some((v) => v !== undefined && strapi.includes(v.trim()));
}

/** Null when either current key is missing or not 32 bytes, when they are the same key, or when a key is a Strapi secret. Logs nothing. */
export function loadKeys(env: NodeJS.ProcessEnv = process.env): Keys | null {
  const secret = readKey(env.AUTH_SECRET_KEY);
  const code = readKey(env.AUTH_CODE_KEY);
  if (!secret || !code || secret.id === code.id) return null;
  if (reusesStrapiSecret(env, [env.AUTH_SECRET_KEY, env.AUTH_CODE_KEY, env.AUTH_SECRET_KEY_OLD, env.AUTH_CODE_KEY_OLD])) return null;
  const secretOld = readOldKey(env.AUTH_SECRET_KEY_OLD);
  const codeOld = readOldKey(env.AUTH_CODE_KEY_OLD);
  if (!secretOld.ok || !codeOld.ok) return null;
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
