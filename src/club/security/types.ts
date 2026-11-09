import type { TwoFactorMethod } from './api-types';

export type SubjectType = 'portal' | 'admin';
export type Subject = { type: SubjectType; id: string };
export type ChallengePurpose = 'pending-login' | 'email-code' | 'reset-code' | 'passkey-register' | 'passkey-login';

export type FactorRow = {
  id: string; subject: Subject; kind: 'totp' | 'email'; secretBox: string | null; confirmedAt: string | null;
  lastStep: number | null; lastUsedAt: string | null; createdAt: string;
};
export type BackupRow = { id: string; subject: Subject; batch: string; codeMac: string; keyId: string; usedAt: string | null; createdAt: string };
export type ChallengeRow = {
  id: string; purpose: ChallengePurpose; subject: Subject | null; secretMac: string; data: Record<string, unknown>;
  expiresAt: string; usedAt: string | null; tries: number;
};
export type PasskeyRow = {
  id: string; subject: Subject; credentialId: string; publicKey: string; counter: number; transports: string[]; deviceType: string;
  backedUp: boolean; rpId: string; name: string; createdAt: string; lastUsedAt: string | null;
};
export type AdminAccountRow = {
  id: string; adminUserId: number; googleSub: string | null; googleUnlinkedAt: string | null; webauthnUserId: string; lastMethod: TwoFactorMethod | null; passkeyOfferedAt: string | null;
};
export type AdminDeviceRow = {
  id: string; adminUserId: number; deviceKeyHash: string; strapiDeviceId: string; label: string; firstSeenAt: string; lastSeenAt: string;
  twoFactorUntil: string | null; revokedAt: string | null;
  /** Last completed sign-in on this device (the recent-authentication time); null: made at the password step and never finished (unconfirmed). */
  confirmedAt: string | null;
};
export type PortalAccountExtra = { webauthnUserId: string | null; lastMethod: TwoFactorMethod | null; passkeyOfferedAt: string | null };
export type SecurityNotes = { backupNotice?: number };
export type SecurityHistoryLine = { subjectType: SubjectType; subjectId: string; action: string; changes: Record<string, unknown>; actor: string };
export type PurgeCounts = Record<string, number>;
