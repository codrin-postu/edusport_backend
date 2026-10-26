import { describe, expect, it } from 'vitest';
import {
  MAX_NUMBER_RETRIES,
  RegistrationNumberClashError,
  allocateRegistrationNumber,
  isRegistrationNumberClash,
} from '../number-allocator';

const pgClash = () =>
  Object.assign(new Error('duplicate key value violates unique constraint "registration_submissions_registration_number_uq"'), {
    code: '23505',
    constraint: 'registration_submissions_registration_number_uq',
  });

/** A fake table with a unique index on the number; create waits a tick like a real insert. */
function store(initial: string[] = [], staleReads = false) {
  const taken = new Set(initial);
  const calls: string[] = [];
  return {
    calls,
    readNumbers: async () => (staleReads ? [] : [...taken]),
    create: async (n: string) => {
      calls.push(n);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (taken.has(n)) throw pgClash();
      taken.add(n);
      return { documentId: `doc-${n}` };
    },
  };
}

describe('allocateRegistrationNumber', () => {
  it('uses the next number after the highest of that start year', async () => {
    await expect(allocateRegistrationNumber(2026, store(['2026-0007', '2025-0100']))).resolves.toEqual({
      registrationNumber: '2026-0008',
      result: { documentId: 'doc-2026-0008' },
    });
  });

  it('gives two submits at the same moment two different numbers', async () => {
    const s = store(['2026-0007']);
    const [a, b] = await Promise.all([allocateRegistrationNumber(2026, s), allocateRegistrationNumber(2026, s)]);
    expect([a.registrationNumber, b.registrationNumber].sort()).toEqual(['2026-0008', '2026-0009']);
    expect(s.calls).toEqual(['2026-0008', '2026-0008', '2026-0009']);
  });

  it('moves past a clashing number even when the read is stale', async () => {
    const s = store(['2026-0001'], true);
    await expect(allocateRegistrationNumber(2026, s)).resolves.toMatchObject({ registrationNumber: '2026-0002' });
    expect(s.calls).toEqual(['2026-0001', '2026-0002']);
  });

  it('gives up after 1 attempt plus 5 retries', async () => {
    let calls = 0;
    const deps = {
      readNumbers: async () => [],
      create: async () => {
        calls += 1;
        throw pgClash();
      },
    };
    await expect(allocateRegistrationNumber(2026, deps)).rejects.toBeInstanceOf(RegistrationNumberClashError);
    expect(calls).toBe(MAX_NUMBER_RETRIES + 1);
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    const deps = {
      readNumbers: async () => [],
      create: async () => {
        calls += 1;
        throw new Error('database down');
      },
    };
    await expect(allocateRegistrationNumber(2026, deps)).rejects.toThrow('database down');
    expect(calls).toBe(1);
  });
});

describe('isRegistrationNumberClash', () => {
  it('recognises the Postgres unique violation on the number', () => expect(isRegistrationNumberClash(pgClash())).toBe(true));

  it('ignores a Postgres unique violation on another column', () =>
    expect(isRegistrationNumberClash(Object.assign(new Error('dup'), { code: '23505', constraint: 'other_unique' }))).toBe(false));

  it('recognises the SQLite unique violation', () =>
    expect(
      isRegistrationNumberClash(new Error('UNIQUE constraint failed: registration_submissions.registration_number')),
    ).toBe(true));

  it("recognises Strapi's own unique check", () => {
    const err = Object.assign(new Error('This attribute must be unique'), {
      name: 'ValidationError',
      details: { errors: [{ path: ['registrationNumber'], message: 'This attribute must be unique' }] },
    });
    expect(isRegistrationNumberClash(err)).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isRegistrationNumberClash(new Error('boom'))).toBe(false);
    expect(isRegistrationNumberClash(null)).toBe(false);
    expect(isRegistrationNumberClash('23505')).toBe(false);
  });
});
