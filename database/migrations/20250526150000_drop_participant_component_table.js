'use strict';

async function up(knex) {
  // Drop the component tables created when competition used a repeatable
  // competition.participant component. Replaced by participantData JSON field.
  // Use CASCADE to handle any foreign key references.
  const candidates = [
    'competitions_participants_cmps',
    'competitions_participants_components',
    'components_competition_participants',
  ];
  for (const table of candidates) {
    if (await knex.schema.hasTable(table)) {
      await knex.raw(`DROP TABLE "${table}" CASCADE`);
    }
  }
}

async function down(knex) {}

module.exports = { up, down };
