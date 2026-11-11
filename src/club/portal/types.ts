import type { LimitState } from './limits';

export type AccountStatus = 'invited' | 'active' | 'disabled';
export type AccountRow = {
  id: string; userId: number; email: string; status: AccountStatus; teamMemberId: string | null; phone: string | null; googleSub: string | null;
  /** When the Google link was removed (an e-mail change); a link removed this way is never re-made by e-mail alone (spec 4.6, user ruling 2026-11-09). */
  googleUnlinkedAt: string | null;
  invitedAt: string | null; invitedBy: string | null; activatedAt: string | null; disabledAt: string | null; disabledBy: string | null; lastLoginAt: string | null;
  /** Display name of a holder (7-1); null for a coach, whose name is the team member's. */
  name: string | null;
  /** When the coach side was disabled while the account kept its holder side (7-1); null otherwise. */
  coachDisabledAt: string | null;
  passwordChangedAt: string | null;
  notifySchedule: boolean;
};
export type AccountWrite = Partial<Omit<AccountRow, 'id' | 'userId'>>;
export type TokenKind = 'invite' | 'reset';
export type TokenRow = { id: string; accountId: string; kind: TokenKind; secretHash: string; expiresAt: string; usedAt: string | null; tries: number; createdAt: string;
  /** The host an invite link points to; null for reset codes (they work on either host) and for invites made before phase 7 (read as antrenor). */
  host: string | null;
};
export type LimitRow = LimitState & { id: string; key: string };
export type DeviceRow = {
  id: string; accountId: string; host: string; deviceKeyHash: string; sessionId: string | null; label: string; firstSeenAt: string; lastSeenAt: string; revokedAt: string | null;
  /** The end of the remembered-device 2FA skip (6b); null when this device must answer the second step. */
  twoFactorUntil: string | null;
  /**
   * When a completed sign-in last confirmed this device (password, second step, Google, passkey): the recent-authentication time. Null with no
   * session either means a device row made at the password step that never finished (unconfirmed: hidden, purged after a day).
   */
  confirmedAt: string | null;
};
export type UserAuth = { id: number; email: string; passwordHash: string | null; blocked: boolean; confirmed: boolean };
export type UserWrite = { email?: string; passwordHash?: string | null; blocked?: boolean; confirmed?: boolean };
export type HistoryLine = { subjectId: string; action: string; changes: Record<string, unknown>; actor: string };
export type SessionRow = {
  id: string; accountId: string; deviceId: string; host: string; refreshHash: string; previousRefreshHash: string | null; accessHash: string | null;
  accessExpiresAt: string | null; familyStartedAt: string; lastUsedAt: string; revokedAt: string | null;
};
