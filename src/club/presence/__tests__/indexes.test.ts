import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import { bootErrorText } from '../../boot-error';
import { PRESENCE_INDEXES, ensurePresenceIndexes } from '../indexes';

const SRC = join(__dirname, '..', '..', '..');

describe('presence indexes', () => {
  it('names every index of 3.10, the two unique keys (decided 1) and the abonament code and receipt number keys (11-3)', () => {
    expect(PRESENCE_INDEXES).toEqual([
      { name: 'club_sessions_occurrence_key_uq', table: 'club_sessions', column: 'occurrence_key', unique: true },
      { name: 'club_attendances_unique_key_uq', table: 'club_attendances', column: 'unique_key', unique: true },
      { name: 'club_subscriptions_code_uq', table: 'club_subscriptions', column: 'code', unique: true },
      { name: 'club_payments_receipt_no_uq', table: 'club_payments', column: 'receipt_no', unique: true },
      { name: 'club_sessions_date_idx', table: 'club_sessions', column: 'date', unique: false },
      { name: 'club_individual_lessons_date_idx', table: 'club_individual_lessons', column: 'date', unique: false },
      { name: 'club_payments_paid_on_idx', table: 'club_payments', column: 'paid_on', unique: false },
      { name: 'club_subscriptions_valid_until_idx', table: 'club_subscriptions', column: 'valid_until', unique: false },
    ]);
  });
  it('creates each index if missing, skipping a table that does not exist yet', async () => {
    const sql: string[] = [];
    const knex = Object.assign((t: string) => t, {
      schema: { hasTable: async (t: string) => t !== 'club_payments' },
      raw: async (q: string) => { sql.push(q); },
    }) as unknown as Knex;
    await ensurePresenceIndexes(knex);
    expect(sql).toContain('create unique index if not exists "club_sessions_occurrence_key_uq" on "club_sessions" ("occurrence_key")');
    expect(sql).toContain('create index if not exists "club_sessions_date_idx" on "club_sessions" ("date")');
    expect(sql.some((q) => q.includes('club_payments'))).toBe(false);
  });
  it('a failing index does not skip the later ones; the failures come back as one error with the message', async () => {
    const sql: string[] = [];
    const knex = Object.assign((t: string) => t, {
      schema: { hasTable: async () => true },
      raw: async (q: string) => {
        if (q.includes('club_subscriptions_code_uq')) throw Object.assign(new Error('could not create unique index'), { code: '23505' });
        sql.push(q);
      },
    }) as unknown as Knex;
    const err = await ensurePresenceIndexes(knex).then(() => null, (e: unknown) => e as Error);
    expect(err?.message).toBe('club_subscriptions_code_uq: 23505 could not create unique index');
    expect(sql).toHaveLength(PRESENCE_INDEXES.length - 1);
    expect(sql.some((q) => q.includes('club_payments_receipt_no_uq'))).toBe(true);
    expect(sql.some((q) => q.includes('club_subscriptions_valid_until_idx'))).toBe(true);
  });
  it('bootErrorText gives the code and the message, whatever was thrown', () => {
    expect(bootErrorText(Object.assign(new Error('boom'), { code: '40P01' }))).toBe('40P01 boom');
    expect(bootErrorText(new Error('boom'))).toBe('boom');
    expect(bootErrorText('x')).toBe('unknown');
  });
  it('bootstrap runs it, and a failed index or backfill is logged with its message and sent to Sentry like the portal block', () => {
    const boot = readFileSync(join(SRC, 'index.ts'), 'utf8');
    expect(boot).toMatch(/ensurePresenceIndexes\(strapi\.db\.connection\)/);
    for (const label of ['[presence] indexes: ', '[codes] backfill: ']) {
      expect(boot).toContain('`' + label + '${bootErrorText(e)}`');
    }
    expect(boot.match(/captureMessage\(message\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
