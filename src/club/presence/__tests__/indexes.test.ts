import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Knex } from 'knex';
import { describe, expect, it } from 'vitest';
import { PRESENCE_INDEXES, ensurePresenceIndexes } from '../indexes';

const SRC = join(__dirname, '..', '..', '..');

describe('presence indexes', () => {
  it('names every index of 3.10 and the two unique keys (decided 1)', () => {
    expect(PRESENCE_INDEXES).toEqual([
      { name: 'club_sessions_occurrence_key_uq', table: 'club_sessions', column: 'occurrence_key', unique: true },
      { name: 'club_attendances_unique_key_uq', table: 'club_attendances', column: 'unique_key', unique: true },
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
  it('bootstrap runs it', () => {
    expect(readFileSync(join(SRC, 'index.ts'), 'utf8')).toMatch(/ensurePresenceIndexes\(strapi\.db\.connection\)/);
  });
});
