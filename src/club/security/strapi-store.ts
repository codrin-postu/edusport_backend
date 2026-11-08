import { randomBytes } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';
import { iso, raws, str, text, transactionScope, type Raw, type Scope } from '../athletes/strapi-store';
import { recordHistory } from '../history';
import { SUBJECT } from '../subjects';
import type { TwoFactorMethod } from './api-types';
import { ADMIN_DEVICE_KEEP_MS, BACKUP_KEEP_MS, CHALLENGE_KEEP_MS, UNCONFIRMED_FACTOR_MS } from './purge-rules';
import type {
  AdminAccountRow, AdminDeviceRow, BackupRow, ChallengePurpose, ChallengeRow, FactorRow, PasskeyRow, SecurityNotes, SecurityStore, Subject, SubjectType,
} from './store';

const FACTOR = 'api::auth-factor.auth-factor' as const;
const BACKUP = 'api::auth-backup-code.auth-backup-code' as const;
const CHALLENGE = 'api::auth-challenge.auth-challenge' as const;
const PASSKEY = 'api::auth-passkey.auth-passkey' as const;
const ADMIN_ACCOUNT = 'api::admin-account.admin-account' as const;
const ADMIN_DEVICE = 'api::admin-device.admin-device' as const;
const PORTAL_ACCOUNT = 'api::portal-account.portal-account' as const;
const PORTAL_DEVICE = 'api::portal-device.portal-device' as const;
const TABLE = { factor: 'auth_factors', backup: 'auth_backup_codes', challenge: 'auth_challenges' } as const;
const MAX = 100000;
const METHODS: readonly TwoFactorMethod[] = ['totp', 'email', 'backup'];

const subjectOf = (r: Raw): Subject => ({ type: r.subjectType === 'admin' ? 'admin' : 'portal', id: text(r.subjectId) });
const where = (s: Subject) => ({ subjectType: s.type, subjectId: s.id });
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const method = (v: unknown): TwoFactorMethod | null => METHODS.find((m) => m === v) ?? null;
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const ago = (d: Date, ms: number): string => new Date(d.getTime() - ms).toISOString();

const toFactor = (r: Raw): FactorRow => ({
  id: text(r.documentId), subject: subjectOf(r), kind: r.kind === 'email' ? 'email' : 'totp', secretBox: str(r.secretBox), confirmedAt: iso(r.confirmedAt),
  lastStep: num(r.lastStep), lastUsedAt: iso(r.lastUsedAt), createdAt: iso(r.createdAt) ?? '',
});
const toBackup = (r: Raw): BackupRow => ({
  id: text(r.documentId), subject: subjectOf(r), batch: text(r.batch), codeMac: text(r.codeMac), keyId: text(r.keyId), usedAt: iso(r.usedAt), createdAt: iso(r.createdAt) ?? '',
});
const toChallenge = (r: Raw): ChallengeRow => ({
  id: text(r.documentId), purpose: text(r.purpose) as ChallengePurpose, subject: r.subjectType && r.subjectId ? subjectOf(r) : null, secretMac: text(r.secretMac),
  data: r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}, expiresAt: iso(r.expiresAt) ?? '', usedAt: iso(r.usedAt), tries: Number(r.tries ?? 0),
});
const toPasskey = (r: Raw): PasskeyRow => ({
  id: text(r.documentId), subject: subjectOf(r), credentialId: text(r.credentialId), publicKey: text(r.publicKey), counter: Number(r.counter ?? 0),
  transports: Array.isArray(r.transports) ? (r.transports as string[]) : [], deviceType: text(r.deviceType), backedUp: r.backedUp === true, rpId: text(r.rpId),
  name: text(r.name), createdAt: iso(r.createdAt) ?? '', lastUsedAt: iso(r.lastUsedAt),
});
const toAdminAccount = (r: Raw): AdminAccountRow => ({
  id: text(r.documentId), adminUserId: Number(r.adminUserId), googleSub: str(r.googleSub), googleUnlinkedAt: iso(r.googleUnlinkedAt), webauthnUserId: text(r.webauthnUserId), lastMethod: method(r.lastMethod),
  passkeyOfferedAt: iso(r.passkeyOfferedAt),
});
const toAdminDevice = (r: Raw): AdminDeviceRow => ({
  id: text(r.documentId), adminUserId: Number(r.adminUserId), deviceKeyHash: text(r.deviceKeyHash), strapiDeviceId: text(r.strapiDeviceId), label: text(r.label),
  firstSeenAt: iso(r.firstSeenAt) ?? '', lastSeenAt: iso(r.lastSeenAt) ?? '', twoFactorUntil: iso(r.twoFactorUntil), revokedAt: iso(r.revokedAt),
});

type Query = (table: string) => Knex.QueryBuilder;
type Write = (table: string, change: (q: Knex.QueryBuilder) => PromiseLike<unknown>) => Promise<number>;

/** The table's query inside the open transaction, if any (never SELECT ... FOR UPDATE: single use is decided by guarded UPDATEs). */
const queryIn = (strapi: Core.Strapi, scope: Scope): Query => (table) => {
  const trx = scope.current();
  const q = strapi.db.getConnection(table);
  return trx ? q.transacting(trx) : q;
};

/** A guarded UPDATE answers the changed row count. */
const writeIn = (query: Query): Write => async (table, change) => Number(await change(query(table)));

function factorStore(strapi: Core.Strapi, write: Write): Pick<SecurityStore, 'factors' | 'upsertFactor' | 'confirmFactor' | 'updateFactor' | 'acceptStep' | 'deleteFactors'> {
  const docs = () => strapi.documents(FACTOR);
  return {
    factors: async (s) => raws(await docs().findMany({ filters: where(s), sort: 'createdAt:asc', limit: MAX })).map(toFactor),
    upsertFactor: async (s, kind, f) => {
      const found = raws(await docs().findMany({ filters: { ...where(s), kind }, limit: 1 }))[0];
      if (found?.confirmedAt) throw new Error('duplicate key: a confirmed factor of this kind exists');
      if (found) await docs().delete({ documentId: text(found.documentId) });
      const created = await docs().create({ data: { subjectType: s.type, subjectId: s.id, kind, secretBox: f.secretBox } as never });
      return text((created as Raw).documentId);
    },
    confirmFactor: async (id, at) =>
      (await write(TABLE.factor, (q) => q.where('document_id', id).whereNull('confirmed_at').update({ confirmed_at: new Date(at) }))) === 1,
    updateFactor: async (id, f) => {
      await docs().update({ documentId: id, data: defined(f) as never });
    },
    acceptStep: async (id, step) =>
      (await write(TABLE.factor, (q) =>
        q.where('document_id', id).andWhere((w) => w.whereNull('last_step').orWhere('last_step', '<', step)).update({ last_step: step }),
      )) === 1,
    deleteFactors: async (s, kind) => (await strapi.db.query(FACTOR).deleteMany({ where: { ...where(s), ...(kind ? { kind } : {}) } })).count,
  };
}

function backupStore(strapi: Core.Strapi, scope: Scope, query: Query, write: Write): Pick<SecurityStore, 'unusedBackup' | 'insertBackupBatch' | 'deleteBackup'> {
  const docs = () => strapi.documents(BACKUP);
  return {
    unusedBackup: async (s) => raws(await docs().findMany({ filters: { ...where(s), usedAt: { $null: true } }, sort: 'createdAt:asc', limit: MAX })).map(toBackup),
    insertBackupBatch: (s, batch, rows, at, onlyIfNone = false) =>
      scope.transaction(async () => {
        // One writer per subject at a time: under READ COMMITTED two batches would not see each other's uncommitted rows.
        const trx = scope.current();
        if (trx && strapi.db.dialect.client === 'postgres') await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [`2fa-backup:${s.type}:${s.id}`]);
        if (onlyIfNone) {
          const [open] = (await query(TABLE.backup).where({ subject_type: s.type, subject_id: s.id }).whereNull('used_at').count({ c: '*' })) as { c: unknown }[];
          if (Number(open?.c ?? 0) > 0) return false;
        }
        await write(TABLE.backup, (q) => q.where({ subject_type: s.type, subject_id: s.id }).whereNull('used_at').update({ used_at: new Date(at) }));
        for (const r of rows) await docs().create({ data: { subjectType: s.type, subjectId: s.id, batch, codeMac: r.codeMac, keyId: r.keyId } as never });
        return true;
      }),
    deleteBackup: async (s) => (await strapi.db.query(BACKUP).deleteMany({ where: where(s) })).count,
  };
}

function challengeStore(strapi: Core.Strapi, query: Query, write: Write): Pick<SecurityStore, 'createChallenge' | 'challengeByMac' | 'openChallenges' | 'addTry' | 'bumpTries' | 'consumeOnce'> {
  const docs = () => strapi.documents(CHALLENGE);
  return {
    createChallenge: async (c) => {
      const created = await docs().create({
        data: {
          purpose: c.purpose, subjectType: c.subject?.type ?? null, subjectId: c.subject?.id ?? null, secretMac: c.secretMac, data: c.data, expiresAt: c.expiresAt, tries: 0,
        } as never,
      });
      return text((created as Raw).documentId);
    },
    challengeByMac: async (mac) => {
      const row = raws(await docs().findMany({ filters: { secretMac: mac }, limit: 1 }))[0];
      return row ? toChallenge(row) : null;
    },
    openChallenges: async (s, purpose) =>
      raws(await docs().findMany({ filters: { ...where(s), purpose, usedAt: { $null: true } }, sort: 'createdAt:asc', limit: MAX })).map(toChallenge),
    addTry: async (id) => {
      const rows = (await query(TABLE.challenge).where('document_id', id).update({ tries: strapi.db.connection.raw('coalesce(tries, 0) + 1') }).returning('tries')) as { tries: unknown }[];
      return Number(rows[0]?.tries ?? 0);
    },
    bumpTries: async (id, now, max) =>
      (await write(TABLE.challenge, (q) =>
        q.where('document_id', id).whereNull('used_at').andWhere('expires_at', '>', now)
          .andWhere((w) => w.whereNull('tries').orWhere('tries', '<', max))
          .update({ tries: strapi.db.connection.raw('coalesce(tries, 0) + 1') }),
      )) === 1,
    consumeOnce: async (table, id, at) =>
      (await write(TABLE[table], (q) => q.where('document_id', id).whereNull('used_at').update({ used_at: new Date(at) }))) === 1,
  };
}

function passkeyStore(strapi: Core.Strapi): Pick<SecurityStore, 'passkeys' | 'passkeyByCredential' | 'createPasskey' | 'updatePasskey' | 'deletePasskey'> {
  const docs = () => strapi.documents(PASSKEY);
  return {
    passkeys: async (s) => raws(await docs().findMany({ filters: where(s), sort: 'createdAt:asc', limit: MAX })).map(toPasskey),
    passkeyByCredential: async (credentialId) => {
      const row = raws(await docs().findMany({ filters: { credentialId }, limit: 1 }))[0];
      return row ? toPasskey(row) : null;
    },
    createPasskey: async (p) => {
      const { subject, createdAt: _createdAt, ...rest } = p;
      const created = await docs().create({ data: { ...rest, subjectType: subject.type, subjectId: subject.id } as never });
      return text((created as Raw).documentId);
    },
    updatePasskey: async (id, p) => {
      await docs().update({ documentId: id, data: defined(p) as never });
    },
    deletePasskey: async (id) => {
      await docs().delete({ documentId: id });
    },
  };
}

function adminStore(strapi: Core.Strapi): Pick<SecurityStore, 'adminAccount' | 'adminAccountByGoogleSub' | 'adminAccountByHandle' | 'ensureAdminAccount' | 'updateAdminAccount' | 'adminDevices' | 'adminDeviceByKey' | 'createAdminDevice' | 'updateAdminDevice'> {
  const accounts = () => strapi.documents(ADMIN_ACCOUNT);
  const devices = () => strapi.documents(ADMIN_DEVICE);
  const oneAccount = async (filters: Record<string, unknown>) => {
    const row = raws(await accounts().findMany({ filters, limit: 1 }))[0];
    return row ? toAdminAccount(row) : null;
  };
  return {
    adminAccount: (adminUserId) => oneAccount({ adminUserId }),
    adminAccountByGoogleSub: (googleSub) => oneAccount({ googleSub }),
    adminAccountByHandle: (webauthnUserId) => oneAccount({ webauthnUserId }),
    ensureAdminAccount: async (adminUserId) => {
      const found = await oneAccount({ adminUserId });
      if (found) return found;
      try {
        const created = await accounts().create({ data: { adminUserId, webauthnUserId: randomBytes(32).toString('base64url') } as never });
        return toAdminAccount(created as Raw);
      } catch (err) {
        const again = await oneAccount({ adminUserId });
        if (again) return again;
        throw err;
      }
    },
    updateAdminAccount: async (id, a) => {
      await accounts().update({ documentId: id, data: defined(a) as never });
    },
    adminDevices: async (adminUserId) => raws(await devices().findMany({ filters: { adminUserId }, sort: 'createdAt:asc', limit: MAX })).map(toAdminDevice),
    adminDeviceByKey: async (adminUserId, deviceKeyHash) => {
      const row = raws(await devices().findMany({ filters: { adminUserId, deviceKeyHash }, limit: 1 }))[0];
      return row ? toAdminDevice(row) : null;
    },
    createAdminDevice: async (d) => {
      const created = await devices().create({ data: d as never });
      return text((created as Raw).documentId);
    },
    updateAdminDevice: async (id, d) => {
      await devices().update({ documentId: id, data: defined(d) as never });
    },
  };
}

function portalStore(strapi: Core.Strapi): Pick<SecurityStore, 'portalAccountExtra' | 'updatePortalAccountExtra' | 'portalDeviceIds' | 'setPortalDeviceTwoFactor'> {
  return {
    portalAccountExtra: async (accountId) => {
      const r = (await strapi.documents(PORTAL_ACCOUNT).findOne({ documentId: accountId, fields: ['webauthnUserId', 'lastMethod', 'passkeyOfferedAt'] })) as Raw | null;
      return { webauthnUserId: str(r?.webauthnUserId), lastMethod: method(r?.lastMethod), passkeyOfferedAt: iso(r?.passkeyOfferedAt) };
    },
    updatePortalAccountExtra: async (accountId, a) => {
      await strapi.documents(PORTAL_ACCOUNT).update({ documentId: accountId, data: defined(a) as never });
    },
    portalDeviceIds: async (accountId) =>
      raws(await strapi.documents(PORTAL_DEVICE).findMany({ filters: { account: { documentId: accountId } }, fields: ['documentId'], limit: MAX })).map((r) => text(r.documentId)),
    setPortalDeviceTwoFactor: async (deviceId, until) => {
      await strapi.documents(PORTAL_DEVICE).update({ documentId: deviceId, data: { twoFactorUntil: until } as never });
    },
  };
}

function notesStore(strapi: Core.Strapi, ensure: SecurityStore['ensureAdminAccount']): Pick<SecurityStore, 'securityNotes' | 'setSecurityNotes' | 'record'> {
  const asNotes = (v: unknown): SecurityNotes => (v && typeof v === 'object' ? (v as SecurityNotes) : {});
  const subjectType = (t: SubjectType): string => (t === 'admin' ? SUBJECT.adminUser : SUBJECT.portalAccount);
  return {
    securityNotes: async (s) => {
      if (s.type === 'portal') {
        const r = (await strapi.documents(PORTAL_ACCOUNT).findOne({ documentId: s.id, fields: ['securityNotes'] })) as Raw | null;
        return asNotes(r?.securityNotes);
      }
      const row = raws(await strapi.documents(ADMIN_ACCOUNT).findMany({ filters: { adminUserId: Number(s.id) }, limit: 1 }))[0];
      return asNotes(row?.securityNotes);
    },
    setSecurityNotes: async (s, n) => {
      if (s.type === 'portal') {
        await strapi.documents(PORTAL_ACCOUNT).update({ documentId: s.id, data: { securityNotes: n } as never });
        return;
      }
      const account = await ensure(Number(s.id));
      await strapi.documents(ADMIN_ACCOUNT).update({ documentId: account.id, data: { securityNotes: n } as never });
    },
    record: async (line) => {
      await recordHistory(strapi as never, { subjectType: subjectType(line.subjectType), subjectId: line.subjectId, action: line.action, changes: line.changes, actor: line.actor });
    },
  };
}

function purgeStore(strapi: Core.Strapi): Pick<SecurityStore, 'purge'> {
  const count = async (uid: typeof FACTOR | typeof BACKUP | typeof CHALLENGE | typeof ADMIN_DEVICE, w: Record<string, unknown>): Promise<number> =>
    (await strapi.db.query(uid).deleteMany({ where: w })).count;
  return {
    purge: async (now) => ({
      factors: await count(FACTOR, { confirmedAt: { $null: true }, createdAt: { $lt: ago(now, UNCONFIRMED_FACTOR_MS) } }),
      challenges: await count(CHALLENGE, { $or: [{ usedAt: { $lt: ago(now, CHALLENGE_KEEP_MS) } }, { expiresAt: { $lt: ago(now, CHALLENGE_KEEP_MS) } }] }),
      backupCodes: await count(BACKUP, { usedAt: { $lt: ago(now, BACKUP_KEEP_MS) } }),
      adminDevices: await count(ADMIN_DEVICE, { revokedAt: { $lt: ago(now, ADMIN_DEVICE_KEEP_MS) } }),
    }),
  };
}

export function strapiSecurityStore(strapi: Core.Strapi): SecurityStore {
  const scope = transactionScope(strapi);
  const query = queryIn(strapi, scope);
  const write = writeIn(query);
  const admin = adminStore(strapi);
  return {
    transaction: scope.transaction,
    ...factorStore(strapi, write), ...backupStore(strapi, scope, query, write), ...challengeStore(strapi, query, write), ...passkeyStore(strapi),
    ...admin, ...portalStore(strapi), ...notesStore(strapi, admin.ensureAdminAccount), ...purgeStore(strapi),
  };
}
