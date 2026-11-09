import type { TwoFactorMethod } from './api-types';
import type {
  AdminAccountRow, AdminDeviceRow, BackupRow, ChallengePurpose, ChallengeRow, FactorRow, PasskeyRow, PortalAccountExtra, PurgeCounts, SecurityHistoryLine,
  SecurityNotes, Subject,
} from './types';

export type * from './types';

/**
 * Every write that decides a single use or an attempt limit (`acceptStep`, `addTry`, `bumpTries`, `consumeOnce`, `confirmFactor`) is one
 * guarded UPDATE that reports whether a row changed; none takes SELECT ... FOR UPDATE.
 */
export interface SecurityStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  factors(s: Subject): Promise<FactorRow[]>;
  /** Replaces an unconfirmed row of the kind (a fresh row, so its age restarts); throws on a confirmed row of the same kind (the caller checks first). */
  upsertFactor(s: Subject, kind: 'totp' | 'email', f: { secretBox: string | null }): Promise<string>;
  /** `confirmedAt = at where id and confirmedAt is null`; true when one row changed. */
  confirmFactor(id: string, at: string): Promise<boolean>;
  updateFactor(id: string, f: { secretBox?: string; lastUsedAt?: string }): Promise<void>;
  /** `lastStep = step where id and (lastStep is null or lastStep < step)`; true when one row changed. */
  acceptStep(id: string, step: number): Promise<boolean>;
  deleteFactors(s: Subject, kind?: 'totp' | 'email'): Promise<number>;
  unusedBackup(s: Subject): Promise<BackupRow[]>;
  /**
   * One transaction, serialized per subject: every older unused row of the subject is marked used, then the new rows go in.
   * With `onlyIfNone` nothing is written when an unused row exists (the first-method batch); answers whether rows went in.
   */
  insertBackupBatch(s: Subject, batch: string, rows: { codeMac: string; keyId: string }[], at: string, onlyIfNone?: boolean): Promise<boolean>;
  deleteBackup(s: Subject): Promise<number>;
  createChallenge(c: Omit<ChallengeRow, 'id' | 'usedAt' | 'tries'>): Promise<string>;
  challengeByMac(mac: string): Promise<ChallengeRow | null>;
  /** Unused challenges of the subject and purpose, oldest first; the caller checks the expiry. */
  openChallenges(s: Subject, purpose: ChallengePurpose): Promise<ChallengeRow[]>;
  /** Atomic `tries + 1`, returns the new count. */
  addTry(id: string): Promise<number>;
  /** `tries = tries + 1 where id and usedAt is null and tries < max and expiresAt > now`; true when one row changed. */
  bumpTries(id: string, now: Date, max: number): Promise<boolean>;
  /** Guarded `usedAt = at where id and usedAt is null`; true when one row changed. */
  consumeOnce(table: 'backup' | 'challenge', id: string, at: string): Promise<boolean>;
  passkeys(s: Subject): Promise<PasskeyRow[]>;
  passkeyByCredential(credentialId: string): Promise<PasskeyRow | null>;
  createPasskey(p: Omit<PasskeyRow, 'id' | 'lastUsedAt'>): Promise<string>;
  updatePasskey(id: string, p: { counter?: number; lastUsedAt?: string; name?: string }): Promise<void>;
  deletePasskey(id: string): Promise<void>;
  /** Every key of every subject (the cutover script counts them per rpId). */
  allPasskeys(): Promise<PasskeyRow[]>;
  /** Deletes the keys whose rpId is not `rpId` and that were made before `before`; answers how many. Current-rpId keys are never touched. */
  purgeOldPasskeys(rpId: string, before: Date): Promise<number>;
  adminAccount(adminUserId: number): Promise<AdminAccountRow | null>;
  adminAccountByGoogleSub(sub: string): Promise<AdminAccountRow | null>;
  adminAccountByHandle(h: string): Promise<AdminAccountRow | null>;
  /** Creates the row with a 32-byte base64url webauthnUserId when missing. */
  ensureAdminAccount(adminUserId: number): Promise<AdminAccountRow>;
  updateAdminAccount(id: string, a: Partial<Omit<AdminAccountRow, 'id' | 'adminUserId'>>): Promise<void>;
  adminDevices(adminUserId: number): Promise<AdminDeviceRow[]>;
  adminDeviceByKey(adminUserId: number, keyHash: string): Promise<AdminDeviceRow | null>;
  createAdminDevice(d: Omit<AdminDeviceRow, 'id' | 'revokedAt' | 'twoFactorUntil' | 'confirmedAt'>): Promise<string>;
  updateAdminDevice(id: string, d: Partial<Pick<AdminDeviceRow, 'lastSeenAt' | 'twoFactorUntil' | 'revokedAt' | 'label' | 'confirmedAt'>>): Promise<void>;
  portalAccountExtra(accountId: string): Promise<PortalAccountExtra>;
  updatePortalAccountExtra(accountId: string, a: Partial<{ webauthnUserId: string; lastMethod: TwoFactorMethod; passkeyOfferedAt: string | null }>): Promise<void>;
  /**
   * One guarded UPDATE `webauthnUserId = handle where account and webauthnUserId is null`, then a read: answers the stored handle, which is the
   * caller's own only when its write won. Two parallel first needs end on one value.
   */
  setPortalHandleIfNull(accountId: string, handle: string): Promise<string>;
  /** Document ids of the devices of a portal account. */
  portalDeviceIds(accountId: string): Promise<string[]>;
  setPortalDeviceTwoFactor(deviceId: string, until: string | null): Promise<void>;
  securityNotes(s: Subject): Promise<SecurityNotes>;
  setSecurityNotes(s: Subject, n: SecurityNotes): Promise<void>;
  record(line: SecurityHistoryLine): Promise<void>;
  /** Spec 3.9 rules except the old-rpId passkeys (`purgeOldPasskeys`). */
  purge(now: Date): Promise<PurgeCounts>;
}
