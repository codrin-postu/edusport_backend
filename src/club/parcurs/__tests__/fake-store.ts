import type { AwardRow, GrantRow, ParcursStore, PinRow } from '../store';

export type ParcursState = { awards: AwardRow[]; grants: GrantRow[]; pins: PinRow[]; nextId: number };
export const emptyParcursState = (): ParcursState => ({ awards: [], grants: [], pins: [], nextId: 1 });

export function fakeParcursStore(state: ParcursState = emptyParcursState()): { store: ParcursStore; state: ParcursState } {
  const id = (p: string) => `${p}${state.nextId++}`;
  const store: ParcursStore = {
    transaction: (fn) => fn(),
    lockAthlete: async () => undefined,
    awards: async ({ athleteId }) => structuredClone(state.awards.filter((a) => !athleteId || a.athleteId === athleteId)),
    addAward: async (row) => {
      const added = { ...structuredClone(row), id: id('awd') };
      state.awards.push(added);
      return added.id;
    },
    deleteAward: async (awardId) => {
      state.awards = state.awards.filter((a) => a.id !== awardId);
    },
    grants: async ({ athleteId }) => structuredClone(state.grants.filter((g) => g.athleteId === athleteId)),
    addGrant: async (row) => {
      const added = { ...row, id: id('grt') };
      state.grants.push(added);
      return added.id;
    },
    deleteGrant: async (grantId) => {
      state.grants = state.grants.filter((g) => g.id !== grantId);
    },
    pins: async ({ giverId, recipientId, grantId }) =>
      structuredClone(state.pins.filter((p) => (!giverId || p.giverId === giverId) && (!recipientId || p.recipientId === recipientId) && (!grantId || p.grantId === grantId))),
    addPin: async (row) => {
      const added = { ...row, id: id('pin') };
      state.pins.push(added);
      return added.id;
    },
    deletePin: async (pinId) => {
      state.pins = state.pins.filter((p) => p.id !== pinId);
    },
    dropForAthlete: async (athleteId) => {
      state.awards = state.awards.filter((a) => a.athleteId !== athleteId);
      const gone = new Set(state.grants.filter((g) => g.athleteId === athleteId).map((g) => g.id));
      state.grants = state.grants.filter((g) => g.athleteId !== athleteId);
      state.pins = state.pins.filter((p) => p.giverId !== athleteId && p.recipientId !== athleteId && !gone.has(p.grantId));
    },
    moveForMerge: async (keptId, removedId) => {
      for (const a of state.awards) if (a.athleteId === removedId) a.athleteId = keptId;
      for (const g of state.grants) if (g.athleteId === removedId) g.athleteId = keptId;
      for (const p of state.pins) {
        if (p.giverId === removedId) p.giverId = keptId;
        if (p.recipientId === removedId) p.recipientId = keptId;
      }
    },
  };
  return { store, state };
}
