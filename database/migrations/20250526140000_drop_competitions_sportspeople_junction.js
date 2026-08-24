'use strict';

async function up(knex) {
  // Drop the manyToMany junction table created when competition had a
  // sportspeople relation and sportsperson had a competitions inverse.
  // Replaced by the competition.participant repeatable component.
  const candidates = [
    'competitions_sportspeople_lnk',
    'competitions_sportspeople_links',
  ];
  for (const table of candidates) {
    if (await knex.schema.hasTable(table)) {
      await knex.schema.dropTable(table);
    }
  }
}

async function down(knex) {
  // Intentionally empty — restoring is handled by re-seeding
}

module.exports = { up, down };
