import { codeMac, macMatchesAny, packMac, tokenMac, unpackMac } from './code-mac';
import type { Keys } from './keys';

export type CodePurposeRow = 'email-code' | 'reset-code';
export type ChallengeRow = {
  id: string;
  purpose: string;
  subjectType: 'portal' | 'admin';
  subjectId: string;
  /** Packed MAC of the high-entropy pending-login token: the only unique key of the row. */
  secretMac: string;
  /** `codeMac`: packed MAC of the 6-digit code; never a unique column, so a repeated code never collides. */
  data: { codeMac: string };
  expiresAt: Date;
  usedAt: Date | null;
  tries: number;
};
export type NewChallenge = Omit<ChallengeRow, 'id' | 'usedAt' | 'tries'>;

/** Store contract: both writes are single guarded UPDATEs that report whether one row changed. */
export type ChallengeStore = {
  findBySecretMacs(macs: string[]): Promise<ChallengeRow | null>;
  /** `tries = tries + 1 where used_at is null and tries < max and expires_at > now`; true when a row changed. */
  bumpTries(id: string, now: Date, max: number): Promise<boolean>;
  /** `used_at = now where id = ? and used_at is null`; true when a row changed. */
  consumeOnce(id: string, now: Date): Promise<boolean>;
};

export type ChallengeVerdict = 'ok' | 'bad-code' | 'unknown-or-ended';

/** The row to insert for a code sent to a subject, keyed by the token the browser holds. */
export function newCodeChallenge(
  k: Keys,
  purpose: CodePurposeRow,
  subject: { type: 'portal' | 'admin'; id: string },
  token: string,
  code: string,
  expiresAt: Date,
): NewChallenge & { purpose: CodePurposeRow } {
  return {
    purpose,
    subjectType: subject.type,
    subjectId: subject.id,
    secretMac: packMac(tokenMac(k.code, token)),
    data: { codeMac: packMac(codeMac(k, purpose, subject.type, subject.id, code)) },
    expiresAt,
  };
}

/**
 * One typed code against the challenge named by `token`. The row is found by the token, tries goes up by compare-and-set before
 * the comparison (so every wrong code counts and the limit holds under parallel requests), a right code is consumed once.
 */
export async function verifyChallengeCode(
  store: ChallengeStore,
  k: Keys,
  token: string,
  typed: string,
  now: Date,
  maxTries: number,
): Promise<ChallengeVerdict> {
  const keys = [k.code, k.codeOld].filter((key) => key !== null);
  const row = await store.findBySecretMacs(keys.map((key) => packMac(tokenMac(key, token))));
  if (!row || row.usedAt !== null || row.expiresAt.getTime() <= now.getTime()) return 'unknown-or-ended';
  if (!(await store.bumpTries(row.id, now, maxTries))) return 'unknown-or-ended';
  const stored = unpackMac(row.data.codeMac);
  const purpose = row.purpose as CodePurposeRow;
  const hit = stored && macMatchesAny(k, purpose, row.subjectType, row.subjectId, typed, [{ id: row.id, ...stored }]);
  if (!hit) return 'bad-code';
  return (await store.consumeOnce(row.id, now)) ? 'ok' : 'unknown-or-ended';
}
