import { dropNamed, emptyNoticeState, type NoticeState } from '../notices/__tests__/fake-store';
import type { AccessRow, AccessStore, AthleteForAccess } from './store';

export type FakeAthleteLine = { athleteId: string; action: string; changes: Record<string, unknown>; actor: string };
export type FakeAccessState = { rows: AccessRow[]; athletes: AthleteForAccess[]; locks: string[]; nextId: number; history: FakeAthleteLine[]; notices: NoticeState };
export type FakeAccess = { store: AccessStore; state: FakeAccessState };

/** Mirrors the live rule of the database index: one row with `revokedAt` null per athlete (a violation carries code 23505). */
export function fakeAccessStore(seed: Partial<FakeAccessState> = {}): FakeAccess {
  const state: FakeAccessState = { rows: [], athletes: [], locks: [], nextId: 1, history: [], notices: emptyNoticeState(), ...structuredClone(seed) };
  const must = (id: string): AccessRow => {
    const row = state.rows.find((r) => r.id === id);
    if (!row) throw new Error(`fake: no access ${id}`);
    return row;
  };
  const taken = (athleteId: string, except?: string): boolean => state.rows.some((r) => r.athleteId === athleteId && r.revokedAt === null && r.id !== except);
  const store: AccessStore = {
    liveByAthlete: async (athleteId) => structuredClone(state.rows.find((r) => r.athleteId === athleteId && r.revokedAt === null) ?? null),
    liveByAccount: async (accountId) => structuredClone(state.rows.filter((r) => r.accountId === accountId && r.revokedAt === null)),
    liveAccountIds: async () => [...new Set(state.rows.filter((r) => r.revokedAt === null).map((r) => r.accountId))].sort(),
    createAccess: async (n) => {
      if (taken(n.athleteId)) throw Object.assign(new Error('duplicate key: athlete_accesses_live_uq'), { code: '23505' });
      const id = `acs${state.nextId++}`;
      state.rows.push({ ...n, id, revokedAt: null, revokedBy: null, revokeReason: null, levelSeenGroup: null, levelSeenAt: null });
      return id;
    },
    revokeAccess: async (id, w) => {
      Object.assign(must(id), w);
    },
    setLevelSeen: async (id, groupId, at) => {
      Object.assign(must(id), { levelSeenGroup: groupId, levelSeenAt: at });
    },
    moveAccess: async (id, athleteId) => {
      const row = must(id);
      if (row.revokedAt === null && taken(athleteId, id)) throw Object.assign(new Error('duplicate key: athlete_accesses_live_uq'), { code: '23505' });
      row.athleteId = athleteId;
    },
    setAccessEmail: async (id, email) => {
      must(id).email = email;
    },
    setAthleteEmail: async (athleteId, email) => {
      const a = state.athletes.find((x) => x.id === athleteId);
      if (!a) throw new Error(`fake: no athlete ${athleteId}`);
      a.email = email;
    },
    lockAthlete: async (athleteId) => {
      state.locks.push(`athlete:${athleteId}`);
    },
    deleteForAthlete: async (athleteId) => {
      state.rows = state.rows.filter((r) => r.athleteId !== athleteId);
    },
    scrubForAthlete: async (athleteId) => {
      for (const r of state.rows) if (r.athleteId === athleteId) r.email = '';
    },
    recordAthlete: async (line) => {
      state.history.push(structuredClone(line));
    },
    dropNoticesForAthlete: async (athleteId) => dropNamed(state.notices, athleteId),
    athleteForAccess: async (athleteId) => structuredClone(state.athletes.find((a) => a.id === athleteId) ?? null),
  };
  return { store, state };
}
