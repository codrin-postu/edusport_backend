import type { Knex } from 'knex';

export const PRESENCE_INDEXES: readonly { name: string; table: string; column: string; unique: boolean }[] = [
  { name: 'club_sessions_occurrence_key_uq', table: 'club_sessions', column: 'occurrence_key', unique: true },
  { name: 'club_attendances_unique_key_uq', table: 'club_attendances', column: 'unique_key', unique: true },
  { name: 'club_subscriptions_code_uq', table: 'club_subscriptions', column: 'code', unique: true },
  { name: 'club_payments_receipt_no_uq', table: 'club_payments', column: 'receipt_no', unique: true },
  { name: 'club_sessions_date_idx', table: 'club_sessions', column: 'date', unique: false },
  { name: 'club_individual_lessons_date_idx', table: 'club_individual_lessons', column: 'date', unique: false },
  { name: 'club_payments_paid_on_idx', table: 'club_payments', column: 'paid_on', unique: false },
  { name: 'club_subscriptions_valid_until_idx', table: 'club_subscriptions', column: 'valid_until', unique: false },
];

export async function ensurePresenceIndexes(knex: Knex): Promise<void> {
  for (const { name, table, column, unique } of PRESENCE_INDEXES) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw(`create ${unique ? 'unique ' : ''}index if not exists "${name}" on "${table}" ("${column}")`);
  }
}
