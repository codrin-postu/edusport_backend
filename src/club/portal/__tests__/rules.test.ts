import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deviceLabel } from '../devices';
import { afterHit, afterSuccess, isLocked, IP_RULE, LOGIN_RULE, loginKey, MAIL_RULE, normalizeEmail, type LimitState } from '../limits';
import { checkPassword, loadCommonPasswords } from '../passwords';
import { PORTAL_ERRORS } from '../copy';
import { hashSecret, newDeviceKey, newInviteSecret, newResetCode, sameHash, tokenState } from '../tokens';
import { canCoachCorrect } from '../window';

const ROOT = join(__dirname, '..', '..', '..', '..');

describe('window', () => {
  it('correction window: spec 8.3 and DST', () => {
    expect(canCoachCorrect('2026-10-06', '2026-10-13')).toBe(true);   // spec 8.3 example, day 7
    expect(canCoachCorrect('2026-10-06', '2026-10-14')).toBe(false);  // day 8
    expect(canCoachCorrect('2026-10-20', '2026-10-27')).toBe(true);   // DST ends 25 Oct inside the week
    expect(canCoachCorrect('2026-10-20', '2026-10-28')).toBe(false);
    expect(canCoachCorrect('2026-10-06', '2026-10-06')).toBe(true);
  });
});

describe('limits', () => {
  const t0 = new Date('2026-11-04T10:00:00Z');
  it('login: 5th wrong try locks for 15 minutes and notifies once', () => {
    let s: LimitState | null = null;
    for (let i = 1; i <= 4; i += 1) s = afterHit(s, LOGIN_RULE, t0).state;
    const fifth = afterHit(s, LOGIN_RULE, t0);
    expect(fifth).toMatchObject({ blocked: true, firstLock: true });
    expect(fifth.state.lockedUntil).toBe('2026-11-04T10:15:00.000Z');
    expect(isLocked(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:14:59Z'))).toBe(true);
    expect(isLocked(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:15:00Z'))).toBe(false);
    expect(afterHit(fifth.state, LOGIN_RULE, new Date('2026-11-04T10:05:00Z')).firstLock).toBe(false); // during the pause
  });
  it('a window that ran out starts again at 1', () => {
    expect(afterHit({ count: 4, windowStart: '2026-11-04T09:00:00.000Z', lockedUntil: null, notifiedAt: null }, LOGIN_RULE, t0).state.count).toBe(1);
  });
  it('ip: 30 pass, the 31st is blocked, no lockedUntil', () => {
    let s: LimitState | null = null;
    for (let i = 1; i <= 30; i += 1) {
      const out = afterHit(s, IP_RULE, t0);
      expect(out.blocked).toBe(false);
      s = out.state;
    }
    const thirtyFirst = afterHit(s, IP_RULE, t0);
    expect(thirtyFirst).toMatchObject({ blocked: true, firstLock: false });
    expect(thirtyFirst.state.lockedUntil).toBeNull();
  });
  it('mail: 5 per hour, 6th blocked', () => {
    let s: LimitState | null = null;
    for (let i = 1; i <= 5; i += 1) s = afterHit(s, MAIL_RULE, t0).state;
    expect(afterHit(s, MAIL_RULE, t0).blocked).toBe(true);
  });
  it('success starts a clean window', () => {
    expect(afterSuccess(t0)).toEqual({ count: 0, windowStart: '2026-11-04T10:00:00.000Z', lockedUntil: null, notifiedAt: null });
  });
  it('email and keys', () => {
    expect(normalizeEmail('  Antrenor1@Example.Invalid ')).toBe('antrenor1@example.invalid');
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail('a'.repeat(250) + '@x.ro')).toBeNull();
    expect(loginKey('a@b.ro')).toBe('login:a@b.ro');
  });
});

describe('passwords', () => {
  const common = new Set(['parola12345', 'qwertyuiop']);
  it('checks length, common list and e-mail', () => {
    expect(checkPassword('scurt', 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordShort);
    expect(checkPassword('x'.repeat(129), 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordLong);
    expect(checkPassword('Parola12345', 'a@b.ro', common)).toBe(PORTAL_ERRORS.passwordWeak); // case-insensitive list
    expect(checkPassword('antrenor1@example.invalid', 'antrenor1@example.invalid', common)).toBe(PORTAL_ERRORS.passwordWeak);
    expect(checkPassword('patine-albastre-7', 'a@b.ro', common)).toBeNull();
    expect(checkPassword('ăîșțâăîșțâ', 'a@b.ro', common)).toBeNull(); // 10 characters, counted as code points
  });
  it('shipped common list has at least 90 000 lines and 123456', () => {
    const text = readFileSync(join(ROOT, 'data', 'portal', 'common-passwords.txt'), 'utf8');
    expect(text.split('\n').filter((l) => l !== '').length).toBeGreaterThanOrEqual(90_000);
    expect(loadCommonPasswords(ROOT).has('123456')).toBe(true);
  });
  it('a missing list fails loudly', () => {
    expect(() => loadCommonPasswords(join(ROOT, 'no-such-dir'))).toThrow('[portal] common password list missing');
  });
});

describe('tokens', () => {
  const t0 = new Date('2026-11-04T10:00:00Z');
  it('secrets and hashes', () => {
    expect(newResetCode()).toMatch(/^\d{6}$/);
    expect(newInviteSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newDeviceKey()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSecret('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sameHash(hashSecret('abc'), hashSecret('abc'))).toBe(true);
    expect(sameHash(hashSecret('abc'), hashSecret('abd'))).toBe(false);
    expect(sameHash('ab', 'abcd')).toBe(false);
  });
  it('token states', () => {
    expect(tokenState({ kind: 'reset', expiresAt: '2026-11-04T10:10:00Z', usedAt: null, tries: 0 }, t0)).toBe('valid');
    expect(tokenState({ kind: 'reset', expiresAt: '2026-11-04T10:10:00Z', usedAt: null, tries: 5 }, t0)).toBe('used');
    expect(tokenState({ kind: 'invite', expiresAt: '2026-11-04T09:59:59Z', usedAt: null, tries: 0 }, t0)).toBe('expired');
  });
});

describe('devices', () => {
  it('labels the device and browser', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Telefon, Safari');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36')).toBe('Telefon, Chrome');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Calculator, Edge');
    expect(deviceLabel('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/121.0')).toBe('Calculator, Firefox');
    expect(deviceLabel('Mozilla/5.0 (iPad; CPU OS 17_0) Version/17.0 Safari/604.1')).toBe('Tabletă, Safari');
    expect(deviceLabel(null)).toBe('Dispozitiv necunoscut');
  });
});
