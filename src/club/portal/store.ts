import type { LimitState } from './limits';
import type {
  AccountRow, AccountStatus, AccountWrite, DeviceRow, HistoryLine, LimitRow, SessionRow, TokenKind, TokenRow, UserAuth, UserWrite,
} from './types';

export type { AccountRow, AccountStatus, AccountWrite, DeviceRow, HistoryLine, LimitRow, SessionRow, TokenKind, TokenRow, UserAuth, UserWrite } from './types';

export type NewAccount = AccountWrite & { userId: number; email: string; status: AccountStatus };
export type NewToken = Omit<TokenRow, 'id' | 'createdAt' | 'usedAt' | 'tries'>;
export type NewDevice = Omit<DeviceRow, 'id' | 'revokedAt' | 'twoFactorUntil'>;
export type NewSession = Omit<SessionRow, 'id' | 'revokedAt' | 'previousRefreshHash'>;
export type SessionWrite = Partial<Omit<SessionRow, 'id' | 'accountId' | 'deviceId' | 'host' | 'familyStartedAt'>>;
export type DeviceWrite = Partial<Pick<DeviceRow, 'sessionId' | 'lastSeenAt' | 'revokedAt' | 'label'>>;

export interface PortalStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Lock order: team member, account, session, limit row. */
  lockTeamMember(id: string): Promise<void>;
  lockAccount(id: string): Promise<void>;
  /** Inserts the row when missing (count 0, windowStart now), then takes SELECT ... FOR UPDATE. */
  lockLimit(key: string): Promise<LimitRow>;
  saveLimit(id: string, s: LimitState): Promise<void>;
  purgeLimits(olderThan: Date, now: Date): Promise<number>;
  /** Device rows revoked before the instant. */
  purgeDevices(revokedBefore: Date): Promise<number>;
  /** Tokens used before the instant or expired before it; an unused valid token stays. */
  purgeTokens(before: Date): Promise<number>;
  /** Sessions revoked before the instant, or whose end (idle 7 days, family 30 days) fell before it; a live one stays. */
  purgeSessions(before: Date): Promise<number>;
  account(id: string): Promise<AccountRow | null>;
  accountByEmail(email: string): Promise<AccountRow | null>;
  accountByGoogleSub(sub: string): Promise<AccountRow | null>;
  accountByTeamMember(teamMemberId: string): Promise<AccountRow | null>;
  accountByUser(userId: number): Promise<AccountRow | null>;
  createAccount(a: NewAccount): Promise<string>;
  updateAccount(id: string, a: AccountWrite): Promise<void>;
  user(id: number): Promise<UserAuth | null>;
  /** username = email, provider 'local', role Authenticated, confirmed false; the hash is stored verbatim; null for an invited coach who has not chosen a password. */
  createUser(email: string, passwordHash: string | null): Promise<number>;
  updateUser(id: number, u: UserWrite): Promise<void>;
  tokens(accountId: string, kind: TokenKind): Promise<TokenRow[]>;
  tokenByHash(hash: string): Promise<TokenRow | null>;
  createToken(t: NewToken): Promise<string>;
  updateToken(id: string, t: { usedAt?: string; tries?: number }): Promise<void>;
  devices(accountId: string): Promise<DeviceRow[]>;
  deviceByKey(accountId: string, keyHash: string): Promise<DeviceRow | null>;
  createDevice(d: NewDevice): Promise<string>;
  updateDevice(id: string, d: DeviceWrite): Promise<void>;
  lockSession(id: string): Promise<void>;
  session(id: string): Promise<SessionRow | null>;
  sessionByAccess(hash: string): Promise<SessionRow | null>;
  /** Sessions of the account that are not revoked. */
  activeSessions(accountId: string): Promise<SessionRow[]>;
  createSession(s: NewSession): Promise<string>;
  updateSession(id: string, s: SessionWrite): Promise<void>;
  teamMemberName(id: string): Promise<string | null>;
  record(line: HistoryLine): Promise<void>;
}
