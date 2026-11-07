import nodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeMac, macMatchesAny, normalizeCode, packMac, tokenMac, unpackMac } from '../code-mac';
import { assertKeysForBoot, KeysMissing, keyId, loadKeys, requireKeys } from '../keys';
import { open, seal, totpAad } from '../secret-box';
import { OTHER_ENV, OTHER_KEYS, ROTATED_KEYS, TEST_ENV, TEST_KEYS } from './keys';

const b64 = (n: number, fill = 7) => Buffer.alloc(n, fill).toString('base64');

afterEach(() => vi.restoreAllMocks());

describe('loadKeys', () => {
  it.each([
    ['missing', {}],
    ['empty', { AUTH_SECRET_KEY: '', AUTH_CODE_KEY: '' }],
    ['secret 31 bytes', { AUTH_SECRET_KEY: b64(31), AUTH_CODE_KEY: b64(32, 9) }],
    ['code 33 bytes', { AUTH_SECRET_KEY: b64(32), AUTH_CODE_KEY: b64(33, 9) }],
    ['code missing', { AUTH_SECRET_KEY: b64(32) }],
    ['secret missing', { AUTH_CODE_KEY: b64(32) }],
    ['same key twice', { AUTH_SECRET_KEY: b64(32), AUTH_CODE_KEY: b64(32) }],
    ['a malformed old key', { ...TEST_ENV, AUTH_SECRET_KEY_OLD: b64(5) }],
    ['Strapi ENCRYPTION_KEY reused', { ...TEST_ENV, ENCRYPTION_KEY: TEST_ENV.AUTH_SECRET_KEY }],
    ['a Strapi app key reused', { ...TEST_ENV, APP_KEYS: `x,${TEST_ENV.AUTH_CODE_KEY}` }],
  ])('%s -> null', (_name, env) => {
    expect(loadKeys(env as NodeJS.ProcessEnv)).toBeNull();
  });

  it('two valid keys give 8 hex ids and no old keys', () => {
    const k = loadKeys(TEST_ENV);
    expect(k?.secret.id).toMatch(/^[0-9a-f]{8}$/);
    expect(k?.code.id).toMatch(/^[0-9a-f]{8}$/);
    expect(k?.secret.id).toBe(keyId(Buffer.alloc(32, 0x11)));
    expect(k?.secretOld).toBeNull();
    expect(k?.codeOld).toBeNull();
  });

  it('loads the _OLD keys when set', () => {
    expect(ROTATED_KEYS.secretOld?.id).toBe(TEST_KEYS.secret.id);
    expect(ROTATED_KEYS.codeOld?.id).toBe(TEST_KEYS.code.id);
  });

  it('requireKeys throws KeysMissing on null and returns the keys otherwise', () => {
    expect(() => requireKeys(null)).toThrow(KeysMissing);
    expect(requireKeys(TEST_KEYS)).toBe(TEST_KEYS);
  });

  it('production refuses to boot without keys, other environments do not', () => {
    expect(() => assertKeysForBoot({ NODE_ENV: 'production' })).toThrow(KeysMissing);
    expect(() => assertKeysForBoot({ NODE_ENV: 'production', ...TEST_ENV })).toThrow(KeysMissing);
    const real = { NODE_ENV: 'production', AUTH_SECRET_KEY: nodeCrypto.randomBytes(32).toString('base64'), AUTH_CODE_KEY: nodeCrypto.randomBytes(32).toString('base64') };
    expect(assertKeysForBoot(real)).not.toBeNull();
    expect(assertKeysForBoot({ NODE_ENV: 'development' })).toBeNull();
    expect(assertKeysForBoot({})).toBeNull();
  });

  it('a key shared across the four slots is refused, old keys included', () => {
    const o = OTHER_ENV;
    expect(loadKeys({ ...TEST_ENV, AUTH_CODE_KEY_OLD: TEST_ENV.AUTH_SECRET_KEY })).toBeNull();
    expect(loadKeys({ ...TEST_ENV, AUTH_SECRET_KEY_OLD: TEST_ENV.AUTH_CODE_KEY })).toBeNull();
    expect(loadKeys({ ...TEST_ENV, AUTH_SECRET_KEY_OLD: TEST_ENV.AUTH_SECRET_KEY })).toBeNull();
    expect(loadKeys({ ...TEST_ENV, AUTH_SECRET_KEY_OLD: o.AUTH_SECRET_KEY, AUTH_CODE_KEY_OLD: o.AUTH_SECRET_KEY })).toBeNull();
    expect(loadKeys({ ...TEST_ENV, AUTH_SECRET_KEY_OLD: o.AUTH_SECRET_KEY, AUTH_CODE_KEY_OLD: o.AUTH_CODE_KEY })).not.toBeNull();
  });

  it.each(['ADMIN_JWT_SECRET', 'JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT'])('%s reused as a key is refused', (name) => {
    expect(loadKeys({ ...TEST_ENV, [name]: TEST_ENV.AUTH_CODE_KEY })).toBeNull();
    expect(loadKeys({ ...TEST_ENV, AUTH_CODE_KEY_OLD: OTHER_ENV.AUTH_CODE_KEY, [name]: OTHER_ENV.AUTH_CODE_KEY })).toBeNull();
  });

  describe('production strictness', () => {
    const random = (): NodeJS.ProcessEnv => ({
      NODE_ENV: 'production',
      AUTH_SECRET_KEY: nodeCrypto.randomBytes(32).toString('base64'),
      AUTH_CODE_KEY: nodeCrypto.randomBytes(32).toString('base64'),
    });

    it('accepts random keys', () => {
      expect(loadKeys(random())).not.toBeNull();
    });

    it('refuses a key of one repeated byte (the fixture form), outside production it loads', () => {
      expect(loadKeys({ ...TEST_ENV, NODE_ENV: 'production' })).toBeNull();
      expect(loadKeys({ ...random(), AUTH_SECRET_KEY_OLD: TEST_ENV.AUTH_SECRET_KEY })).toBeNull();
      expect(loadKeys(TEST_ENV)).not.toBeNull();
    });

    it('refuses a key with under 16 distinct bytes', () => {
      const weak = Buffer.concat([nodeCrypto.randomBytes(10), Buffer.alloc(22, 1)]).toString('base64');
      expect(loadKeys({ ...random(), AUTH_CODE_KEY: weak })).toBeNull();
    });

    it('refuses loose base64: stray characters, whitespace inside, base64url, missing padding', () => {
      const good = nodeCrypto.randomBytes(32).toString('base64');
      for (const bad of [`${good.slice(0, 10)}!${good.slice(10)}`, `${good.slice(0, 10)} ${good.slice(10)}`, good.replace(/\+/g, '-').replace(/\//g, '_') + 'x', good.slice(0, -1)]) {
        expect(loadKeys({ ...random(), AUTH_SECRET_KEY: bad })).toBeNull();
      }
    });
  });

  it('the error message carries no key material', () => {
    const message = new KeysMissing().message;
    expect(message).not.toContain(TEST_ENV.AUTH_SECRET_KEY);
  });
});

describe('secret box', () => {
  const aad = totpAad('admin', '7');
  const plain = Buffer.from('12345678901234567890');

  it('round trips and the box has the v1 shape', () => {
    const boxed = seal(TEST_KEYS, plain, aad);
    expect(boxed).toMatch(/^v1\.[0-9a-f]{8}\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(boxed.split('.')[1]).toBe(TEST_KEYS.secret.id);
    const opened = open(TEST_KEYS, boxed, aad);
    expect(opened?.plain.equals(plain)).toBe(true);
    expect(opened?.stale).toBe(false);
  });

  it('totpAad binds type and id', () => {
    expect(totpAad('portal', 'abc')).toBe('totp:portal:abc');
  });

  it('moved ciphertext refused: another subject aad opens nothing', () => {
    const boxed = seal(TEST_KEYS, plain, aad);
    expect(open(TEST_KEYS, boxed, totpAad('admin', '8'))).toBeNull();
    expect(open(TEST_KEYS, boxed, totpAad('portal', '7'))).toBeNull();
  });

  it('a flipped byte in the iv, ciphertext or tag opens nothing', () => {
    const parts = seal(TEST_KEYS, plain, aad).split('.');
    for (const index of [2, 3, 4]) {
      const bytes = Buffer.from(parts[index], 'base64url');
      bytes[0] ^= 1;
      const tampered = [...parts];
      tampered[index] = bytes.toString('base64url');
      expect(open(TEST_KEYS, tampered.join('.'), aad)).toBeNull();
    }
  });

  it('malformed boxes open nothing', () => {
    const boxed = seal(TEST_KEYS, plain, aad);
    for (const bad of ['', 'v1', 'v2.a.b.c.d', boxed.replace(/^v1/, 'v2'), `${boxed}.x`, boxed.split('.').slice(0, 4).join('.')]) {
      expect(open(TEST_KEYS, bad, aad)).toBeNull();
    }
    const parts = boxed.split('.');
    parts[4] = parts[4].slice(0, 8);
    expect(open(TEST_KEYS, parts.join('.'), aad)).toBeNull();
  });

  it('a key set without the sealing key opens nothing', () => {
    expect(open(OTHER_KEYS, seal(TEST_KEYS, plain, aad), aad)).toBeNull();
  });

  it('sealed with the old key and opened after rotation: stale', () => {
    const boxed = seal(TEST_KEYS, plain, aad);
    const opened = open(ROTATED_KEYS, boxed, aad);
    expect(opened?.plain.equals(plain)).toBe(true);
    expect(opened?.stale).toBe(true);
    const resealed = seal(ROTATED_KEYS, opened!.plain, aad);
    expect(open(ROTATED_KEYS, resealed, aad)?.stale).toBe(false);
  });

  it('two seals of one secret differ (random iv)', () => {
    expect(seal(TEST_KEYS, plain, aad)).not.toBe(seal(TEST_KEYS, plain, aad));
  });

  it('the plain secret is not in the box', () => {
    const boxed = seal(TEST_KEYS, plain, aad);
    expect(boxed).not.toContain(plain.toString('base64url'));
    expect(boxed).not.toContain(plain.toString('hex'));
  });
});

describe('normalizeCode', () => {
  it('upper case, no spaces or hyphens', () => {
    expect(normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
  });
  it('reads O as 0 and I or L as 1', () => {
    expect(normalizeCode('o0iIl1')).toBe('001111');
  });
});

describe('codeMac', () => {
  const base = () => codeMac(TEST_KEYS, 'backup', 'admin', '7', 'ABCDEFGHJK');

  it('is 64 hex with the key id', () => {
    expect(base().mac).toMatch(/^[0-9a-f]{64}$/);
    expect(base().keyId).toBe(TEST_KEYS.code.id);
  });

  it('differs by purpose, subject type, subject id and key', () => {
    const m = base().mac;
    expect(codeMac(TEST_KEYS, 'email-code', 'admin', '7', 'ABCDEFGHJK').mac).not.toBe(m);
    expect(codeMac(TEST_KEYS, 'backup', 'portal', '7', 'ABCDEFGHJK').mac).not.toBe(m);
    expect(codeMac(TEST_KEYS, 'backup', 'admin', '8', 'ABCDEFGHJK').mac).not.toBe(m);
    expect(codeMac(OTHER_KEYS, 'backup', 'admin', '7', 'ABCDEFGHJK').mac).not.toBe(m);
  });

  it('is equal for the same code typed in different forms', () => {
    expect(codeMac(TEST_KEYS, 'backup', 'admin', '7', 'ABCDE FGHJK').mac).toBe(codeMac(TEST_KEYS, 'backup', 'admin', '7', 'abcde-fghjk').mac);
  });

  it('the old key gives the old key id and MAC, and throws when none is loaded', () => {
    const old = codeMac(ROTATED_KEYS, 'backup', 'admin', '7', 'ABCDEFGHJK', 'old');
    expect(old).toEqual(base());
    expect(() => codeMac(TEST_KEYS, 'backup', 'admin', '7', 'x', 'old')).toThrow();
  });

  it('the MAC input is injective: a colon cannot move between subject id and code', () => {
    const a = codeMac(TEST_KEYS, 'backup', 'admin', '1:X', 'Y').mac;
    const b = codeMac(TEST_KEYS, 'backup', 'admin', '1', 'X:Y').mac;
    expect(a).not.toBe(b);
    expect(codeMac(TEST_KEYS, 'backup', 'admin', '1', 'X').mac).not.toBe(codeMac(TEST_KEYS, 'backup', 'admi', 'n1', 'X').mac);
  });

  it('tokenMac is its own domain, keeps case, and differs by key', () => {
    const t = tokenMac(TEST_KEYS.code, 'AbCd');
    expect(t.mac).toMatch(/^[0-9a-f]{64}$/);
    expect(t.mac).not.toBe(tokenMac(TEST_KEYS.code, 'abcd').mac);
    expect(t.mac).not.toBe(tokenMac(OTHER_KEYS.code, 'AbCd').mac);
    expect(t.mac).not.toBe(codeMac(TEST_KEYS, 'pending-login', 'token', '', 'AbCd').mac);
  });

  it('packs and unpacks the m1 column form, and refuses an old SHA-256 hex', () => {
    const packed = packMac(base());
    expect(packed).toBe(`m1:${base().keyId}:${base().mac}`);
    expect(unpackMac(packed)).toEqual(base());
    expect(unpackMac(base().mac)).toBeNull();
    expect(unpackMac(`m1:${base().keyId}:abc`)).toBeNull();
    expect(unpackMac('')).toBeNull();
  });
});

describe('macMatchesAny', () => {
  const codes = Array.from({ length: 10 }, (_, i) => `ABCDEFGH${String(i).padStart(2, '0')}`);
  const rowsFor = (keys = TEST_KEYS) =>
    codes.map((code, i) => ({ id: `row${i}`, ...codeMac(keys, 'backup', 'admin', '7', code) }));
  const find = (typed: string, rows = rowsFor(), keys = TEST_KEYS) => macMatchesAny(keys, 'backup', 'admin', '7', typed, rows);

  it('finds a match in position 1 and in position 10, with ten compares each (no early exit)', () => {
    const spy = vi.spyOn(nodeCrypto, 'timingSafeEqual');
    expect(find(codes[0])).toBe('row0');
    expect(spy).toHaveBeenCalledTimes(10);
    spy.mockClear();
    expect(find(codes[9])).toBe('row9');
    expect(spy).toHaveBeenCalledTimes(10);
    spy.mockClear();
    expect(find('ZZZZZZZZZZ')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(10);
  });

  it('matches a differently typed code (spaces, case)', () => {
    expect(find(' abcdefgh03 ')).toBe('row3');
  });

  it('does not match another purpose, subject or key', () => {
    const rows = rowsFor();
    expect(macMatchesAny(TEST_KEYS, 'email-code', 'admin', '7', codes[0], rows)).toBeNull();
    expect(macMatchesAny(TEST_KEYS, 'backup', 'admin', '8', codes[0], rows)).toBeNull();
    expect(macMatchesAny(TEST_KEYS, 'backup', 'portal', '7', codes[0], rows)).toBeNull();
  });

  it('a row under the old key matches when the old key is loaded, and not otherwise', () => {
    const rows = rowsFor(TEST_KEYS);
    expect(find(codes[4], rows, ROTATED_KEYS)).toBe('row4');
    expect(find(codes[4], rows, OTHER_KEYS)).toBeNull();
  });

  it('rows of both keys at once', () => {
    const mixed = [
      { id: 'old', ...codeMac(TEST_KEYS, 'backup', 'admin', '7', 'AAAAAAAAAA') },
      { id: 'new', ...codeMac(ROTATED_KEYS, 'backup', 'admin', '7', 'BBBBBBBBBB') },
    ];
    expect(find('AAAAAAAAAA', mixed, ROTATED_KEYS)).toBe('old');
    expect(find('BBBBBBBBBB', mixed, ROTATED_KEYS)).toBe('new');
  });

  it('a garbage row never matches and never throws', () => {
    const rows = [{ id: 'bad', mac: 'zz', keyId: TEST_KEYS.code.id }, { id: 'unknown', mac: '00'.repeat(32), keyId: 'ffffffff' }, ...rowsFor()];
    expect(find(codes[2], rows)).toBe('row2');
    expect(find('ZZZZZZZZZZ', rows)).toBeNull();
  });

  it('with several equal rows the first match wins', () => {
    const mac = codeMac(TEST_KEYS, 'backup', 'admin', '7', 'AAAAAAAAAA');
    expect(find('AAAAAAAAAA', [{ id: 'a', ...mac }, { id: 'b', ...mac }])).toBe('a');
  });
});

describe('leak test', () => {
  it('a dump of sealed secrets and MACs gives nothing without the env keys', () => {
    const secrets = [1, 2, 3].map((n) => ({ aad: totpAad('portal', `p${n}`), plain: Buffer.alloc(20, n) }));
    const boxes = secrets.map((s) => seal(TEST_KEYS, s.plain, s.aad));
    const codes = Array.from({ length: 10 }, (_, i) => `KNOWNCODE${i}`);
    const rows = codes.map((c, i) => ({ id: `r${i}`, ...codeMac(TEST_KEYS, 'backup', 'admin', '7', c) }));
    const fresh = loadKeys(OTHER_ENV)!;
    secrets.forEach((s, i) => expect(open(fresh, boxes[i], s.aad)).toBeNull());
    for (const c of codes) expect(macMatchesAny(fresh, 'backup', 'admin', '7', c, rows)).toBeNull();
    for (const row of rows) expect(row.mac).not.toContain(Buffer.from('KNOWNCODE0').toString('hex'));
  });
});
