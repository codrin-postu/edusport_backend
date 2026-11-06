import type { Core } from '@strapi/strapi';
import { createId } from '@paralleldrive/cuid2';
import { transactionScope, type Scope, raws, str, text, iso, linkId, type Raw } from '../athletes/strapi-store';
import { recordHistory } from '../history';
import { SUBJECT } from '../subjects';
import type { AccountRow, AccountStatus, DeviceRow, LimitRow, PortalStore, TokenRow, UserAuth } from './store';

const ACCOUNT = 'api::portal-account.portal-account' as const;
const TOKEN = 'api::portal-token.portal-token' as const;
const LIMIT = 'api::portal-auth-limit.portal-auth-limit' as const;
const DEVICE = 'api::portal-device.portal-device' as const;
const TEAM_MEMBER = 'api::team-member.team-member' as const;
const USER = 'plugin::users-permissions.user' as const;
const ROLE = 'plugin::users-permissions.role' as const;
const LIMIT_TABLE = 'portal_auth_limits';
const ACCOUNT_TABLE = 'portal_accounts';
const MAX = 100000;
const STATUSES: readonly AccountStatus[] = ['invited', 'active', 'disabled'];
const ACCOUNT_POPULATE = { user: { fields: ['documentId' as const] }, teamMember: true };

export function toAccountRow(r: Raw): AccountRow {
  const user = r.user && typeof r.user === 'object' ? (r.user as Raw) : null;
  return {
    id: text(r.documentId), userId: Number(user?.id ?? 0), email: text(r.email), status: STATUSES.find((s) => s === r.status) ?? 'invited',
    teamMemberId: linkId(r.teamMember), phone: str(r.phone), googleSub: str(r.googleSub), invitedAt: iso(r.invitedAt), invitedBy: str(r.invitedBy),
    activatedAt: iso(r.activatedAt), disabledAt: iso(r.disabledAt), disabledBy: str(r.disabledBy), lastLoginAt: iso(r.lastLoginAt),
  };
}

export function toLimitRow(r: Raw): LimitRow {
  return { id: text(r.documentId), key: text(r.key), count: Number(r.count ?? 0), windowStart: iso(r.windowStart) ?? '', lockedUntil: iso(r.lockedUntil), notifiedAt: iso(r.notifiedAt) };
}

export function toTokenRow(r: Raw): TokenRow {
  return {
    id: text(r.documentId), accountId: linkId(r.account) ?? '', kind: r.kind === 'reset' ? 'reset' : 'invite', secretHash: text(r.secretHash),
    expiresAt: iso(r.expiresAt) ?? '', usedAt: iso(r.usedAt), tries: Number(r.tries ?? 0), createdAt: iso(r.createdAt) ?? '',
  };
}

export function toDeviceRow(r: Raw): DeviceRow {
  return {
    id: text(r.documentId), accountId: linkId(r.account) ?? '', deviceKeyHash: text(r.deviceKeyHash), sessionId: str(r.sessionId), label: text(r.label),
    firstSeenAt: iso(r.firstSeenAt) ?? '', lastSeenAt: iso(r.lastSeenAt) ?? '', revokedAt: iso(r.revokedAt),
  };
}

const toUserAuth = (r: Raw): UserAuth => ({ id: Number(r.id), email: text(r.email), passwordHash: str(r.password), blocked: r.blocked === true, confirmed: r.confirmed === true });

const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function limits(strapi: Core.Strapi, scope: Scope): Pick<PortalStore, 'lockLimit' | 'saveLimit' | 'purgeLimits'> {
  const docs = () => strapi.documents(LIMIT);
  return {
    lockLimit: async (key) => {
      const now = new Date();
      const trx = scope.current();
      if (!trx) throw new Error(`lock on ${LIMIT_TABLE} taken outside a transaction`);
      await strapi.db.getConnection(LIMIT_TABLE).transacting(trx)
        .insert({ document_id: createId(), key, count: 0, window_start: now, created_at: now, updated_at: now, published_at: now })
        .onConflict('key').ignore();
      const found = await strapi.db.getConnection(LIMIT_TABLE).transacting(trx).where('key', key).first('document_id');
      const id = text(found?.document_id);
      await scope.lockRow(LIMIT_TABLE, id);
      const row = await docs().findOne({ documentId: id });
      return toLimitRow(row as Raw);
    },
    saveLimit: async (id, s) => {
      await docs().update({ documentId: id, data: { count: s.count, windowStart: s.windowStart, lockedUntil: s.lockedUntil, notifiedAt: s.notifiedAt } });
    },
    purgeLimits: async (olderThan, now) => {
      const where = { windowStart: { $lt: olderThan.toISOString() }, $or: [{ lockedUntil: { $null: true } }, { lockedUntil: { $lte: now.toISOString() } }] };
      const { count } = await strapi.db.query(LIMIT).deleteMany({ where });
      return count;
    },
  };
}

function accounts(strapi: Core.Strapi): Pick<PortalStore, 'account' | 'accountByEmail' | 'accountByGoogleSub' | 'accountByTeamMember' | 'accountByUser' | 'createAccount' | 'updateAccount'> {
  const docs = () => strapi.documents(ACCOUNT);
  const one = async (filters: Record<string, unknown>) => {
    const rows = raws(await docs().findMany({ filters, populate: ACCOUNT_POPULATE, limit: 1 }));
    return rows[0] ? toAccountRow(rows[0]) : null;
  };
  const userDocId = async (id: number) => text((await strapi.db.query(USER).findOne({ where: { id }, select: ['documentId'] }))?.documentId);
  const links = async (a: { teamMemberId?: string | null; userId?: number }) => ({
    ...(a.userId !== undefined ? { user: await userDocId(a.userId) } : {}),
    ...(a.teamMemberId !== undefined ? { teamMember: a.teamMemberId } : {}),
  });
  const fields = ({ teamMemberId, userId, id, ...rest }: Partial<AccountRow>) => defined({ ...rest, email: rest.email?.toLowerCase() });
  return {
    account: (id) => one({ documentId: id }),
    accountByEmail: (email) => one({ email }),
    accountByGoogleSub: (sub) => one({ googleSub: sub }),
    accountByTeamMember: (id) => one({ teamMember: { documentId: id } }),
    accountByUser: (userId) => one({ user: { id: userId } }),
    createAccount: async (a) => {
      const created = await docs().create({ data: { ...fields(a), ...(await links(a)) } as never });
      return text((created as Raw).documentId);
    },
    updateAccount: async (id, a) => {
      await docs().update({ documentId: id, data: { ...fields(a), ...(await links(a)) } as never });
    },
  };
}

function users(strapi: Core.Strapi): Pick<PortalStore, 'user' | 'createUser' | 'updateUser'> {
  const query = () => strapi.db.query(USER);
  return {
    user: async (id) => {
      const r = await query().findOne({ where: { id } });
      return r ? toUserAuth(r as Raw) : null;
    },
    createUser: async (email, passwordHash) => {
      const role = await strapi.db.query(ROLE).findOne({ where: { type: 'authenticated' }, select: ['id'] });
      const now = new Date();
      const created = await query().create({
        data: {
          documentId: createId(), username: email, email, password: passwordHash, provider: 'local', confirmed: false, blocked: false, role: role?.id,
          createdAt: now, updatedAt: now, publishedAt: now,
        },
      });
      return Number((created as Raw).id);
    },
    updateUser: async (id, u) => {
      const data = defined({ email: u.email, username: u.email, password: u.passwordHash, blocked: u.blocked, confirmed: u.confirmed });
      await query().update({ where: { id }, data });
    },
  };
}

function tokens(strapi: Core.Strapi): Pick<PortalStore, 'tokens' | 'tokenByHash' | 'createToken' | 'updateToken'> {
  const docs = () => strapi.documents(TOKEN);
  const populate = { account: true };
  return {
    tokens: async (accountId, kind) =>
      raws(await docs().findMany({ filters: { account: { documentId: accountId }, kind }, populate, sort: 'createdAt:asc', limit: MAX })).map(toTokenRow),
    tokenByHash: async (hash) => {
      const rows = raws(await docs().findMany({ filters: { secretHash: hash }, populate, limit: 1 }));
      return rows[0] ? toTokenRow(rows[0]) : null;
    },
    createToken: async (t) => {
      const created = await docs().create({ data: { account: t.accountId, kind: t.kind, secretHash: t.secretHash, expiresAt: t.expiresAt, tries: 0 } as never });
      return text((created as Raw).documentId);
    },
    updateToken: async (id, t) => {
      await docs().update({ documentId: id, data: defined(t) as never });
    },
  };
}

function devices(strapi: Core.Strapi): Pick<PortalStore, 'devices' | 'deviceByKey' | 'createDevice' | 'updateDevice'> {
  const docs = () => strapi.documents(DEVICE);
  const populate = { account: true };
  return {
    devices: async (accountId) =>
      raws(await docs().findMany({ filters: { account: { documentId: accountId } }, populate, sort: 'createdAt:asc', limit: MAX })).map(toDeviceRow),
    deviceByKey: async (accountId, keyHash) => {
      const rows = raws(await docs().findMany({ filters: { account: { documentId: accountId }, deviceKeyHash: keyHash }, populate, limit: 1 }));
      return rows[0] ? toDeviceRow(rows[0]) : null;
    },
    createDevice: async (d) => {
      const { accountId, ...rest } = d;
      const created = await docs().create({ data: { ...rest, account: accountId } as never });
      return text((created as Raw).documentId);
    },
    updateDevice: async (id, d) => {
      await docs().update({ documentId: id, data: defined(d) as never });
    },
  };
}

export function strapiPortalStore(strapi: Core.Strapi): PortalStore {
  const scope = transactionScope(strapi);
  return {
    transaction: scope.transaction,
    lockAccount: (id) => scope.lockRow(ACCOUNT_TABLE, id),
    ...limits(strapi, scope), ...accounts(strapi), ...users(strapi), ...tokens(strapi), ...devices(strapi),
    teamMemberName: async (id) => {
      const row = await strapi.documents(TEAM_MEMBER).findOne({ documentId: id, fields: ['name'] });
      return str((row as Raw | null)?.name);
    },
    record: async (line) => {
      await recordHistory(strapi as never, { subjectType: SUBJECT.portalAccount, subjectId: line.subjectId, action: line.action, changes: line.changes, actor: line.actor });
    },
  };
}
