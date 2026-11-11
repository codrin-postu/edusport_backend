import type { Core } from '@strapi/strapi';
import { transactionScope, type Scope, raws, str, text, iso, linkId, type Raw } from '../../athletes/strapi-store';
import { recordHistory } from '../../history';
import { SUBJECT } from '../../subjects';
import { scrubbedJobStatus } from '../../personal-data/anonymize-plan';
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
    deleteForAthlete: async (athleteId) => {
      await strapi.db.query(ACCESS).deleteMany({ where: { athleteKey: athleteId } });
    },
    scrubForAthlete: async (athleteId, name) => {
      const rows = await many({ athleteKey: athleteId });
      const accountIds = [...new Set(rows.map((r) => r.accountId))];
      // The query engine takes the empty e-mail and the null payload where the document service would refuse them.
      await strapi.db.query(ACCESS).updateMany({ where: { athleteKey: athleteId }, data: { email: '' } });
      if (accountIds.length) await scrubAccountTraces(strapi, accountIds, athleteId, name);
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

const JOB = 'api::email-job.email-job' as const;
const HISTORY = 'api::history-entry.history-entry' as const;
const GRANTED = 'portal-access-granted';

const namesChild = (payload: unknown, name: string): boolean => {
  const p = (payload ?? {}) as { children?: unknown; childName?: unknown };
  return p.childName === name || (Array.isArray(p.children) && p.children.includes(name));
};

/** The account lines "Acces la <sportiv>" of the child lose the name; the invite and access jobs that name the child are scrubbed. */
async function scrubAccountTraces(strapi: Core.Strapi, accountIds: string[], athleteId: string, name: string): Promise<void> {
  const lines = raws(await strapi.db.query(HISTORY).findMany({ where: { subjectType: 'portal-account', subjectId: { $in: accountIds }, action: GRANTED }, limit: MAX }));
  for (const l of lines) {
    if ((l.changes as { athleteId?: unknown } | null)?.athleteId === athleteId) await strapi.db.query(HISTORY).update({ where: { id: l.id }, data: { changes: { athleteId } } });
  }
  const jobs = raws(await strapi.db.query(JOB).findMany({ where: { kind: { $in: ['portal-invite', 'portal-access'] }, changeKey: { $in: accountIds } }, limit: MAX }));
  for (const j of jobs.filter((x) => namesChild(x.payload, name))) {
    await strapi.db.query(JOB).update({ where: { id: j.id }, data: { recipient: null, subject: null, lastError: null, payload: null, status: scrubbedJobStatus(text(j.status)) } });
  }
}
