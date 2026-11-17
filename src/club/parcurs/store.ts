import type { JumpCode, JumpLevel } from './api-types';

export type AwardRow = {
  id: string; athleteId: string; kind: 'steaua' | 'test' | 'jump'; jump: JumpCode | null; level: JumpLevel | null;
  givenBy: { teamMemberId: string } | { adminId: string }; givenOn: string;
};
/** `source` is `m:YYYY-MM` (one grant per month), `size` the pins it allows. */
export type GrantRow = { id: string; athleteId: string; source: string; size: number; createdOn: string; expiresOn: string };
export type PinRow = { id: string; grantId: string; giverId: string; recipientId: string; design: number; givenOn: string };

export interface ParcursStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  /** Row lock on the athlete (inside a transaction); take it after any account or registration locks. */
  lockAthlete(id: string): Promise<void>;
  awards(q: { athleteId?: string }): Promise<AwardRow[]>;
  addAward(row: Omit<AwardRow, 'id'>): Promise<string>;
  deleteAward(id: string): Promise<void>;
  grants(q: { athleteId: string }): Promise<GrantRow[]>;
  addGrant(row: Omit<GrantRow, 'id'>): Promise<string>;
  pins(q: { giverId?: string; recipientId?: string; grantId?: string }): Promise<PinRow[]>;
  addPin(row: Omit<PinRow, 'id'>): Promise<string>;
  deletePin(id: string): Promise<void>;
  /** Awards and grants of the athlete, and every pin it gave or received. */
  dropForAthlete(athleteId: string): Promise<void>;
  /** Raw repoint of awards, grants and pins from the removed athlete to the kept one; duplicates are resolved by the merge (later task). */
  moveForMerge(keptId: string, removedId: string): Promise<void>;
}
