import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PORTAL_ERRORS } from './copy';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
const LIST = join('data', 'portal', 'common-passwords.txt');

export function checkPassword(password: unknown, email: string, common: ReadonlySet<string>): string | null {
  if (typeof password !== 'string') return PORTAL_ERRORS.invalid;
  const length = [...password].length;
  if (length < MIN_LENGTH) return PORTAL_ERRORS.passwordShort;
  if (length > MAX_LENGTH) return PORTAL_ERRORS.passwordLong;
  const lower = password.toLowerCase();
  if (common.has(lower) || lower === email.trim().toLowerCase()) return PORTAL_ERRORS.passwordWeak;
  return null;
}

const cache = new Map<string, ReadonlySet<string>>();

export function loadCommonPasswords(rootDir: string): ReadonlySet<string> {
  const cached = cache.get(rootDir);
  if (cached) return cached;
  let text: string;
  try {
    text = readFileSync(join(rootDir, LIST), 'utf8');
  } catch {
    throw new Error('[portal] common password list missing');
  }
  const set: ReadonlySet<string> = new Set(text.split('\n').map((l) => l.trim()).filter((l) => l !== ''));
  cache.set(rootDir, set);
  return set;
}
