import type { Knex } from 'knex';

export const AUTH_FACTOR_INDEX = 'auth_factors_subject_kind_uq';

/** One factor row per subject and kind (a Strapi schema has no compound unique). No-op where the table is missing. */
export async function ensureSecurityIndexes(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('auth_factors'))) return;
  await knex.raw(`create unique index if not exists "${AUTH_FACTOR_INDEX}" on "auth_factors" ("subject_type", "subject_id", "kind")`);
}

/** Boot step: a missing unique index refuses the start in production (two factor rows per subject would make a TOTP check ambiguous); elsewhere it only logs. */
export async function ensureSecurityIndexesAtBoot(
  knex: Knex,
  env: NodeJS.ProcessEnv,
  report: (message: string) => void,
): Promise<void> {
  try {
    await ensureSecurityIndexes(knex);
  } catch (e) {
    const message = `[security] indexes: ${(e as { code?: string })?.code ?? 'unknown'}`;
    report(message);
    if (env.NODE_ENV === 'production') throw new Error(message);
  }
}
