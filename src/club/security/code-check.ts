import { macMatchesAny, unpackMac } from './code-mac';
import { EMAIL_CODE_MAX_TRIES } from './email-code';
import type { Keys } from './keys';
import type { ChallengeRow, SecurityStore } from './store';

export type RowVerdict = 'ok' | 'bad-code' | 'ended';

/**
 * One typed code against a known code challenge (M2): tries goes up by a guarded UPDATE before the comparison, so every wrong
 * code counts and the limit holds under parallel requests; a right code is consumed once.
 */
export async function checkRowCode(store: SecurityStore, keys: Keys, row: ChallengeRow, typed: string, now: Date): Promise<RowVerdict> {
  if (row.usedAt !== null || Date.parse(row.expiresAt) <= now.getTime() || row.subject === null) return 'ended';
  if (!(await store.bumpTries(row.id, now, EMAIL_CODE_MAX_TRIES))) return 'ended';
  const stored = unpackMac(String(row.data.codeMac ?? ''));
  const hit = stored !== null && macMatchesAny(keys, row.purpose === 'reset-code' ? 'reset-code' : 'email-code', row.subject.type, row.subject.id, typed, [{ id: row.id, ...stored }]);
  if (!hit) return 'bad-code';
  return (await store.consumeOnce('challenge', row.id, now.toISOString())) ? 'ok' : 'ended';
}
