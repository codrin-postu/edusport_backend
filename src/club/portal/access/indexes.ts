import type { Knex } from 'knex';

const TABLE = 'athlete_accesses';

/** One live access per athlete (spec 3.1): a second row with no `revoked_at` for the same athlete key is refused by the database. */
export async function ensureAccessIndexes(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return;
  await knex.raw(`create unique index if not exists "athlete_accesses_live_uq" on "${TABLE}" ("athlete_key") where "revoked_at" is null`);
}

/** Device and token rows made before phase 7 belong to the coach host. Returns the rows changed; a second call changes none. */
export async function backfillDeviceHosts(knex: Knex): Promise<number> {
  let n = 0;
  for (const table of ['portal_devices', 'portal_tokens']) {
    if (!(await knex.schema.hasTable(table))) continue;
    // Reset codes keep a null host (they work on either host); only invites and devices belong to the coach host.
    const open = knex(table).whereNull('host');
    n += await (table === 'portal_tokens' ? open.where('kind', 'invite') : open).update({ host: 'antrenor' });
  }
  return n;
}
