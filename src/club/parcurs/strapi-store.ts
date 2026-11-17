import type { Core } from '@strapi/strapi';
import { transactionScope, type Scope, raws, str, text, linkId, type Raw } from '../athletes/strapi-store';
import { JUMP_CODES } from './catalog';
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

const corrupt = (what: string, r: Raw): never => {
  throw new Error(`badge-award ${text(r.documentId)}: ${what}`);
};

const isKind = (v: unknown): v is AwardRow['kind'] => KINDS.some((k) => k === v);
const isJump = (v: string): v is JumpCode => JUMP_CODES.some((c) => c === v);
const isLevel = (v: unknown): v is JumpLevel => v === 1 || v === 2 || v === 3;

const kindOf = (r: Raw): AwardRow['kind'] => (isKind(r.kind) ? r.kind : corrupt(`unknown kind ${String(r.kind)}`, r));

function jumpOf(r: Raw): JumpCode | null {
  const jump = str(r.jump);
  if (jump === null) return null;
  return isJump(jump) ? jump : corrupt(`unknown jump ${jump}`, r);
}

function levelOf(r: Raw): JumpLevel | null {
  if (r.level === null || r.level === undefined) return null;
  return isLevel(r.level) ? r.level : corrupt(`bad level ${String(r.level)}`, r);
}

function giverOf(r: Raw): AwardRow['givenBy'] {
  const teamMemberId = linkId(r.givenByTeamMember);
  if (teamMemberId) return { teamMemberId };
  return typeof r.givenByAdminId === 'number' ? { adminId: String(r.givenByAdminId) } : corrupt('no giver', r);
}

export function toAwardRow(r: Raw): AwardRow {
  return { id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', kind: kindOf(r), jump: jumpOf(r), level: levelOf(r), givenBy: giverOf(r), givenOn: text(r.givenOn) };
}

export const toGrantRow = (r: Raw): GrantRow => ({
  id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', source: text(r.source), size: Number(r.size), createdOn: text(r.createdOn), expiresOn: text(r.expiresOn),
});

export const toPinRow = (r: Raw): PinRow => ({
  id: text(r.documentId), grantId: linkId(r.grant) ?? '', giverId: linkId(r.giver) ?? '', recipientId: linkId(r.recipient) ?? '', design: Number(r.design), givenOn: text(r.givenOn),
});

function adminNumber(id: string): number {
  const n = Number(id);
  if (id === '' || !Number.isInteger(n)) throw new Error(`givenBy.adminId must be an integer, got "${id}"`);
  return n;
}

export const awardData = (row: Omit<AwardRow, 'id'>) => ({
  athlete: row.athleteId, kind: row.kind, jump: row.jump, level: row.level, givenOn: row.givenOn,
  ...('teamMemberId' in row.givenBy ? { givenByTeamMember: row.givenBy.teamMemberId } : { givenByAdminId: adminNumber(row.givenBy.adminId) }),
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

async function deleteByIds(strapi: Core.Strapi, uid: typeof AWARD | typeof GRANT | typeof PIN, where: Record<string, unknown>): Promise<void> {
  const ids = await idsOf(strapi, uid, where);
  if (ids.length) await strapi.db.query(uid).deleteMany({ where: { id: { $in: ids } } });
}

async function dropForAthlete(strapi: Core.Strapi, athleteId: string): Promise<void> {
  const mine = { athlete: { documentId: athleteId } };
  await deleteByIds(strapi, PIN, { $or: [{ giver: { documentId: athleteId } }, { recipient: { documentId: athleteId } }, { grant: mine }] });
  await deleteByIds(strapi, GRANT, mine);
  await deleteByIds(strapi, AWARD, mine);
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
