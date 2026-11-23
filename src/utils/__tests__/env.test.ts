import { describe, expect, it } from 'vitest';
import { databaseClient, envNumber, envText } from '../env';

describe('envText', () => {
  it('treats empty and blank values as missing', () => {
    expect(envText(undefined)).toBeUndefined();
    expect(envText('')).toBeUndefined();
    expect(envText('   ')).toBeUndefined();
    expect(envText(' postgres ')).toBe('postgres');
  });
});

describe('envNumber', () => {
  it('falls back on missing, empty and non-numeric values, keeps a real zero', () => {
    expect(envNumber(undefined, 0.1)).toBe(0.1);
    expect(envNumber('', 0.1)).toBe(0.1);
    expect(envNumber('abc', 0.1)).toBe(0.1);
    expect(envNumber('0', 0.1)).toBe(0);
    expect(envNumber('0.5', 0.1)).toBe(0.5);
  });
});

describe('databaseClient', () => {
  it('uses the configured client', () => {
    expect(databaseClient({ DATABASE_CLIENT: 'postgres', NODE_ENV: 'production' })).toBe('postgres');
  });
  it('falls back to sqlite only in development', () => {
    expect(databaseClient({ NODE_ENV: 'development' })).toBe('sqlite');
    expect(databaseClient({ DATABASE_CLIENT: '', NODE_ENV: 'development' })).toBe('sqlite');
  });
  it('fails at boot with a clear message everywhere else, an empty value included', () => {
    expect(() => databaseClient({ NODE_ENV: 'production' })).toThrow(/DATABASE_CLIENT is not set/);
    expect(() => databaseClient({ DATABASE_CLIENT: ' ', NODE_ENV: 'production' })).toThrow(/DATABASE_CLIENT is not set/);
    expect(() => databaseClient({})).toThrow(/DATABASE_CLIENT is not set/);
  });
});
