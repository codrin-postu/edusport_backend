import crypto from 'node:crypto';
import type { Key, Keys } from './keys';

export type CodePurpose = 'backup' | 'email-code' | 'reset-code' | 'pending-login' | 'passkey';
export type StoredMac = { mac: string; keyId: string };

const MAC_BYTES = 32;
const PACKED = /^m1:([0-9a-f]{8}):([0-9a-f]{64})$/;

/** Upper case, spaces and hyphens removed, O read as 0, I and L as 1. */
export const normalizeCode = (raw: string): string =>
  raw.replace(/[\s-]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');

/** One column form of a MAC, `m1:<keyId>:<hex>` (the prefix keeps an old plain SHA-256 value from ever being read as a MAC). */
export const packMac = (m: StoredMac): string => `m1:${m.keyId}:${m.mac}`;

export function unpackMac(packed: string): StoredMac | null {
  const match = PACKED.exec(packed);
  return match ? { keyId: match[1], mac: match[2] } : null;
}

/** Injective MAC input: every field is written as `<length>:<field>`, so no field can borrow characters from its neighbour. */
const encodeFields = (fields: string[]): string => fields.map((f) => `${f.length}:${f}`).join('');

const macWith = (key: Key, purpose: CodePurpose, subjectType: string, subjectId: string, code: string): Buffer =>
  crypto.createHmac('sha256', key.bytes).update(encodeFields([purpose, subjectType, subjectId, normalizeCode(code)])).digest();

/** MAC of a high-entropy random token (a pending-login secret): no normalization, its own domain. */
export const tokenMac = (key: Key, token: string): StoredMac => ({
  mac: crypto.createHmac('sha256', key.bytes).update(encodeFields(['token', token])).digest('hex'),
  keyId: key.id,
});

export function codeMac(
  k: Keys,
  purpose: CodePurpose,
  subjectType: string,
  subjectId: string,
  code: string,
  which: 'current' | 'old' = 'current',
): StoredMac {
  const key = which === 'old' ? k.codeOld : k.code;
  if (!key) throw new Error('no old code key is loaded');
  return { mac: macWith(key, purpose, subjectType, subjectId, code).toString('hex'), keyId: key.id };
}

type Row = { id: string; mac: string; keyId: string };

/** Id of the row whose MAC matches the typed code. One MAC per key id present, then a constant-time compare against every row, no early exit. */
export function macMatchesAny(k: Keys, purpose: CodePurpose, subjectType: string, subjectId: string, typed: string, rows: Row[]): string | null {
  const typedByKey = new Map<string, Buffer>();
  for (const key of [k.code, k.codeOld]) {
    if (key && rows.some((r) => r.keyId === key.id)) typedByKey.set(key.id, macWith(key, purpose, subjectType, subjectId, typed));
  }
  const blank = Buffer.alloc(MAC_BYTES);
  let found: string | null = null;
  for (const row of rows) {
    const want = typedByKey.get(row.keyId);
    const have = Buffer.from(row.mac, 'hex');
    const comparable = want !== undefined && have.length === MAC_BYTES;
    const equal = crypto.timingSafeEqual(comparable ? want : blank, comparable ? have : blank);
    if (equal && comparable && found === null) found = row.id;
  }
  return found;
}
