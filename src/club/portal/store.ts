import type { LimitState } from './limits';
import type {
  AccountRow, AccountStatus, AccountWrite, DeviceRow, HistoryLine, LimitRow, TokenKind, TokenRow, UserAuth, UserWrite,
} from './types';

export type { AccountRow, AccountStatus, AccountWrite, DeviceRow, HistoryLine, LimitRow, TokenKind, TokenRow, UserAuth, UserWrite } from './types';

export type NewAccount = AccountWrite & { userId: number; email: string; status: AccountStatus };
export type NewToken = Omit<TokenRow, 'id' | 'createdAt' | 'usedAt' | 'tries'>;
export type NewDevice = Omit<DeviceRow, 'id' | 'revokedAt'>;
export type DeviceWrite = Partial<Pick<DeviceRow, 'sessionId' | 'lastSeenAt' | 'revokedAt' | 'label'>>;

export interface PortalStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  lockAccount(id: string): Promise<void>;
  /** Inserts the row when missing (count 0, windowStart now), then takes SELECT ... FOR UPDATE. */
  lockLimit(key: string): Promise<LimitRow>;
  saveLimit(id: string, s: LimitState): Promise<void>;
  purgeLimits(olderThan: Date, now: Date): Promise<number>;
  account(id: string): Promise<AccountRow | null>;
  accountByEmail(email: string): Promise<AccountRow | null>;
  accountByGoogleSub(sub: string): Promise<AccountRow | null>;
  accountByTeamMember(teamMemberId: string): Promise<AccountRow | null>;
  accountByUser(userId: number): Promise<AccountRow | null>;
  createAccount(a: NewAccount): Promise<string>;
  updateAccount(id: string, a: AccountWrite): Promise<void>;
  user(id: number): Promise<UserAuth | null>;
  /** username = email, provider 'local', role Authenticated, confirmed false; the hash is stored verbatim. */
  createUser(email: string, passwordHash: string): Promise<number>;
  updateUser(id: number, u: UserWrite): Promise<void>;
  tokens(accountId: string, kind: TokenKind): Promise<TokenRow[]>;
  tokenByHash(hash: string): Promise<TokenRow | null>;
  createToken(t: NewToken): Promise<string>;
  updateToken(id: string, t: { usedAt?: string; tries?: number }): Promise<void>;
  devices(accountId: string): Promise<DeviceRow[]>;
  deviceByKey(accountId: string, keyHash: string): Promise<DeviceRow | null>;
  createDevice(d: NewDevice): Promise<string>;
  updateDevice(id: string, d: DeviceWrite): Promise<void>;
  teamMemberName(id: string): Promise<string | null>;
  record(line: HistoryLine): Promise<void>;
}
