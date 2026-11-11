import type { Core } from '@strapi/strapi';
import { transactionScope, type Scope, raws, str, text, iso, linkId, type Raw } from '../../athletes/strapi-store';
import { recordHistory } from '../../history';
import { SUBJECT } from '../../subjects';
import type { AccessRow, AccessStore, RevokeReason } from './store';

const ACCESS = 'api::athlete-access.athlete-access' as const;
const ATHLETE = 'api::athlete.athlete' as const;
const MAX = 100000;
const REASONS: readonly RevokeReason[] = ['scos', 'email_schimbat', 'anonimizat', 'sters', 'unit'];
const POPULATE = { athlete: { fields: ['documentId' as const] }, account: { fields: ['documentId' as const] } };

export function toAccessRow(r: Raw): AccessRow {
  return {
    id: text(r.documentId), athleteId: linkId(r.athlete) ?? '', accountId: linkId(r.account) ?? '', email: text(r.email),
    invitedAt: iso(r.invitedAt) ?? '', invitedBy: text(r.invitedBy), revokedAt: iso(r.revokedAt), revokedBy: str(r.revokedBy),
    revokeReason: REASONS.find((x) => x === r.revokeReason) ?? null, levelSeenGroup: str(r.levelSeenGroup), levelSeenAt: iso(r.levelSeenAt),
  };
}

/** Pass the scope of the PortalStore built for the same request so both stores lock inside one transaction. */
export function strapiAccessStore(strapi: Core.Strapi, scope: Scope = transactionScope(strapi)): AccessStore {
  const docs = () => strapi.documents(ACCESS);
  const many = async (filters: Record<string, unknown>) => raws(await docs().findMany({ filters, populate: POPULATE, limit: MAX })).map(toAccessRow);
  return {
    liveByAthlete: async (athleteId) => (await many({ athleteKey: athleteId, revokedAt: { $null: true } }))[0] ?? null,
    liveByAccount: (accountId) => many({ account: { documentId: accountId }, revokedAt: { $null: true } }),
    createAccess: async (row) => {
      const { athleteId, accountId, ...rest } = row;
      const created = await docs().create({ data: { ...rest, athlete: athleteId, account: accountId, athleteKey: athleteId } as never });
      return text((created as Raw).documentId);
    },
    revokeAccess: async (id, w) => {
      await docs().update({ documentId: id, data: w as never });
    },
    setLevelSeen: async (id, groupId, at) => {
      await docs().update({ documentId: id, data: { levelSeenGroup: groupId, levelSeenAt: at } as never });
    },
    moveAccess: async (id, athleteId) => {
      await docs().update({ documentId: id, data: { athlete: athleteId, athleteKey: athleteId } as never });
    },
    recordAthlete: async (l) => {
      await recordHistory(strapi as never, { subjectType: SUBJECT.athlete, subjectId: l.athleteId, action: l.action, changes: l.changes, actor: l.actor });
    },
    lockAthlete: (athleteId) => scope.lockRow('athletes', athleteId),
    athleteForAccess: async (athleteId) => {
      const r = (await strapi.documents(ATHLETE).findOne({ documentId: athleteId })) as Raw | null;
      if (!r) return null;
      return { id: text(r.documentId), name: text(r.name), email: str(r.email), status: text(r.status), birthDate: str(r.birthDate), contactName: str(r.contactName) };
    },
  };
}
