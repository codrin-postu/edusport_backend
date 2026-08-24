'use strict';

/**
 * Converts competition_results.placement from the legacy "p1"…"p50" enum
 * format to a plain INTEGER. Must run before Strapi's schema sync so the
 * column already contains valid integer data when the ALTER fires.
 */

async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('competition_results', 'placement');
  if (!hasColumn) return;

  // Strip the leading "p" from existing enum values so "p1" → 1, "p50" → 50.
  await knex.raw(`
    UPDATE competition_results
    SET placement = SUBSTRING(placement FROM 2)::integer
    WHERE placement ~ '^p[0-9]+$'
  `);

  // Now that all values are numeric strings (or already NULL), cast the column.
  await knex.raw(`
    ALTER TABLE competition_results
    ALTER COLUMN placement TYPE integer USING placement::integer
  `);
}

async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('competition_results', 'placement');
  if (!hasColumn) return;

  await knex.raw(`
    ALTER TABLE competition_results
    ALTER COLUMN placement TYPE varchar(10) USING 'p' || placement::text
  `);
}

module.exports = { up, down };
