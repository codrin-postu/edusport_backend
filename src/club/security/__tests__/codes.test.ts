import nodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROCKFORD, formatBackupCode, newBackupCodes } from '../backup-codes';
import { EMAIL_CODE_MAX_TRIES, EMAIL_CODE_TTL_MS, newEmailCode } from '../email-code';
import { qrSvg } from '../qr';
import { base32, checkTotp, groupedKey, newTotpSecret, otpauthUrl, totpAt, TOTP_DIGITS, TOTP_STEP_S } from '../totp';

afterEach(() => vi.restoreAllMocks());

const RFC_SECRET = Buffer.from('12345678901234567890');
const stepOf = (seconds: number): number => Math.floor(seconds / TOTP_STEP_S);

describe('TOTP RFC 6238 appendix B (SHA-1, 6 digits)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('T = %i gives %s', (seconds, code) => {
    expect(totpAt(RFC_SECRET, stepOf(seconds))).toBe(code);
  });

  it('constants', () => {
    expect([TOTP_STEP_S, TOTP_DIGITS]).toEqual([30, 6]);
  });
});

describe('checkTotp', () => {
  const now = new Date(1234567890 * 1000);
  const step = stepOf(1234567890);

  it('accepts the current step and one either side, refuses two away', () => {
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now, null)).toBe(step);
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now, null)).toBe(step + 1);
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 2), now, null)).toBeNull();
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 2), now, null)).toBeNull();
  });

  it('replay at the same step is refused', () => {
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step), now, step)).toBeNull();
  });

  it('a code of an earlier step than lastStep is refused, a later step is accepted', () => {
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now, step)).toBeNull();
    expect(checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), now, step)).toBe(step + 1);
  });

  it('codes not of 6 digits are refused without computing', () => {
    const hmac = vi.spyOn(nodeCrypto, 'createHmac');
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5', '12345a', '١٢٣٤٥٦']) {
      expect(checkTotp(RFC_SECRET, bad, now, null)).toBeNull();
    }
    expect(hmac).not.toHaveBeenCalled();
  });

  it('spaces inside a 6-digit code are ignored', () => {
    const code = totpAt(RFC_SECRET, step);
    expect(checkTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now, null)).toBe(step);
  });

  it('a wrong code and the code of another secret are refused', () => {
    expect(checkTotp(RFC_SECRET, '000000' === totpAt(RFC_SECRET, step) ? '000001' : '000000', now, null)).toBeNull();
    expect(checkTotp(newTotpSecret(), totpAt(RFC_SECRET, step), now, null)).toBeNull();
  });

  it('compares all three candidate steps (no early exit)', () => {
    const spy = vi.spyOn(nodeCrypto, 'timingSafeEqual');
    checkTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), now, null);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('secrets and keys', () => {
  it('newTotpSecret is 20 random bytes', () => {
    const a = newTotpSecret();
    expect(a).toHaveLength(20);
    expect(a.equals(newTotpSecret())).toBe(false);
  });

  it('base32 follows RFC 4648 without padding', () => {
    expect(base32(Buffer.from(''))).toBe('');
    expect(base32(Buffer.from('f'))).toBe('MY');
    expect(base32(Buffer.from('fo'))).toBe('MZXQ');
    expect(base32(Buffer.from('foo'))).toBe('MZXW6');
    expect(base32(Buffer.from('foob'))).toBe('MZXW6YQ');
    expect(base32(Buffer.from('fooba'))).toBe('MZXW6YTB');
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('groupedKey is base32 in groups of 4, space separated', () => {
    expect(groupedKey(RFC_SECRET)).toBe('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ');
    expect(groupedKey(Buffer.from('fooba'))).toBe('MZXW 6YTB');
    expect(groupedKey(Buffer.from('foo'))).toBe('MZXW 6');
  });

  it('otpauthUrl', () => {
    expect(otpauthUrl('admin1@example.invalid', RFC_SECRET)).toBe(
      'otpauth://totp/EduSport:admin1@example.invalid?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=EduSport',
    );
    expect(otpauthUrl('a b+c@example.invalid', RFC_SECRET)).toContain('EduSport:a%20b%2Bc@example.invalid?');
  });
});

describe('backup codes', () => {
  it('10 distinct codes of 10 Crockford characters, each character from randomInt', () => {
    const spy = vi.spyOn(nodeCrypto, 'randomInt');
    const codes = newBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(spy).toHaveBeenCalledTimes(100);
    expect(spy.mock.calls.every(([max]) => max === 32)).toBe(true);
  });

  it('the alphabet has 32 characters without I, L, O, U', () => {
    expect(CROCKFORD).toHaveLength(32);
    expect(CROCKFORD).not.toMatch(/[ILOU]/);
  });

  it('newBackupCodes(n) gives n codes', () => {
    expect(newBackupCodes(3)).toHaveLength(3);
  });

  it('a collision draws a fresh code, so the set is still distinct', () => {
    let calls = 0;
    vi.spyOn(nodeCrypto, 'randomInt').mockImplementation(((_max: number) => (calls++ < 10 ? 0 : calls % 32)) as typeof nodeCrypto.randomInt);
    const codes = newBackupCodes(2);
    expect(new Set(codes).size).toBe(2);
  });

  it('formatBackupCode groups 5 and 5', () => {
    expect(formatBackupCode('ABCDEFGHJK')).toBe('ABCDE FGHJK');
  });
});

describe('e-mail code', () => {
  it('is 6 digits, zero padded', () => {
    for (let i = 0; i < 50; i += 1) expect(newEmailCode()).toMatch(/^\d{6}$/);
    vi.spyOn(nodeCrypto, 'randomInt').mockReturnValue(42);
    expect(newEmailCode()).toBe('000042');
  });

  it('draws from randomInt(1_000_000)', () => {
    const spy = vi.spyOn(nodeCrypto, 'randomInt');
    newEmailCode();
    expect(spy).toHaveBeenCalledWith(1_000_000);
  });

  it('lifetime and tries', () => {
    expect(EMAIL_CODE_TTL_MS).toBe(600_000);
    expect(EMAIL_CODE_MAX_TRIES).toBe(5);
  });
});

describe('qrSvg', () => {
  it('is an SVG and the URL is not written as text', async () => {
    const url = otpauthUrl('admin1@example.invalid', RFC_SECRET);
    const svg = await qrSvg(url);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('otpauth');
    expect(svg).not.toContain('GEZDGNBV');
  });
});
