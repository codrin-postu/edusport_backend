import type { Knex } from 'knex';

export const AUTH_FACTOR_INDEX = 'auth_factors_subject_kind_uq';

/** One factor row per subject and kind (a Strapi schema has no compound unique). No-op where the table is missing. */
export async function ensureSecurityIndexes(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('auth_factors'))) return;
  await knex.raw(`create unique index if not exists "${AUTH_FACTOR_INDEX}" on "auth_factors" ("subject_type", "subject_id", "kind")`);
}
