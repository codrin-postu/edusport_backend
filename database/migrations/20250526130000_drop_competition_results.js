'use strict';

async function up(knex) {
  const exists = await knex.schema.hasTable('competition_results');
  if (exists) {
    await knex.schema.dropTable('competition_results');
  }
}

async function down(knex) {
  // Intentionally left empty — restoring the old table is handled by re-seeding
}

module.exports = { up, down };
