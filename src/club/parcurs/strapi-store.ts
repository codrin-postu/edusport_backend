import type { Core } from '@strapi/strapi';
import { transactionScope, type Scope, raws, str, text, linkId, type Raw } from '../athletes/strapi-store';
import type { JumpCode, JumpLevel } from './api-types';
import type { AwardRow, GrantRow, ParcursStore, PinRow } from './store';

export const AWARD = 'api::badge-award.badge-award' as const;
export const GRANT = 'api::friendship-grant.friendship-grant' as const;
export const PIN = 'api::friendship-pin.friendship-pin' as const;
const MAX = 100000;
const AWARD_POPULATE = { athlete: { fields: ['documentId' as const] }, givenByTeamMember: { fields: ['documentId' as const] } };
const GRANT_POPULATE = { athlete: { fields: ['documentId' as const] } };
const PIN_POPULATE = { grant: { fields: ['documentId' as const] }, giver: { fields: ['documentId' as const] }, recipient: { fields: ['documentId' as const] } };
const KINDS = ['steaua', 'test', 'jump'] as const;

export function toAwardRow(r: Raw): AwardRow {
  const teamMemberId = linkId(r.givenByTeamMember);
  const adminId = r.givenByAdminId === null || r.givenByAdminId === undefined ? '' : String(r.givenByAdminId);
  return {
    id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', kind: KINDS.find((k) => k === r.kind) ?? 'steaua',
    jump: str(r.jump) as JumpCode | null, level: typeof r.level === 'number' ? (r.level as JumpLevel) : null,
    givenBy: teamMemberId ? { teamMemberId } : { adminId }, givenOn: text(r.givenOn),
  };
}

export const toGrantRow = (r: Raw): GrantRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', source: text(r.source), size: Number(r.size), createdOn: text(r.createdOn), expiresOn: text(r.expiresOn),
});

export const toPinRow = (r: Raw): PinRow => ({
  id: text(r.documentId), grantId: linkId(r.grant) ?? '', giverId: linkId(r.giver) ?? '', recipientId: linkId(r.recipient) ?? '', design: Number(r.design), givenOn: text(r.givenOn),
});

const awardData = (row: Omit<AwardRow, 'id'>) => ({
  athlete: row.athleteId, kind: row.kind, jump: row.jump, level: row.level, givenOn: row.givenOn,
  ...('teamMemberId' in row.givenBy ? { givenByTeamMember: row.givenBy.teamMemberId } : { givenByAdminId: Number(row.givenBy.adminId) }),
});

/** Pass the scope of the store built for the same request so the writes join its transaction. */
export function strapiParcursStore(strapi: Core.Strapi, scope: Scope = transactionScope(strapi)): ParcursStore {
  const awards = () => strapi.documents(AWARD);
  const grants = () => strapi.documents(GRANT);
  const pins = () => strapi.documents(PIN);
  const manyAwards = async (filters: Record<string, unknown>) => raws(await awards().findMany({ filters, populate: AWARD_POPULATE, limit: MAX, sort: 'createdAt:asc' } as never)).map(toAwardRow);
  const manyGrants = async (filters: Record<string, unknown>) => raws(await grants().findMany({ filters, populate: GRANT_POPULATE, limit: MAX, sort: 'createdAt:asc' } as never)).map(toGrantRow);
  const manyPins = async (filters: Record<string, unknown>) => raws(await pins().findMany({ filters, populate: PIN_POPULATE, limit: MAX, sort: 'createdAt:asc' } as never)).map(toPinRow);
  const created = (r: unknown) => text((r as Raw).documentId);
  return {
    transaction: scope.transaction,
    lockAthlete: (id) => scope.lockRow('athletes', id),
    awards: ({ athleteId }) => manyAwards(athleteId ? { athlete: { documentId: athleteId } } : {}),
    addAward: async (row) => created(await awards().create({ data: awardData(row) as never })),
    deleteAward: async (id) => {
      await awards().delete({ documentId: id });
    },
    grants: ({ athleteId }) => manyGrants({ athlete: { documentId: athleteId } }),
    addGrant: async (row) => created(await grants().create({ data: { athlete: row.athleteId, source: row.source, size: row.size, createdOn: row.createdOn, expiresOn: row.expiresOn } as never })),
    pins: ({ giverId, recipientId, grantId }) =>
      manyPins({ ...(giverId ? { giver: { documentId: giverId } } : {}), ...(recipientId ? { recipient: { documentId: recipientId } } : {}), ...(grantId ? { grant: { documentId: grantId } } : {}) }),
    addPin: async (row) => created(await pins().create({ data: { grant: row.grantId, giver: row.giverId, recipient: row.recipientId, design: row.design, givenOn: row.givenOn } as never })),
    deletePin: async (id) => {
      await pins().delete({ documentId: id });
    },
    dropForAthlete: (athleteId) => dropForAthlete(strapi, athleteId),
    moveForMerge: (keptId, removedId) => moveForMerge(strapi, keptId, removedId),
  };
}

const idsOf = async (strapi: Core.Strapi, uid: typeof AWARD | typeof GRANT | typeof PIN, where: Record<string, unknown>) =>
  raws(await strapi.db.query(uid).findMany({ where, select: ['id'], limit: MAX })).map((r) => r.id as number);

async function dropForAthlete(strapi: Core.Strapi, athleteId: string): Promise<void> {
  const mine = { athlete: { documentId: athleteId } };
  const pinIds = await idsOf(strapi, PIN, { $or: [{ giver: { documentId: athleteId } }, { recipient: { documentId: athleteId } }, { grant: mine }] });
  if (pinIds.length) await strapi.db.query(PIN).deleteMany({ where: { id: { $in: pinIds } } });
  await strapi.db.query(GRANT).deleteMany({ where: { id: { $in: await idsOf(strapi, GRANT, mine) } } });
  await strapi.db.query(AWARD).deleteMany({ where: { id: { $in: await idsOf(strapi, AWARD, mine) } } });
}

async function moveForMerge(strapi: Core.Strapi, keptId: string, removedId: string): Promise<void> {
  const repoint = async (uid: typeof AWARD | typeof GRANT | typeof PIN, field: 'athlete' | 'giver' | 'recipient') => {
    const rows = raws(await strapi.db.query(uid).findMany({ where: { [field]: { documentId: removedId } }, select: ['documentId'], limit: MAX }));
    for (const r of rows) await strapi.documents(uid).update({ documentId: text(r.documentId), data: { [field]: keptId } as never });
  };
  await repoint(AWARD, 'athlete');
  await repoint(GRANT, 'athlete');
  await repoint(PIN, 'giver');
  await repoint(PIN, 'recipient');
}
