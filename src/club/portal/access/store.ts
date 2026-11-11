import type { AccessRow, AthleteForAccess, NewAccess, RevokeReason } from './types';

export type { AccessRow, AthleteForAccess, NewAccess, RevokeReason } from './types';

export interface AccessStore {
  liveByAthlete(athleteId: string): Promise<AccessRow | null>;
  liveByAccount(accountId: string): Promise<AccessRow[]>;
  /** One live row per athlete: a second one is refused by the database (code 23505). */
  createAccess(row: NewAccess): Promise<string>;
  revokeAccess(id: string, w: { revokedAt: string; revokedBy: string; revokeReason: RevokeReason }): Promise<void>;
  setLevelSeen(id: string, groupId: string, at: string): Promise<void>;
  moveAccess(id: string, athleteId: string): Promise<void>;
  /** Takes the athlete row lock; lock order is athlete, account, team member. Only inside a transaction. */
  lockAthlete(athleteId: string): Promise<void>;
  athleteForAccess(athleteId: string): Promise<AthleteForAccess | null>;
  /** One history line on the athlete's record (the account's own lines go through `PortalStore.record`). */
  recordAthlete(line: { athleteId: string; action: string; changes: Record<string, unknown>; actor: string }): Promise<void>;
}
