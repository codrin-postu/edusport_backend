import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Key, Keys } from './keys';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const b64 = (b: Buffer): string => b.toString('base64url');

export const totpAad = (subjectType: 'portal' | 'admin', subjectId: string): string => `totp:${subjectType}:${subjectId}`;

/** AES-256-GCM under the current secret key; `aad` binds the box to its subject. Format `v1.<keyId>.<iv>.<ct>.<tag>`. */
export function seal(k: Keys, plain: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', k.secret.bytes, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [VERSION, k.secret.id, b64(iv), b64(ct), b64(cipher.getAuthTag())].join('.');
}

function keyFor(k: Keys, id: string): Key | null {
  if (k.secret.id === id) return k.secret;
  return k.secretOld && k.secretOld.id === id ? k.secretOld : null;
}

/** The plain bytes, or null for anything that does not authenticate (wrong key, other subject, edited box). `stale`: sealed under the old key, re-seal it. */
export function open(k: Keys, boxed: string, aad: string): { plain: Buffer; stale: boolean } | null {
  const parts = boxed.split('.');
  if (parts.length !== 5 || parts[0] !== VERSION) return null;
  const key = keyFor(k, parts[1]);
  if (!key) return null;
  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[4], 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key.bytes, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]);
    return { plain, stale: key.id !== k.secret.id };
  } catch {
    return null;
  }
}
