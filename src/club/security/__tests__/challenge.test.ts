import { describe, expect, it } from 'vitest';
import { newCodeChallenge, verifyChallengeCode, type ChallengeRow, type ChallengeStore } from '../challenge';
import { codeMac, packMac, tokenMac } from '../code-mac';
import { EMAIL_CODE_MAX_TRIES } from '../email-code';
import { ROTATED_KEYS, TEST_KEYS } from './keys';

const NOW = new Date('2026-11-07T10:00:00Z');
const LATER = new Date(NOW.getTime() + 600_000);
const subject = { type: 'admin', id: '7' } as const;

/** In-memory store with the same guarded-update semantics as the real one and a unique secretMac. */
function memoryStore() {
  const rows: ChallengeRow[] = [];
  let seq = 0;
  const store: ChallengeStore & { insert(r: ReturnType<typeof newCodeChallenge>): ChallengeRow; rows: ChallengeRow[] } = {
    rows,
    insert(r) {
      if (rows.some((x) => x.secretMac === r.secretMac)) throw new Error('unique secretMac');
      const row: ChallengeRow = { ...r, id: `c${(seq += 1)}`, usedAt: null, tries: 0 };
      rows.push(row);
      return row;
    },
    async findBySecretMacs(macs) {
      return rows.find((r) => macs.includes(r.secretMac)) ?? null;
    },
    async bumpTries(id, now, max) {
      const row = rows.find((r) => r.id === id);
      if (!row || row.usedAt !== null || row.tries >= max || row.expiresAt.getTime() <= now.getTime()) return false;
      row.tries += 1;
      return true;
    },
    async consumeOnce(id, now) {
      const row = rows.find((r) => r.id === id);
      if (!row || row.usedAt !== null) return false;
      row.usedAt = now;
      return true;
    },
  };
  return store;
}

const issue = (store: ReturnType<typeof memoryStore>, token: string, code: string, keys = TEST_KEYS) =>
  store.insert(newCodeChallenge(keys, 'email-code', subject, token, code, LATER));

describe('code challenges', () => {
  it('the row is keyed by the token MAC and the code MAC sits in data, in m1 form', () => {
    const r = newCodeChallenge(TEST_KEYS, 'email-code', subject, 'tok-1', '123456', LATER);
    expect(r.secretMac).toBe(packMac(tokenMac(TEST_KEYS.code, 'tok-1')));
    expect(r.data.codeMac).toBe(packMac(codeMac(TEST_KEYS, 'email-code', 'admin', '7', '123456')));
    expect(r.secretMac).not.toBe(r.data.codeMac);
    expect(JSON.stringify(r)).not.toContain('123456');
  });

  it('the same 6-digit code issued twice never meets a unique constraint', () => {
    const store = memoryStore();
    issue(store, 'tok-a', '123456');
    expect(() => issue(store, 'tok-b', '123456')).not.toThrow();
    expect(store.rows[0].data.codeMac).toBe(store.rows[1].data.codeMac);
  });

  it('a right code opens once, a second use is refused', async () => {
    const store = memoryStore();
    issue(store, 'tok', '123456');
    expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '123 456', NOW, EMAIL_CODE_MAX_TRIES)).toBe('ok');
    expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '123456', NOW, EMAIL_CODE_MAX_TRIES)).toBe('unknown-or-ended');
  });

  it('tries rises on every wrong code and the 5-try limit holds, even for the right code afterwards', async () => {
    const store = memoryStore();
    const row = issue(store, 'tok', '123456');
    for (let i = 1; i <= EMAIL_CODE_MAX_TRIES; i += 1) {
      expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '000000', NOW, EMAIL_CODE_MAX_TRIES)).toBe('bad-code');
      expect(row.tries).toBe(i);
    }
    expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '123456', NOW, EMAIL_CODE_MAX_TRIES)).toBe('unknown-or-ended');
    expect(row.usedAt).toBeNull();
  });

  it('an unknown token and an expired row are refused without touching tries', async () => {
    const store = memoryStore();
    const row = issue(store, 'tok', '123456');
    expect(await verifyChallengeCode(store, TEST_KEYS, 'other', '123456', NOW, 5)).toBe('unknown-or-ended');
    expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '123456', new Date(LATER.getTime() + 1), 5)).toBe('unknown-or-ended');
    expect(row.tries).toBe(0);
  });

  it('parallel use of one right code opens once', async () => {
    const store = memoryStore();
    issue(store, 'tok', '123456');
    const results = await Promise.all(Array.from({ length: 5 }, () => verifyChallengeCode(store, TEST_KEYS, 'tok', '123456', NOW, 5)));
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
  });

  it('a code of another subject or purpose does not open the row', async () => {
    const store = memoryStore();
    const row = issue(store, 'tok', '123456');
    row.subjectId = '8';
    expect(await verifyChallengeCode(store, TEST_KEYS, 'tok', '123456', NOW, 5)).toBe('bad-code');
  });

  it('a row issued under the old key still verifies after rotation', async () => {
    const store = memoryStore();
    issue(store, 'tok', '123456', TEST_KEYS);
    expect(await verifyChallengeCode(store, ROTATED_KEYS, 'tok', '123456', NOW, 5)).toBe('ok');
  });

  it('the challenge schema keeps secretMac unique and has no unique on the code', () => {
    // data.codeMac is json inside `data`, not a column: nothing to collide.
    expect(Object.keys(newCodeChallenge(TEST_KEYS, 'reset-code', subject, 't', '1', LATER))).not.toContain('codeMac');
  });
});
