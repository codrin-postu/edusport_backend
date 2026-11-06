import type { LimitState } from './limits';

export type AccountStatus = 'invited' | 'active' | 'disabled';
export type AccountRow = {
  id: string; userId: number; email: string; status: AccountStatus; teamMemberId: string | null; phone: string | null; googleSub: string | null;
  invitedAt: string | null; invitedBy: string | null; activatedAt: string | null; disabledAt: string | null; disabledBy: string | null; lastLoginAt: string | null;
};
export type AccountWrite = Partial<Omit<AccountRow, 'id' | 'userId'>>;
export type TokenKind = 'invite' | 'reset';
export type TokenRow = { id: string; accountId: string; kind: TokenKind; secretHash: string; expiresAt: string; usedAt: string | null; tries: number; createdAt: string };
export type LimitRow = LimitState & { id: string; key: string };
export type DeviceRow = {
  id: string; accountId: string; deviceKeyHash: string; sessionId: string | null; label: string; firstSeenAt: string; lastSeenAt: string; revokedAt: string | null;
};
export type UserAuth = { id: number; email: string; passwordHash: string | null; blocked: boolean; confirmed: boolean };
export type UserWrite = { email?: string; passwordHash?: string; blocked?: boolean; confirmed?: boolean };
export type HistoryLine = { subjectId: string; action: string; changes: Record<string, unknown>; actor: string };
export type SessionRow = {
  id: string; accountId: string; deviceId: string; refreshHash: string; previousRefreshHash: string | null; accessHash: string | null;
  accessExpiresAt: string | null; familyStartedAt: string; lastUsedAt: string; revokedAt: string | null;
};
