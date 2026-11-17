import type { ParcursStore, PinRow } from './store';

/** Delete athlete: awards, grants and every pin given or received go. (Anonymise writes nothing: the read shows "Fost sportiv".) */
export const dropParcurs = (s: ParcursStore, athleteId: string): Promise<void> => s.dropForAthlete(athleteId);

/** Grants of the removed athlete whose month the kept athlete already has: their pins move to the kept grant, the duplicate grant goes. */
async function collapseGrants(s: ParcursStore, keptId: string, removedId: string): Promise<void> {
  const keptBySource = new Map((await s.grants({ athleteId: keptId })).map((g) => [g.source, g.id]));
  for (const g of await s.grants({ athleteId: removedId })) {
    const target = keptBySource.get(g.source);
    if (!target) continue;
    for (const { id, ...pin } of await s.pins({ grantId: g.id })) {
      await s.deletePin(id);
      await s.addPin({ ...pin, grantId: target });
    }
    await s.deleteGrant(g.id);
  }
}

const oldestFirst = (a: PinRow, b: PinRow): number => a.givenOn.localeCompare(b.givenOn) || a.id.localeCompare(b.id);

/** Pins of the kept athlete after the move: none to oneself, and one per (giver, recipient, grant), the oldest. */
async function tidyPins(s: ParcursStore, keptId: string): Promise<void> {
  const byId = new Map<string, PinRow>();
  for (const p of [...(await s.pins({ giverId: keptId })), ...(await s.pins({ recipientId: keptId }))]) byId.set(p.id, p);
  const seen = new Set<string>();
  for (const p of [...byId.values()].sort(oldestFirst)) {
    const key = `${p.giverId}|${p.recipientId}|${p.grantId}`;
    if (p.giverId === p.recipientId || seen.has(key)) await s.deletePin(p.id);
    else seen.add(key);
  }
}

/** Merge: awards, grants and pins move to the kept athlete; same-month grants collapse; self-pins and duplicate pins are dropped. */
export async function mergeParcurs(s: ParcursStore, keptId: string, removedId: string): Promise<void> {
  await collapseGrants(s, keptId, removedId);
  await s.moveForMerge(keptId, removedId);
  await tidyPins(s, keptId);
}
