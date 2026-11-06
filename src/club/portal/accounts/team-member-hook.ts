import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import { disableAccount } from './status';
import { baseContext, type AccountContext } from './read';

const TEAM_MEMBER = 'api::team-member.team-member' as const;
/** The history actor of an account the system disables. */
export const SYSTEM_ACTOR = 'sistem';

export const PORTAL_INDEXES = [
  { name: 'portal_accounts_team_member_lnk_team_member_uq', table: 'portal_accounts_team_member_lnk', column: 'team_member_id' },
] as const;

/** One account per team member (spec 3.2): a second link row is refused by the database. No-op where the table is missing. */
export async function ensurePortalIndexes(knex: Knex): Promise<void> {
  for (const { name, table, column } of PORTAL_INDEXES) {
    if (!(await knex.schema.hasTable(table))) continue;
    await knex.raw(`create unique index if not exists "${name}" on "${table}" ("${column}")`);
  }
}

/** Disables the account of every listed team member that has one and is not disabled; a refusal throws (the delete is then refused). */
export async function disableForTeamMembers(c: AccountContext, teamMemberIds: string[]): Promise<number> {
  // Lock order team member, then account: the team member rows are locked first (sorted), so an invite or re-link for the same team member waits.
  return c.store.transaction(async () => {
    const ids = [...new Set(teamMemberIds)].sort();
    for (const id of ids) await c.store.lockTeamMember(id);
    let n = 0;
    for (const id of ids) {
      const account = await c.store.accountByTeamMember(id);
      if (!account || account.status === 'disabled') continue;
      const result = await disableAccount(c, account.id);
      if (result.ok === false) throw new Error(`portal account of a deleted team member could not be disabled: ${result.error}`);
      n += 1;
    }
    return n;
  });
}

type DeleteEvent = { params?: { where?: unknown; filters?: unknown } };

/** The documentIds a delete is about to remove, from the `where` the query engine received. */
async function idsBeingDeleted(strapi: Core.Strapi, event: DeleteEvent, many: boolean): Promise<string[]> {
  const where = event.params?.where ?? event.params?.filters ?? (many ? {} : null);
  if (!where) return [];
  const rows = (await strapi.db.query(TEAM_MEMBER).findMany({ where, select: ['documentId'] })) as { documentId?: unknown }[];
  return rows.map((r) => r.documentId).filter((v): v is string => typeof v === 'string');
}

export function teamMemberHandlers(strapi: Core.Strapi, context: () => AccountContext) {
  const run = (many: boolean) => async (event: DeleteEvent): Promise<void> => {
    const ids = await idsBeingDeleted(strapi, event, many);
    if (ids.length) await disableForTeamMembers(context(), ids);
  };
  return { beforeDelete: run(false), beforeDeleteMany: run(true) };
}

/** Deleting a team member disables its portal account first; the account keeps its rows (spec S8). */
export function subscribeTeamMemberHook(strapi: Core.Strapi): void {
  strapi.db.lifecycles.subscribe({ models: [TEAM_MEMBER], ...teamMemberHandlers(strapi, () => baseContext(strapi, SYSTEM_ACTOR)) });
}
