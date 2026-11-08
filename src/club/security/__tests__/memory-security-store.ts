import { randomBytes } from 'node:crypto';
import { ADMIN_DEVICE_KEEP_MS, BACKUP_KEEP_MS, CHALLENGE_KEEP_MS, UNCONFIRMED_FACTOR_MS } from '../purge-rules';
import type {
  AdminAccountRow, AdminDeviceRow, BackupRow, ChallengeRow, FactorRow, PasskeyRow, PortalAccountExtra, SecurityHistoryLine, SecurityNotes, SecurityStore, Subject,
} from '../store';

type Stamped<T> = T & { createdAt: string };
export type MemorySecurity = {
  store: SecurityStore;
  /** Every row of every table as JSON-able data, for dump checks. */
  dump(): unknown;
  history: SecurityHistoryLine[];
  portalDeviceUntil: Map<string, string | null>;
  /** Devices a portal account owns, by account id (the portal store is a different one in tests). */
  portalDevices: Map<string, string[]>;
};

const same = (a: Subject, b: Subject): boolean => a.type === b.type && a.id === b.id;
const copy = <T>(v: T): T => structuredClone(v);
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** In-memory store with the guarded-update semantics of the Strapi one; the three single-use writes run one after another per row id. */
export function memorySecurityStore(now: () => Date = () => new Date()): MemorySecurity {
  const factors: FactorRow[] = [];
  let backups: BackupRow[] = [];
  const challenges: ChallengeRow[] = [];
  const challengeCreated = new Map<string, string>();
  const passkeys: PasskeyRow[] = [];
  const adminAccounts: AdminAccountRow[] = [];
  const adminDevices: AdminDeviceRow[] = [];
  const notes = new Map<string, SecurityNotes>();
  const portalExtra = new Map<string, PortalAccountExtra>();
  const history: SecurityHistoryLine[] = [];
  const portalDeviceUntil = new Map<string, string | null>();
  const portalDevices = new Map<string, string[]>();
  let seq = 0;
  const id = (p: string): string => `${p}${(seq += 1)}`;
  const stamp = (): string => now().toISOString();

  const chains = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, fn: () => T): Promise<T> => {
    const run = (chains.get(key) ?? Promise.resolve()).then(() => new Promise<void>((r) => setImmediate(r))).then(fn);
    chains.set(key, run.catch(() => undefined));
    return run;
  };

  const tables = () => ({ factors, backups, challenges, passkeys, adminAccounts, adminDevices });
  let depth = 0;

  const store: SecurityStore = {
    async transaction(fn) {
      const snap = depth === 0 ? copy({ f: factors, b: backups, c: challenges, p: passkeys, a: adminAccounts, d: adminDevices, h: history }) : null;
      depth += 1;
      try {
        return await fn();
      } catch (e) {
        if (snap) {
          factors.splice(0, factors.length, ...snap.f);
          backups = snap.b;
          challenges.splice(0, challenges.length, ...snap.c);
          passkeys.splice(0, passkeys.length, ...snap.p);
          adminAccounts.splice(0, adminAccounts.length, ...snap.a);
          adminDevices.splice(0, adminDevices.length, ...snap.d);
          history.splice(0, history.length, ...snap.h);
        }
        throw e;
      } finally {
        depth -= 1;
      }
    },
    factors: async (s) => copy(factors.filter((f) => same(f.subject, s))),
    async upsertFactor(s, kind, f) {
      const found = factors.find((x) => same(x.subject, s) && x.kind === kind);
      if (found?.confirmedAt) throw new Error('duplicate key: a confirmed factor of this kind exists');
      if (found) factors.splice(factors.indexOf(found), 1);
      const row: FactorRow = { id: id('fac'), subject: copy(s), kind, secretBox: f.secretBox, confirmedAt: null, lastStep: null, lastUsedAt: null, createdAt: stamp() };
      factors.push(row);
      return row.id;
    },
    confirmFactor: (fid, at) =>
      serial(fid, () => {
        const row = factors.find((x) => x.id === fid);
        if (!row || row.confirmedAt !== null) return false;
        row.confirmedAt = at;
        return true;
      }),
    async updateFactor(fid, f) {
      const row = factors.find((x) => x.id === fid);
      if (!row) throw new Error(`fake: no factor ${fid}`);
      Object.assign(row, defined(f));
    },
    acceptStep: (fid, step) =>
      serial(fid, () => {
        const row = factors.find((x) => x.id === fid);
        if (!row || (row.lastStep !== null && row.lastStep >= step)) return false;
        row.lastStep = step;
        return true;
      }),
    async deleteFactors(s, kind) {
      const keep = factors.filter((f) => !(same(f.subject, s) && (kind === undefined || f.kind === kind)));
      const n = factors.length - keep.length;
      factors.splice(0, factors.length, ...keep);
      return n;
    },
    unusedBackup: async (s) => copy(backups.filter((b) => same(b.subject, s) && b.usedAt === null)),
    async insertBackupBatch(s, batch, rows, at, onlyIfNone = false) {
      return store.transaction(async () => {
        if (onlyIfNone && backups.some((b) => same(b.subject, s) && b.usedAt === null)) return false;
        for (const b of backups) if (same(b.subject, s) && b.usedAt === null) b.usedAt = at;
        for (const r of rows) backups.push({ id: id('bak'), subject: copy(s), batch, codeMac: r.codeMac, keyId: r.keyId, usedAt: null, createdAt: at });
        return true;
      });
    },
    async deleteBackup(s) {
      const keep = backups.filter((b) => !same(b.subject, s));
      const n = backups.length - keep.length;
      backups = keep;
      return n;
    },
    async createChallenge(c) {
      if (challenges.some((x) => x.secretMac === c.secretMac)) throw new Error('duplicate key: secretMac');
      const row: ChallengeRow = { ...copy(c), id: id('chl'), usedAt: null, tries: 0 };
      challenges.push(row);
      challengeCreated.set(row.id, stamp());
      return row.id;
    },
    challengeByMac: async (mac) => copy(challenges.find((c) => c.secretMac === mac) ?? null),
    openChallenges: async (s, purpose) => copy(challenges.filter((c) => c.purpose === purpose && c.usedAt === null && c.subject && same(c.subject, s))),
    addTry: (cid) =>
      serial(cid, () => {
        const row = challenges.find((c) => c.id === cid);
        if (!row) throw new Error(`fake: no challenge ${cid}`);
        row.tries += 1;
        return row.tries;
      }),
    bumpTries: (cid, at, max) =>
      serial(cid, () => {
        const row = challenges.find((c) => c.id === cid);
        if (!row || row.usedAt !== null || row.tries >= max || Date.parse(row.expiresAt) <= at.getTime()) return false;
        row.tries += 1;
        return true;
      }),
    consumeOnce: (table, rid, at) =>
      serial(`${table}:${rid}`, () => {
        const row = table === 'backup' ? backups.find((b) => b.id === rid) : challenges.find((c) => c.id === rid);
        if (!row || row.usedAt !== null) return false;
        row.usedAt = at;
        return true;
      }),
    passkeys: async (s) => copy(passkeys.filter((p) => same(p.subject, s))),
    passkeyByCredential: async (cred) => copy(passkeys.find((p) => p.credentialId === cred) ?? null),
    async createPasskey(p) {
      if (passkeys.some((x) => x.credentialId === p.credentialId)) throw new Error('duplicate key: credentialId');
      const row: PasskeyRow = { ...copy(p), id: id('pk'), lastUsedAt: null };
      passkeys.push(row);
      return row.id;
    },
    async updatePasskey(pid, p) {
      const row = passkeys.find((x) => x.id === pid);
      if (!row) throw new Error(`fake: no passkey ${pid}`);
      Object.assign(row, defined(p));
    },
    async deletePasskey(pid) {
      const i = passkeys.findIndex((x) => x.id === pid);
      if (i >= 0) passkeys.splice(i, 1);
    },
    adminAccount: async (uid) => copy(adminAccounts.find((a) => a.adminUserId === uid) ?? null),
    adminAccountByGoogleSub: async (sub) => copy(adminAccounts.find((a) => a.googleSub === sub) ?? null),
    adminAccountByHandle: async (h) => copy(adminAccounts.find((a) => a.webauthnUserId === h) ?? null),
    async ensureAdminAccount(uid) {
      let row = adminAccounts.find((a) => a.adminUserId === uid);
      if (!row) {
        row = { id: id('adm'), adminUserId: uid, googleSub: null, googleUnlinkedAt: null, webauthnUserId: randomBytes(32).toString('base64url'), lastMethod: null, passkeyOfferedAt: null };
        adminAccounts.push(row);
      }
      return copy(row);
    },
    async updateAdminAccount(aid, a) {
      const row = adminAccounts.find((x) => x.id === aid);
      if (!row) throw new Error(`fake: no admin account ${aid}`);
      Object.assign(row, defined(a));
    },
    adminDevices: async (uid) => copy(adminDevices.filter((d) => d.adminUserId === uid)),
    adminDeviceByKey: async (uid, key) => copy(adminDevices.find((d) => d.adminUserId === uid && d.deviceKeyHash === key) ?? null),
    async createAdminDevice(d) {
      if (adminDevices.some((x) => x.strapiDeviceId === d.strapiDeviceId)) throw new Error('duplicate key: strapiDeviceId');
      const row: AdminDeviceRow = { ...copy(d), id: id('dev'), revokedAt: null, twoFactorUntil: null };
      adminDevices.push(row);
      return row.id;
    },
    async updateAdminDevice(did, d) {
      const row = adminDevices.find((x) => x.id === did);
      if (!row) throw new Error(`fake: no admin device ${did}`);
      Object.assign(row, defined(d));
    },
    portalAccountExtra: async (aid) => copy(portalExtra.get(aid) ?? { webauthnUserId: null, lastMethod: null, passkeyOfferedAt: null }),
    async updatePortalAccountExtra(aid, a) {
      const cur = portalExtra.get(aid) ?? { webauthnUserId: null, lastMethod: null, passkeyOfferedAt: null };
      portalExtra.set(aid, {
        webauthnUserId: a.webauthnUserId ?? cur.webauthnUserId,
        lastMethod: a.lastMethod ?? cur.lastMethod,
        passkeyOfferedAt: a.passkeyOfferedAt === undefined ? cur.passkeyOfferedAt : a.passkeyOfferedAt,
      });
    },
    portalDeviceIds: async (aid) => [...(portalDevices.get(aid) ?? [])],
    async setPortalDeviceTwoFactor(did, until) {
      portalDeviceUntil.set(did, until);
    },
    securityNotes: async (s) => copy(notes.get(`${s.type}:${s.id}`) ?? {}),
    async setSecurityNotes(s, n) {
      notes.set(`${s.type}:${s.id}`, copy(n));
    },
    async record(line) {
      history.push(copy(line));
    },
    async purge(at) {
      const ms = at.getTime();
      const old = (iso: string | null, keep: number): boolean => iso !== null && Date.parse(iso) < ms - keep;
      const sweep = <T>(rows: T[], drop: (r: T) => boolean): number => {
        const keep = rows.filter((r) => !drop(r));
        const n = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return n;
      };
      const out = {
        factors: sweep(factors, (f) => f.confirmedAt === null && old(f.createdAt, UNCONFIRMED_FACTOR_MS)),
        challenges: sweep(challenges, (c) => old(c.usedAt, CHALLENGE_KEEP_MS) || old(c.expiresAt, CHALLENGE_KEEP_MS)),
        backupCodes: 0,
        adminDevices: sweep(adminDevices, (d) => old(d.revokedAt, ADMIN_DEVICE_KEEP_MS)),
      };
      const keep = backups.filter((b) => !old(b.usedAt, BACKUP_KEEP_MS));
      out.backupCodes = backups.length - keep.length;
      backups = keep;
      return out;
    },
  };
  return {
    store,
    history,
    portalDeviceUntil,
    portalDevices,
    dump: () => copy({ ...tables(), notes: [...notes], portalExtra: [...portalExtra], history }),
  };
}
