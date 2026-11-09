import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { ensureSecurityIndexesAtBoot } from '../indexes';

const failing = (): Knex =>
  ({ schema: { hasTable: async () => true }, raw: async () => { throw Object.assign(new Error('boom'), { code: '23505' }); } }) as unknown as Knex;
const working = (): Knex => ({ schema: { hasTable: async () => true }, raw: vi.fn(async () => undefined) }) as unknown as Knex;

describe('ensureSecurityIndexesAtBoot', () => {
  it('production: a failed index refuses the start, reporting the code only', async () => {
    const report = vi.fn();
    await expect(ensureSecurityIndexesAtBoot(failing(), { NODE_ENV: 'production' }, report)).rejects.toThrow('[security] indexes: 23505');
    expect(report).toHaveBeenCalledWith('[security] indexes: 23505');
  });

  it('elsewhere: it only reports', async () => {
    const report = vi.fn();
    await expect(ensureSecurityIndexesAtBoot(failing(), { NODE_ENV: 'development' }, report)).resolves.toBeUndefined();
    await expect(ensureSecurityIndexesAtBoot(failing(), {}, report)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('success creates the unique index and reports nothing', async () => {
    const knex = working();
    const report = vi.fn();
    await ensureSecurityIndexesAtBoot(knex, { NODE_ENV: 'production' }, report);
    expect(knex.raw).toHaveBeenCalledWith(expect.stringContaining('auth_factors_subject_kind_uq'));
    expect(report).not.toHaveBeenCalled();
  });
});
